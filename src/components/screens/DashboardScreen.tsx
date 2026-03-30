import { useMemo, useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getLowStockProducts, type Product, type Customer, type SaleRecord, type Supplier, type PurchaseRecord } from "@/lib/store";
import { formatStockDisplay } from "@/lib/calc-utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import InfoTooltip from "@/components/InfoTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  products: Product[];
  customers: Customer[];
  sales: SaleRecord[];
  suppliers?: Supplier[];
  purchases?: PurchaseRecord[];
  shopName?: string;
}

export default function DashboardScreen({ onNavigate, products, customers, sales, suppliers = [], purchases = [], shopName }: DashboardScreenProps) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const todayStr = new Date().toDateString();

  // Fetch today's manual transactions
  const [manualTxns, setManualTxns] = useState<{ transaction_type: string; amount: number; category: string; description: string }[]>([]);
  const fetchManualTxns = useCallback(async () => {
    if (!user) return;
    const todayISO = new Date().toISOString().split('T')[0];
    const { data } = await (supabase.from('manual_transactions') as any)
      .select('transaction_type, amount, category, description')
      .eq('transaction_date', todayISO);
    setManualTxns(data || []);
  }, [user]);
  useEffect(() => { fetchManualTxns(); }, [fetchManualTxns]);

  const { todayTotal, todayCount, todayCashSales, todayDueSales, todayCashReceive, todayCashPayment, todayCashReceiveList, todayCashPaymentList } = useMemo(() => {
    let total = 0, count = 0, cashSales = 0, dueSales = 0, cashReceive = 0, cashPayment = 0;
    const receiveList: { label: string; amount: number }[] = [];
    const paymentList: { label: string; amount: number }[] = [];

    sales.forEach(s => {
      try {
        if (new Date(s.date).toDateString() === todayStr) {
          total += s.total; count++;
          const paid = s.paid ?? s.total;
          const due = s.due ?? 0;
          if (due === 0) cashSales += s.total;
          else dueSales += s.total;
          cashReceive += paid;
          if (paid > 0) receiveList.push({ label: `Sales Invoice / ${s.invoice}`, amount: paid });
        }
      } catch {}
    });
    purchases.forEach(p => {
      try {
        if (new Date(p.date).toDateString() === todayStr) {
          cashPayment += p.paid;
          if (p.paid > 0) paymentList.push({ label: `Purchase / ${p.invoice}`, amount: p.paid });
        }
      } catch {}
    });

    // Include manual transactions from Transaction Entry
    manualTxns.forEach(tx => {
      if (tx.transaction_type === 'cash_received' || tx.transaction_type === 'loan_receive') {
        cashReceive += tx.amount;
        receiveList.push({ label: tx.description || tx.category || 'Manual TRX', amount: tx.amount });
      } else if (tx.transaction_type === 'cash_payment' || tx.transaction_type === 'loan_payment') {
        cashPayment += tx.amount;
        paymentList.push({ label: tx.description || tx.category || 'Manual TRX', amount: tx.amount });
      }
    });

    return { todayTotal: total, todayCount: count, todayCashSales: cashSales, todayDueSales: dueSales, todayCashReceive: cashReceive, todayCashPayment: cashPayment, todayCashReceiveList: receiveList, todayCashPaymentList: paymentList };
  }, [sales, purchases, todayStr, manualTxns]);

  const supplierDues = useMemo(() => suppliers.reduce((sum, s) => sum + (s.totalDue || 0), 0), [suppliers]);
  const customerDues = useMemo(() => customers.reduce((sum, c) => sum + (c.totalDue || 0), 0), [customers]);
  const liability = customerDues - supplierDues;
  const cashBalance = todayCashReceive - todayCashPayment;
  const lowStock = useMemo(() => getLowStockProducts(products), [products]);

  // Sales progress data - group by date
  const salesProgressData = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(s => {
      try {
        const d = new Date(s.date);
        const key = d.toISOString().split('T')[0];
        map[key] = (map[key] || 0) + s.total;
      } catch {}
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([date, total]) => ({ date, total }));
  }, [sales]);

  // Account balances
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = { cash: 0, bkash: 0, nagad: 0, card: 0, bank: 0 };
    sales.forEach(s => {
      const method = (s.paymentMethod || 'cash').toLowerCase();
      const paid = s.paid ?? s.total;
      if (method in balances) balances[method] += paid;
      else balances['cash'] += paid;
    });
    purchases.forEach(p => { balances['cash'] -= p.paid; });
    return balances;
  }, [sales, purchases]);
  const totalBalance = Object.values(accountBalances).reduce((s, v) => s + v, 0);

  const quickActions = [
    { id: 'new-sale', icon: 'add_shopping_cart', label: lang === 'bn' ? 'বিক্রয়' : 'Add Sales', color: 'bg-green-600 hover:bg-green-700' },
    { id: 'sales', icon: 'receipt_long', label: lang === 'bn' ? 'বিক্রয় তালিকা' : 'Sales', color: 'bg-blue-600 hover:bg-blue-700' },
    { id: 'inventory', icon: 'inventory', label: lang === 'bn' ? 'মজুদ' : 'Stock', color: 'bg-orange-600 hover:bg-orange-700' },
    { id: 'transactions', icon: 'payments', label: lang === 'bn' ? 'পেমেন্ট' : 'Payment', color: 'bg-emerald-600 hover:bg-emerald-700' },
    { id: 'reports', icon: 'assessment', label: lang === 'bn' ? 'লেনদেন' : 'Transaction', color: 'bg-purple-600 hover:bg-purple-700' },
  ];

  return (
    <section className="p-3 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      {/* ── Top Bar: Shop Name + Quick Actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-pos-secondary rounded-lg px-4 py-3">
        <h1 className="text-white font-bold text-base sm:text-lg truncate">{shopName || 'My Shop'}</h1>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(a => (
            <button
              key={a.id}
              onClick={() => onNavigate(a.id)}
              className={`${a.color} text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors`}
            >
              <span className="material-symbols-outlined text-sm">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4 Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PROFILE */}
        <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-pos-secondary text-2xl">person</span>
            <span className="text-sm font-bold uppercase tracking-wider text-pos-on-surface">PROFILE</span>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-pos-on-surface-variant">{t('totalCustomers')}:</span><span className="font-bold text-base">{customers.length}</span></div>
            <div className="flex justify-between"><span className="text-pos-on-surface-variant">{t('suppliers')}:</span><span className="font-bold text-base">{suppliers.length}</span></div>
            <div className="flex justify-between"><span className="text-pos-on-surface-variant">{t('totalProducts')}:</span><span className="font-bold text-base">{products.length}</span></div>
          </div>
        </div>

        {/* SALES TODAY */}
        <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-pos-secondary text-2xl">shopping_cart</span>
            <span className="text-sm font-bold uppercase tracking-wider text-pos-on-surface">SALES TODAY</span>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-pos-on-surface-variant">{t('totalSales')} ({todayCount}):</span><span className="font-bold text-base">{formatCurrency(todayTotal)}</span></div>
            <div className="flex justify-between"><span className="text-pos-on-surface-variant">Cash Sales:</span><span className="font-bold text-base">{formatCurrency(todayCashSales)}</span></div>
            <div className="flex justify-between"><span className="text-pos-on-surface-variant">Dues Sales:</span><span className="font-bold text-base">{formatCurrency(todayDueSales)}</span></div>
          </div>
        </div>

        {/* CASH TRX TODAY */}
        <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-pos-secondary text-2xl">check_circle</span>
            <span className="text-sm font-bold uppercase tracking-wider text-pos-on-surface">CASH TRX. TODAY</span>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center"><span className="text-pos-on-surface-variant flex items-center gap-1">Cash Receive <InfoTooltip text="আজকের মোট নগদ বিক্রয়।" /></span><span className="font-bold text-base">{formatCurrency(todayCashReceive)}</span></div>
            <div className="flex justify-between items-center"><span className="text-pos-on-surface-variant flex items-center gap-1">Cash Payment <InfoTooltip text="আজকে কেনাকাটায় যত টাকা দিয়েছেন।" /></span><span className="font-bold text-base">{formatCurrency(todayCashPayment)}</span></div>
            <div className="flex justify-between items-center"><span className="text-pos-on-surface-variant flex items-center gap-1">Cash Balance <InfoTooltip text="আজকের আয় ও ব্যয়ের পর হাতে যে টাকা রইল।" /></span><span className="font-bold text-base">{formatCurrency(cashBalance)}</span></div>
          </div>
        </div>

        {/* OVERALL BALANCE */}
        <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-pos-secondary text-2xl">grid_view</span>
            <span className="text-sm font-bold uppercase tracking-wider text-pos-on-surface">OVERALL BALANCE</span>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center"><span className="text-pos-on-surface-variant flex items-center gap-1">Supplier Dues <InfoTooltip text="সাপ্লায়ারদের মোট দেনা/পাবে।" /></span><span className="font-bold text-base">{formatCurrency(supplierDues)}</span></div>
            <div className="flex justify-between items-center"><span className="text-pos-on-surface-variant flex items-center gap-1">Customer Dues <InfoTooltip text="কাস্টমারদের মোট বকেয়া।" /></span><span className="font-bold text-base text-destructive">{formatCurrency(customerDues)}</span></div>
            <div className="flex justify-between items-center"><span className="text-pos-on-surface-variant flex items-center gap-1">Liability <InfoTooltip text="পজিটিভ হলে কাস্টমারদের বকেয়া, নেগেটিভ হলে সাপ্লায়ারদের দেনা।" /></span><span className="font-bold text-base">{formatCurrency(liability)}</span></div>
          </div>
        </div>
      </div>

      {/* ── Sales Progress Chart + Balance Table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SALES PROGRESS */}
        <div className="lg:col-span-7 bg-pos-surface-lowest rounded-lg border border-pos-surface-container p-4">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-pos-secondary">trending_up</span>
            <h3 className="text-sm font-bold uppercase">SALES PROGRESS</h3>
          </div>
          <div className="h-56">
            {salesProgressData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesProgressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [formatCurrency(value), 'Sales']}
                  />
                  <Line type="monotone" dataKey="total" stroke="hsl(200, 80%, 55%)" strokeWidth={2} dot={{ fill: 'hsl(200, 80%, 55%)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-pos-on-surface-variant text-sm">
                {lang === 'bn' ? 'এখনো কোনো বিক্রয় ডেটা নেই' : 'No sales data yet'}
              </div>
            )}
          </div>
        </div>

        {/* BALANCE TABLE */}
        <div className="lg:col-span-5 bg-pos-surface-lowest rounded-lg border border-pos-surface-container overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-pos-secondary">account_balance</span>
            <h3 className="text-sm font-bold uppercase">BALANCE</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase bg-pos-secondary text-white">
                <th className="px-4 py-2 text-left">ACCOUNT</th>
                <th className="px-4 py-2 text-right">BALANCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {[
                { name: 'Cash', value: accountBalances.cash },
                { name: 'Card', value: accountBalances.card },
                { name: 'Bank', value: accountBalances.bank || 0 },
                { name: 'bKash', value: accountBalances.bkash },
                { name: 'Nagad', value: accountBalances.nagad },
              ].map(acc => (
                <tr key={acc.name} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2.5 font-medium">{acc.name}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(acc.value)}</td>
                </tr>
              ))}
              <tr className="bg-pos-surface-low font-black text-sm">
                <td className="px-4 py-2.5">{t('total')}:</td>
                <td className="px-4 py-2.5 text-right text-pos-secondary">{formatCurrency(totalBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cash Receive Today + Cash Payment Today ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CASH RECEIVE TODAY */}
        <div className="bg-pos-surface-lowest rounded-lg border border-pos-surface-container overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-green-500">check_circle</span>
            <h3 className="text-sm font-bold uppercase text-green-600 dark:text-green-400">CASH RECEIVE TODAY</h3>
          </div>
          <div className="p-4 space-y-2 min-h-[80px]">
            {todayCashReceiveList.length > 0 ? todayCashReceiveList.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-pos-surface-container last:border-0">
                <span className="text-pos-on-surface-variant">{item.label}</span>
                <span className="font-bold">{formatCurrency(item.amount)}</span>
              </div>
            )) : (
              <div className="text-xs text-pos-on-surface-variant text-center py-4">
                {lang === 'bn' ? 'আজ কোনো ক্যাশ রিসিভ নেই...' : 'No data found.....'}
              </div>
            )}
          </div>
        </div>

        {/* CASH PAYMENT TODAY */}
        <div className="bg-pos-surface-lowest rounded-lg border border-pos-surface-container overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-red-500">check_circle</span>
            <h3 className="text-sm font-bold uppercase text-red-600 dark:text-red-400">CASH PAYMENT TODAY</h3>
          </div>
          <div className="p-4 space-y-2 min-h-[80px]">
            {todayCashPaymentList.length > 0 ? todayCashPaymentList.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-pos-surface-container last:border-0">
                <span className="text-pos-on-surface-variant">{item.label}</span>
                <span className="font-bold">{formatCurrency(item.amount)}</span>
              </div>
            )) : (
              <div className="text-xs text-pos-on-surface-variant text-center py-4">
                {lang === 'bn' ? 'আজ কোনো ক্যাশ পেমেন্ট নেই...' : 'No data found.....'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Low Stock Alert + Recent Sales ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 bg-pos-surface-lowest rounded-lg p-4 border border-pos-surface-container">
          <h3 className="text-sm font-bold mb-1">{t('lowStockAlert')}</h3>
          <p className="text-[10px] text-pos-on-surface-variant mb-3">{t('itemsNeedRestock')}</p>
          <div className="space-y-3">
            {lowStock.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-pos-error-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-pos-on-error-container text-sm">warning</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate">{item.name} {item.size}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="h-1 flex-1 bg-pos-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-pos-error rounded-full" style={{ width: `${Math.min(100, (item.stock / 50) * 100)}%` }} />
                    </div>
                    <span className="text-[9px] text-pos-error font-bold">{formatStockDisplay(item.stock, item.piecesPerBox || 4)}</span>
                  </div>
                </div>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="text-xs text-pos-tertiary font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span> {t('allStockOK')}
              </div>
            )}
          </div>
          <button onClick={() => onNavigate('inventory')} className="mt-4 w-full py-1.5 text-xs font-semibold text-pos-secondary border border-pos-secondary-container rounded hover:bg-pos-secondary-container transition-colors">
            {t('viewAllInventory')}
          </button>
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-8 bg-pos-surface-lowest rounded-lg overflow-hidden border border-pos-surface-container">
          <div className="px-4 py-3 flex justify-between items-center border-b border-pos-surface-container">
            <h3 className="text-sm font-bold">{t('recentTransactions')}</h3>
            <button onClick={() => onNavigate('sales')} className="text-xs font-medium text-pos-secondary flex items-center gap-1 hover:underline">
              {t('viewAll')} <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider bg-pos-surface-low border-b border-pos-surface-container text-pos-on-surface-variant">
                  <th className="px-3 py-2">{t('invoice')}</th>
                  <th className="px-3 py-2">{t('customer')}</th>
                  <th className="px-3 py-2">{t('amount')}</th>
                  <th className="px-3 py-2 hidden sm:table-cell">{t('paid')}</th>
                  <th className="px-3 py-2 hidden sm:table-cell">{t('due')}</th>
                  <th className="px-3 py-2 text-right">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pos-surface-container">
                {sales.slice(0, 5).map((s) => {
                  const sdue = s.due ?? 0;
                  return (
                    <tr key={s.id} className="hover:bg-pos-surface-low transition-colors">
                      <td className="px-3 py-2 font-mono text-[11px] font-bold text-pos-secondary">{s.invoice}</td>
                      <td className="px-3 py-2 font-medium">{s.customer}</td>
                      <td className="px-3 py-2 font-bold">{formatCurrency(s.total)}</td>
                      <td className="px-3 py-2 font-semibold text-green-600 dark:text-green-400 hidden sm:table-cell">{formatCurrency(s.paid ?? s.total)}</td>
                      <td className={`px-3 py-2 font-semibold hidden sm:table-cell ${sdue > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(sdue)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${s.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : s.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                          {s.status === 'paid' ? t('paid') : s.status === 'pending' ? t('pending') : t('credit')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {sales.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-pos-on-surface-variant text-xs">{t('noSalesYetDash')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
