import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, type SaleRecord, type PurchaseRecord } from "@/lib/store";
import InfoTooltip from "@/components/InfoTooltip";

interface TransactionsScreenProps {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
}

export default function TransactionsScreen({ sales, purchases }: TransactionsScreenProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const transactions = useMemo(() => {
    const items: { id: string; date: string; type: 'income' | 'expense'; description: string; amount: number; paid: number; due: number; method: string; reference: string }[] = [];

    sales.forEach(s => {
      items.push({
        id: s.id, date: s.date, type: 'income',
        description: `${s.customer || 'Walking Customer'}`,
        amount: s.total, paid: s.paid ?? s.total, due: s.due ?? 0,
        method: s.paymentMethod, reference: s.invoice,
      });
    });

    purchases.forEach(p => {
      items.push({
        id: p.id, date: p.date, type: 'expense',
        description: `${p.supplierName}`,
        amount: p.payable || p.total, paid: p.paid, due: p.due,
        method: 'Cash', reference: p.invoice || p.id.slice(0, 8),
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return items.filter(i => {
      if (filter !== 'all' && i.type !== filter) return false;
      if (search && !i.description.toLowerCase().includes(search.toLowerCase()) && !i.reference.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [sales, purchases, filter, search]);

  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.paid, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.paid, 0), [transactions]);
  const totalDueIn = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.due, 0), [transactions]);
  const totalDueOut = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.due, 0), [transactions]);

  const totalPages = Math.ceil(transactions.length / perPage);
  const paged = transactions.slice((page - 1) * perPage, page * perPage);

  return (
    <section className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">assessment</span>
          Transactions
        </h2>
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full font-medium">
          {transactions.length} records
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.1)] transition-shadow">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold mb-1">
            Cash In <InfoTooltip text="বিক্রি থেকে নগদ প্রাপ্তি" />
          </div>
          <div className="text-xl font-black text-[hsl(142,70%,35%)]">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.1)] transition-shadow">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold mb-1">
            Cash Out <InfoTooltip text="পার্চেজে নগদ ব্যয়" />
          </div>
          <div className="text-xl font-black text-destructive">{formatCurrency(totalExpense)}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.1)] transition-shadow">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold mb-1">
            Receivable <InfoTooltip text="কাস্টমারদের কাছে বকেয়া পাওনা" />
          </div>
          <div className="text-xl font-black text-amber-600">{formatCurrency(totalDueIn)}</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_28px_rgba(0,0,0,0.1)] transition-shadow">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold mb-1">
            Net Balance <InfoTooltip text="Cash In − Cash Out" />
          </div>
          <div className={`text-xl font-black ${totalIncome - totalExpense >= 0 ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'}`}>
            {formatCurrency(totalIncome - totalExpense)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-muted rounded-xl p-1">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {f === 'all' ? '📊 All' : f === 'income' ? '📈 Income' : '📉 Expense'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-muted/50 border border-border rounded-xl text-sm py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring transition-shadow"
            placeholder="Search by name or invoice..." />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/60 text-[11px] font-bold text-muted-foreground uppercase">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Party</th>
                <th className="text-left py-3 px-4">Invoice</th>
                <th className="text-left py-3 px-4">Method</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-right py-3 px-4">Paid</th>
                <th className="text-right py-3 px-4">Due</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">
                  <span className="material-symbols-outlined text-4xl block mb-2">receipt_long</span>
                  <span className="text-sm">No transactions found</span>
                </td></tr>
              ) : paged.map(tx => (
                <tr key={tx.id} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                    {(() => { try { return new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return tx.date; } })()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                      tx.type === 'income' ? 'bg-[hsl(142,70%,92%)] text-[hsl(142,70%,30%)]' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {tx.type === 'income' ? '↓ Sale' : '↑ Purchase'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-foreground">{tx.description}</td>
                  <td className="py-3 px-4 text-xs text-primary font-mono font-bold">{tx.reference}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground uppercase">{tx.method}</td>
                  <td className="py-3 px-4 text-sm font-bold text-right">{formatCurrency(tx.amount)}</td>
                  <td className={`py-3 px-4 text-sm font-bold text-right text-[hsl(142,70%,35%)]`}>{formatCurrency(tx.paid)}</td>
                  <td className={`py-3 px-4 text-sm font-bold text-right ${tx.due > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatCurrency(tx.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/30">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-card border border-border disabled:opacity-40 hover:bg-muted transition-colors">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-card border border-border disabled:opacity-40 hover:bg-muted transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
