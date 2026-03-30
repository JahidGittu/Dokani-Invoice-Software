import { useState, useMemo, useEffect, useCallback } from "react";
import { formatCurrency, type SaleRecord, type PurchaseRecord } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ComboInput from "@/components/ComboInput";
import { toast } from "sonner";

interface TransactionsScreenProps {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
}

const ACCOUNT_OPTIONS = ['Cash', 'Card', 'BANK', 'Nagad', 'bKash'];
const TRANSACTION_TYPES = [
  { value: 'cash_received', label: 'Cash Received' },
  { value: 'cash_payment', label: 'Cash Payment' },
  { value: 'loan_receive', label: 'Loan Receive' },
  { value: 'loan_payment', label: 'Loan Payment' },
];

type Tab = 'entry' | 'all' | 'loans';

interface ManualTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  account: string;
  category: string;
  description: string;
  amount: number;
  is_profit_loss: boolean;
  created_at: string;
}

interface Loan {
  id: string;
  loan_no: string;
  amount: number;
  receiver: string;
  giver: string;
  loan_date: string;
  balance: number;
  status: string;
  comment: string;
  created_at: string;
}

export default function TransactionsScreen({ sales, purchases }: TransactionsScreenProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('entry');

  // Transaction Entry state
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [txType, setTxType] = useState('');
  const [txAccount, setTxAccount] = useState('Cash');
  const [txCategory, setTxCategory] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txProfitLoss, setTxProfitLoss] = useState(false);
  const [saving, setSaving] = useState(false);

  // Categories
  const [categories, setCategories] = useState<string[]>([]);

  // All transactions
  const [manualTxns, setManualTxns] = useState<ManualTransaction[]>([]);
  const [txSearch, setTxSearch] = useState('');

  // Loans
  const [loans, setLoans] = useState<Loan[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanReceiver, setLoanReceiver] = useState('');
  const [loanGiver, setLoanGiver] = useState('');
  const [loanDate, setLoanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loanComment, setLoanComment] = useState('');
  const [loanSearch, setLoanSearch] = useState('');

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.from('transaction_categories') as any)
      .select('name')
      .order('created_at', { ascending: true });
    setCategories((data || []).map((r: any) => r.name));
  }, [user]);

  // Fetch manual transactions
  const fetchManualTxns = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.from('manual_transactions') as any)
      .select('*')
      .order('transaction_date', { ascending: false });
    setManualTxns(data || []);
  }, [user]);

  // Fetch loans
  const fetchLoans = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.from('loans') as any)
      .select('*')
      .order('created_at', { ascending: false });
    setLoans(data || []);
  }, [user]);

  useEffect(() => {
    fetchCategories();
    fetchManualTxns();
    fetchLoans();
  }, [fetchCategories, fetchManualTxns, fetchLoans]);

  // Add category
  const handleAddCategory = useCallback(async (name: string) => {
    if (!user || !name.trim()) return;
    const trimmed = name.trim();
    if (categories.includes(trimmed)) return;
    await (supabase.from('transaction_categories') as any).insert({ user_id: user.id, name: trimmed });
    setCategories(prev => [...prev, trimmed]);
  }, [user, categories]);

  // Save transaction
  const handleSaveTransaction = async () => {
    if (!user || !txType || !txAmount || Number(txAmount) <= 0) {
      toast.error('Transaction Type ও Amount দিন');
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from('manual_transactions') as any).insert({
      user_id: user.id,
      transaction_date: txDate,
      transaction_type: txType,
      account: txAccount,
      category: txCategory,
      description: txDescription,
      amount: Number(txAmount),
      is_profit_loss: txProfitLoss,
    });
    setSaving(false);
    if (error) { toast.error('সেভ করতে সমস্যা হয়েছে'); return; }
    toast.success('Transaction সেভ হয়েছে');
    resetForm();
    fetchManualTxns();
  };

  const resetForm = () => {
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxType('');
    setTxAccount('Cash');
    setTxCategory('');
    setTxDescription('');
    setTxAmount('');
    setTxProfitLoss(false);
  };

  // Delete transaction
  const handleDeleteTx = async (id: string) => {
    await (supabase.from('manual_transactions') as any).delete().eq('id', id);
    toast.success('Transaction ডিলিট হয়েছে');
    fetchManualTxns();
  };

  // Save loan
  const handleSaveLoan = async () => {
    if (!user || !loanAmount || Number(loanAmount) <= 0 || !loanReceiver.trim() || !loanGiver.trim()) {
      toast.error('সব ফিল্ড পূরণ করুন');
      return;
    }
    const loanNo = `LN-${Date.now()}`;
    const amt = Number(loanAmount);
    const { error } = await (supabase.from('loans') as any).insert({
      user_id: user.id,
      loan_no: loanNo,
      amount: amt,
      receiver: loanReceiver.trim(),
      giver: loanGiver.trim(),
      loan_date: loanDate,
      balance: amt,
      status: 'active',
      comment: loanComment,
    });
    if (error) { toast.error('লোন সেভ করতে সমস্যা'); return; }
    toast.success('নতুন লোন যোগ হয়েছে');
    setShowLoanModal(false);
    setLoanAmount(''); setLoanReceiver(''); setLoanGiver(''); setLoanComment('');
    setLoanDate(new Date().toISOString().split('T')[0]);
    fetchLoans();
  };

  // Delete loan
  const handleDeleteLoan = async (id: string) => {
    await (supabase.from('loans') as any).delete().eq('id', id);
    toast.success('লোন ডিলিট হয়েছে');
    fetchLoans();
  };

  // All transactions combined (for the "All Transactions" tab)
  const allTransactions = useMemo(() => {
    const items: { id: string; date: string; type: string; category: string; description: string; amount: number; account: string; source: string }[] = [];

    // Manual transactions
    manualTxns.forEach(t => {
      items.push({
        id: t.id,
        date: t.transaction_date,
        type: t.transaction_type,
        category: t.category,
        description: t.description,
        amount: t.amount,
        account: t.account,
        source: 'manual',
      });
    });

    // Sales
    sales.forEach(s => {
      items.push({
        id: s.id,
        date: s.date,
        type: 'cash_received',
        category: 'Sales',
        description: `Sale to ${s.customer}`,
        amount: s.paid || s.total,
        account: s.paymentMethod || 'Cash',
        source: 'sale',
      });
    });

    // Purchases
    purchases.forEach(p => {
      items.push({
        id: p.id,
        date: p.date,
        type: 'cash_payment',
        category: 'Purchase',
        description: `Purchase from ${p.supplierName}`,
        amount: p.paid || p.total,
        account: 'Cash',
        source: 'purchase',
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (txSearch) {
      const q = txSearch.toLowerCase();
      return items.filter(i => i.description.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return items;
  }, [manualTxns, sales, purchases, txSearch]);

  // Group by category for folder view
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof allTransactions> = {};
    allTransactions.forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return groups;
  }, [allTransactions]);

  // Filtered loans
  const filteredLoans = useMemo(() => {
    if (!loanSearch) return loans;
    const q = loanSearch.toLowerCase();
    return loans.filter(l => l.receiver.toLowerCase().includes(q) || l.giver.toLowerCase().includes(q) || l.loan_no.toLowerCase().includes(q));
  }, [loans, loanSearch]);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
  };

  const typeLabel = (t: string) => {
    const found = TRANSACTION_TYPES.find(x => x.value === t);
    return found ? found.label : t;
  };

  return (
    <section className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">assessment</span>
          Transaction
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setTab('entry')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${tab === 'entry' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-muted'}`}>
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Transaction Entry
          </button>
          <button onClick={() => setTab('all')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${tab === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-muted'}`}>
            <span className="material-symbols-outlined text-sm">folder_open</span>
            All Transactions
          </button>
          <button onClick={() => setTab('loans')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${tab === 'loans' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-muted'}`}>
            <span className="material-symbols-outlined text-sm">account_balance</span>
            Manage Loans
          </button>
        </div>
      </div>

      {/* ────── TAB 1: Transaction Entry ────── */}
      {tab === 'entry' && (
        <>
        <div className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Date</label>
              <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Transaction Type <span className="text-destructive">*</span></label>
              <select value={txType} onChange={e => setTxType(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring">
                <option value="">--- Select Type ---</option>
                {TRANSACTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Account */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Account</label>
              <select value={txAccount} onChange={e => setTxAccount(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring">
                {ACCOUNT_OPTIONS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Category (ComboInput) */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Category</label>
              <ComboInput
                value={txCategory}
                onChange={setTxCategory}
                options={categories}
                onAddNew={handleAddCategory}
                placeholder="Select or add category..."
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Amount <span className="text-destructive">*</span></label>
              <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Description</label>
              <input type="text" value={txDescription} onChange={e => setTxDescription(e.target.value)}
                placeholder="Transaction description..."
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Profit/Loss checkbox */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="profitLoss" checked={txProfitLoss} onChange={e => setTxProfitLoss(e.target.checked)}
              className="w-4 h-4 rounded border-border" />
            <label htmlFor="profitLoss" className="text-sm text-foreground font-medium">Profit/Loss</label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2 border-t border-border">
            <button onClick={handleSaveTransaction} disabled={saving}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">save</span>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={resetForm}
              className="px-6 py-2.5 bg-muted text-muted-foreground rounded-lg text-sm font-bold hover:opacity-80 transition-opacity">
              Reset
            </button>
          </div>
        </div>

        {/* Recent Transactions - separate section below form */}
        {allTransactions.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">receipt_long</span>
                Recent Transactions
              </h4>
              <button onClick={() => setTab('all')} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                View All <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b border-border">
                    <th className="text-left py-2.5 px-3">#</th>
                    <th className="text-left py-2.5 px-3">Date</th>
                    <th className="text-left py-2.5 px-3">Type</th>
                    <th className="text-left py-2.5 px-3">Category</th>
                    <th className="text-left py-2.5 px-3">Description</th>
                    <th className="text-left py-2.5 px-3">Account</th>
                    <th className="text-right py-2.5 px-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allTransactions.slice(0, 5).map((t, i) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 px-3">{formatDate(t.date)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          t.type === 'cash_received' || t.type === 'loan_receive'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          {typeLabel(t.type)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{t.category || '-'}</td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[180px]">{t.description || '-'}</td>
                      <td className="py-2.5 px-3">{t.account}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${
                        t.type === 'cash_received' || t.type === 'loan_receive' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {t.type === 'cash_received' || t.type === 'loan_receive' ? '+' : '-'}৳{t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      )}

      {/* ────── TAB 2: All Transactions ────── */}
      {tab === 'all' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="relative max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>
              <input value={txSearch} onChange={e => setTxSearch(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search transactions..." />
            </div>
          </div>

          {/* Category Folders */}
          <div className="bg-card border border-border rounded-xl p-4">
            {Object.keys(groupedByCategory).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">কোনো Transaction নেই</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(groupedByCategory).map(([cat, items]) => (
                  <CategoryFolder key={cat} category={cat} count={items.length} items={items}
                    onDeleteTx={handleDeleteTx} formatDate={formatDate} typeLabel={typeLabel} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────── TAB 3: Manage Loans ────── */}
      {tab === 'loans' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setShowLoanModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90">
              <span className="material-symbols-outlined text-sm">add</span>
              Add New Loan
            </button>
            <div className="relative max-w-xs flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>
              <input value={loanSearch} onChange={e => setLoanSearch(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search loans..." />
            </div>
          </div>

          {/* Loans Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary text-primary-foreground text-xs font-bold uppercase">
                    <th className="text-left py-3 px-4">Loan No</th>
                    <th className="text-right py-3 px-4">Amount</th>
                    <th className="text-left py-3 px-4">Receiver</th>
                    <th className="text-left py-3 px-4">Giver</th>
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-right py-3 px-4">Balance</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-center py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">কোনো লোন নেই</td></tr>
                  ) : filteredLoans.map(loan => (
                    <tr key={loan.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-xs font-mono text-foreground">{loan.loan_no}</td>
                      <td className="py-3 px-4 text-sm font-bold text-right text-foreground">{formatCurrency(loan.amount)}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{loan.receiver}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{loan.giver}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(loan.loan_date)}</td>
                      <td className="py-3 px-4 text-sm font-bold text-right text-foreground">{formatCurrency(loan.balance)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          loan.status === 'active' ? 'bg-[hsl(142,70%,90%)] text-[hsl(142,70%,30%)] border-[hsl(142,70%,70%)]' : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {loan.status === 'active' ? 'Active' : 'Closed'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleDeleteLoan(loan.id)} title="Delete"
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────── Add Loan Modal ────── */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowLoanModal(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                Add New Loan
              </h3>
              <button onClick={() => setShowLoanModal(false)} className="text-muted-foreground hover:text-foreground">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Loan Amount <span className="text-destructive">*</span></label>
                <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Loan Receiver <span className="text-destructive">*</span></label>
                <input type="text" value={loanReceiver} onChange={e => setLoanReceiver(e.target.value)}
                  placeholder="Receiver name..."
                  className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Loan Giver <span className="text-destructive">*</span></label>
                <input type="text" value={loanGiver} onChange={e => setLoanGiver(e.target.value)}
                  placeholder="Giver name..."
                  className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Loan Date <span className="text-destructive">*</span></label>
                <input type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Comment</label>
                <textarea value={loanComment} onChange={e => setLoanComment(e.target.value)}
                  placeholder="Optional comment..."
                  rows={2}
                  className="w-full bg-muted/50 border border-border rounded-lg text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={() => setShowLoanModal(false)}
                className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-lg text-sm font-bold">
                Close
              </button>
              <button onClick={handleSaveLoan}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90">
                Add Loan
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ────── Category Folder Component ──────
function CategoryFolder({ category, count, items, onDeleteTx, formatDate, typeLabel }: {
  category: string;
  count: number;
  items: { id: string; date: string; type: string; category: string; description: string; amount: number; account: string; source: string }[];
  onDeleteTx: (id: string) => void;
  formatDate: (d: string) => string;
  typeLabel: (t: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)}
        className="flex items-center gap-2 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left w-full">
        <span className="material-symbols-outlined text-2xl text-amber-500">folder</span>
        <div>
          <div className="text-sm font-bold text-primary">{category}</div>
          <div className="text-xs text-muted-foreground">({count})</div>
        </div>
      </button>
    );
  }

  return (
    <div className="col-span-full bg-muted/30 border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl text-amber-500">folder_open</span>
          <span className="text-sm font-bold text-primary">{category} ({count})</span>
        </div>
        <button onClick={() => setExpanded(false)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">close</span>
          Close
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-bold text-muted-foreground uppercase border-b border-border">
              <th className="text-left py-2 px-2">Date</th>
              <th className="text-left py-2 px-2">Type</th>
              <th className="text-left py-2 px-2">Description</th>
              <th className="text-right py-2 px-2">Amount</th>
              <th className="text-center py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(tx => (
              <tr key={tx.id} className="border-t border-border/30 hover:bg-muted/30">
                <td className="py-2 px-2 text-xs text-muted-foreground">{formatDate(tx.date)}</td>
                <td className="py-2 px-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    tx.type === 'cash_received' ? 'bg-[hsl(142,70%,90%)] text-[hsl(142,70%,30%)]' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {typeLabel(tx.type)}
                  </span>
                </td>
                <td className="py-2 px-2 text-foreground">{tx.description || '—'}</td>
                <td className={`py-2 px-2 text-right font-bold ${
                  ['cash_received', 'loan_receive'].includes(tx.type) ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'
                }`}>
                  {formatCurrency(tx.amount)}
                </td>
                <td className="py-2 px-2 text-center">
                  {tx.source === 'manual' && (
                    <button onClick={() => onDeleteTx(tx.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
