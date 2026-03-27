import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, type SaleRecord, type PurchaseRecord } from "@/lib/store";

interface TransactionsScreenProps {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
}

export default function TransactionsScreen({ sales, purchases }: TransactionsScreenProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');

  const transactions = useMemo(() => {
    const items: { id: string; date: string; type: 'income' | 'expense'; description: string; amount: number; method: string; reference: string }[] = [];

    sales.forEach(s => {
      items.push({
        id: s.id,
        date: s.date,
        type: 'income',
        description: `Sale to ${s.customer}`,
        amount: s.total,
        method: s.paymentMethod,
        reference: s.invoice,
      });
    });

    purchases.forEach(p => {
      items.push({
        id: p.id,
        date: p.date,
        type: 'expense',
        description: `Purchase from ${p.supplier}`,
        amount: p.total,
        method: p.paymentMethod || 'Cash',
        reference: p.id.slice(0, 8),
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return items.filter(i => {
      if (filter !== 'all' && i.type !== filter) return false;
      if (search && !i.description.toLowerCase().includes(search.toLowerCase()) && !i.reference.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [sales, purchases, filter, search]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <section className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold">Total Income</div>
          <div className="text-2xl font-black text-[hsl(142,70%,35%)] mt-1">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold">Total Expense</div>
          <div className="text-2xl font-black text-destructive mt-1">{formatCurrency(totalExpense)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold">Net Balance</div>
          <div className={`text-2xl font-black mt-1 ${totalIncome - totalExpense >= 0 ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'}`}>
            {formatCurrency(totalIncome - totalExpense)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-muted rounded-lg p-0.5">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              {f === 'all' ? 'All' : f === 'income' ? '↑ Income' : '↓ Expense'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2 pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search transactions..." />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase">
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Description</th>
              <th className="text-left py-3 px-4">Reference</th>
              <th className="text-left py-3 px-4">Method</th>
              <th className="text-right py-3 px-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No transactions found</td></tr>
            ) : transactions.map(tx => (
              <tr key={tx.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 text-xs text-muted-foreground">
                  {(() => { try { return new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return tx.date; } })()}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    tx.type === 'income' ? 'bg-[hsl(142,70%,90%)] text-[hsl(142,70%,30%)]' : 'bg-destructive/10 text-destructive'
                  }`}>
                    <span className="material-symbols-outlined text-xs">{tx.type === 'income' ? 'arrow_downward' : 'arrow_upward'}</span>
                    {tx.type}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm font-medium text-foreground">{tx.description}</td>
                <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{tx.reference}</td>
                <td className="py-3 px-4 text-xs text-muted-foreground uppercase">{tx.method}</td>
                <td className={`py-3 px-4 text-sm font-bold text-right ${tx.type === 'income' ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
