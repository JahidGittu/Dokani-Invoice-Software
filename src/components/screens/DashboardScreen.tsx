import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getLowStockProducts, type Product, type Customer, type SaleRecord, type Supplier, type PurchaseRecord } from "@/lib/store";

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  products: Product[];
  customers: Customer[];
  sales: SaleRecord[];
  suppliers?: Supplier[];
  purchases?: PurchaseRecord[];
}

export default function DashboardScreen({ onNavigate, products, customers, sales, suppliers = [], purchases = [] }: DashboardScreenProps) {
  const { t } = useI18n();
  const todayStr = new Date().toDateString();

  const { todayTotal, todayCount, todayCashSales, todayDueSales, todayCashReceive, todayCashPayment } = useMemo(() => {
    let total = 0, count = 0, cashSales = 0, dueSales = 0, cashReceive = 0, cashPayment = 0;
    sales.forEach(s => {
      try {
        if (new Date(s.date).toDateString() === todayStr) {
          total += s.total; count++;
          const paid = s.paid ?? s.total;
          const due = s.due ?? 0;
          if (due === 0) cashSales += s.total;
          else dueSales += s.total;
          cashReceive += paid;
        }
      } catch {}
    });
    purchases.forEach(p => {
      try {
        if (new Date(p.date).toDateString() === todayStr) {
          cashPayment += p.paid;
        }
      } catch {}
    });
    return { todayTotal: total, todayCount: count, todayCashSales: cashSales, todayDueSales: dueSales, todayCashReceive: cashReceive, todayCashPayment: cashPayment };
  }, [sales, purchases, todayStr]);

  const supplierDues = useMemo(() => suppliers.reduce((sum, s) => sum + (s.totalDue || 0), 0), [suppliers]);
  const customerDues = useMemo(() => customers.reduce((sum, c) => sum + (c.totalDue || 0), 0), [customers]);
  const liability = customerDues - supplierDues;
  const cashBalance = todayCashReceive - todayCashPayment;
  const lowStock = useMemo(() => getLowStockProducts(products), [products]);
  const totalStock = useMemo(() => products.reduce((s, p) => s + p.stock, 0), [products]);

  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const result: { day: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const dayTotal = sales.reduce((sum, s) => { try { return new Date(s.date).toDateString() === ds ? sum + s.total : sum; } catch { return sum; } }, 0);
      result.push({ day: days[d.getDay()], total: dayTotal });
    }
    return result;
  }, [sales]);

  const maxWeekly = Math.max(...weeklyData.map(d => d.total), 1);

  // Account balances from all sales
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = { cash: 0, bkash: 0, nagad: 0, card: 0, bank: 0 };
    sales.forEach(s => {
      const method = (s.paymentMethod || 'cash').toLowerCase();
      const paid = s.paid ?? s.total;
      if (method in balances) balances[method] += paid;
      else balances['cash'] += paid;
    });
    // Subtract purchase payments (assume cash)
    purchases.forEach(p => { balances['cash'] -= p.paid; });
    return balances;
  }, [sales, purchases]);
  const totalBalance = Object.values(accountBalances).reduce((s, v) => s + v, 0);

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('today')} — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('businessOverview')}</h2>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select onChange={e => { if (e.target.value) onNavigate(e.target.value); e.target.value = ''; }}
            className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" defaultValue="">
            <option value="" disabled>Quick Link</option>
            <option value="products">Products</option>
            <option value="purchase">Purchase</option>
            <option value="sales">Sales</option>
            <option value="customers">Customers</option>
            <option value="suppliers">Suppliers</option>
            <option value="reports">Reports</option>
            <option value="transactions">Transactions</option>
          </select>
          <button onClick={() => onNavigate('sales')} className="px-4 py-2 bg-pos-error text-white rounded-lg font-medium text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">list</span>{t('recentTransactions')}
          </button>
          <button onClick={() => onNavigate('inventory')} className="px-4 py-2 bg-pos-secondary text-white rounded-lg font-medium text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">layers</span>{t('stock')}
          </button>
          <button onClick={() => onNavigate('new-sale')} className="px-4 py-2 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium text-sm flex items-center gap-1 shadow-lg">
            <span className="material-symbols-outlined text-sm">add_shopping_cart</span>SALES
          </button>
        </div>
      </div>

      {/* 4 Summary Cards like reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PROFILE */}
        <div className="bg-pos-secondary rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-2xl">group</span>
            <span className="text-sm font-bold uppercase tracking-wider">PROFILE</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>{t('totalCustomers')}:</span><span className="font-bold">{customers.length}</span></div>
            <div className="flex justify-between"><span>{t('suppliers')}:</span><span className="font-bold">{suppliers.length}</span></div>
            <div className="flex justify-between"><span>{t('totalProducts')}:</span><span className="font-bold">{products.length}</span></div>
          </div>
        </div>

        {/* SALES TODAY */}
        <div className="bg-pos-secondary rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-2xl">shopping_cart</span>
            <span className="text-sm font-bold uppercase tracking-wider">{t('salesToday')}</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>{t('totalSales')} ({todayCount}):</span><span className="font-bold">{formatCurrency(todayTotal)}</span></div>
            <div className="flex justify-between"><span>Cash Sales:</span><span className="font-bold">{formatCurrency(todayCashSales)}</span></div>
            <div className="flex justify-between"><span>Dues Sales:</span><span className="font-bold">{formatCurrency(todayDueSales)}</span></div>
          </div>
        </div>

        {/* CASH TRX TODAY */}
        <div className="bg-pos-secondary rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
            <span className="text-sm font-bold uppercase tracking-wider">CASH TRX. TODAY</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Cash Receive:</span><span className="font-bold">{formatCurrency(todayCashReceive)}</span></div>
            <div className="flex justify-between"><span>Cash Payment:</span><span className="font-bold">{formatCurrency(todayCashPayment)}</span></div>
            <div className="flex justify-between"><span>Cash Balance:</span><span className="font-bold">{formatCurrency(cashBalance)}</span></div>
          </div>
        </div>

        {/* OVERALL BALANCE */}
        <div className="bg-pos-secondary rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-2xl">grid_view</span>
            <span className="text-sm font-bold uppercase tracking-wider">OVERALL BALANCE</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Supplier Dues:</span><span className="font-bold">{formatCurrency(supplierDues)}</span></div>
            <div className="flex justify-between"><span>Customer Dues:</span><span className="font-bold">{formatCurrency(customerDues)}</span></div>
            <div className="flex justify-between"><span>Liability:</span><span className="font-bold">{formatCurrency(liability)}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SALES PROGRESS */}
        <div className="lg:col-span-7 bg-pos-surface-lowest p-6 sm:p-8 rounded-xl border border-pos-surface-container">
          <div className="flex items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-pos-secondary">trending_up</span>
            <h3 className="text-lg font-semibold">{t('salesProgress')}</h3>
          </div>
          <div className="flex items-end justify-between h-40 gap-2 sm:gap-3 px-2">
            {weeklyData.map((d, i) => {
              const pct = Math.max(5, (d.total / maxWeekly) * 100);
              const isToday = i === 6;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-[9px] font-bold text-pos-on-surface-variant">{d.total > 0 ? formatCurrency(d.total) : ''}</div>
                  <div className={`w-full rounded-t-sm hover:brightness-90 cursor-pointer transition-all ${isToday ? 'bg-pos-secondary-dim' : 'bg-pos-secondary-container'}`} style={{ height: `${pct}%` }} />
                  <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-pos-secondary' : 'text-pos-on-surface-variant'}`}>{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* BALANCE TABLE */}
        <div className="lg:col-span-5 bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-pos-surface-container">
            <span className="material-symbols-outlined text-pos-secondary">account_balance</span>
            <h3 className="text-lg font-semibold">BALANCE</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
              <th className="px-6 py-2 text-left">ACCOUNT</th><th className="px-6 py-2 text-right">BALANCE</th>
            </tr></thead>
            <tbody className="divide-y divide-pos-surface-container">
              {[
                { name: 'Cash', value: accountBalances.cash },
                { name: 'Bank', value: accountBalances.bank || 0 },
                { name: 'bKash', value: accountBalances.bkash },
                { name: 'Nagad', value: accountBalances.nagad },
                { name: 'Card', value: accountBalances.card },
              ].map(acc => (
                <tr key={acc.name} className="hover:bg-pos-surface-low">
                  <td className="px-6 py-3 font-medium">{acc.name}</td>
                  <td className="px-6 py-3 text-right font-bold">{formatCurrency(acc.value)}</td>
                </tr>
              ))}
              <tr className="bg-pos-surface-low font-black">
                <td className="px-6 py-3">{t('total')}:</td>
                <td className="px-6 py-3 text-right text-pos-secondary">{formatCurrency(totalBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-pos-surface-lowest rounded-xl p-6 shadow-sm border border-pos-surface-container flex flex-col">
          <h3 className="text-base font-semibold mb-1">{t('lowStockAlert')}</h3>
          <p className="text-xs text-pos-on-surface-variant mb-5">{t('itemsNeedRestock')}</p>
          <div className="space-y-4 flex-1">
            {lowStock.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-pos-error-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-pos-on-error-container text-base">warning</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{item.name} {item.size}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 flex-1 bg-pos-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-pos-error rounded-full" style={{ width: `${Math.min(100, (item.stock / 50) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-pos-error font-bold ml-1">{item.stock} {t('boxes')}</span>
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
          <button onClick={() => onNavigate('inventory')} className="mt-5 w-full py-2 text-xs font-semibold text-pos-secondary border border-pos-secondary-container rounded-lg hover:bg-pos-secondary-container transition-colors">
            {t('viewAllInventory')}
          </button>
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-8 bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
          <div className="px-6 py-4 flex justify-between items-center bg-pos-surface-low">
            <h3 className="text-base font-semibold">{t('recentTransactions')}</h3>
            <button onClick={() => onNavigate('sales')} className="text-sm font-medium text-pos-secondary flex items-center gap-1 hover:underline">
              {t('viewAll')} <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
                  <th className="px-4 py-3">{t('invoice')}</th><th className="px-4 py-3">{t('customer')}</th><th className="px-4 py-3">{t('amount')}</th><th className="px-4 py-3 hidden sm:table-cell">{t('paid')}</th><th className="px-4 py-3 hidden sm:table-cell">{t('due')}</th><th className="px-4 py-3 text-right">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pos-surface-container">
                {sales.slice(0, 5).map((s) => {
                  const sdue = s.due ?? 0;
                  return (
                    <tr key={s.id} className="hover:bg-pos-surface-low transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-pos-secondary">{s.invoice}</td>
                      <td className="px-4 py-3 font-medium text-sm">{s.customer}</td>
                      <td className="px-4 py-3 font-bold">{formatCurrency(s.total)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-[hsl(125,60%,35%)] hidden sm:table-cell">{formatCurrency(s.paid ?? s.total)}</td>
                      <td className={`px-4 py-3 text-xs font-semibold hidden sm:table-cell ${sdue > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(sdue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${s.status === 'paid' ? 'bg-pos-tertiary-container text-pos-on-tertiary-container' : s.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-pos-secondary-container text-pos-on-secondary-container'}`}>
                          {s.status === 'paid' ? t('paid') : s.status === 'pending' ? t('pending') : t('credit')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {sales.length === 0 && (
                  <tr><td colSpan={6} className="px-8 py-8 text-center text-pos-on-surface-variant text-sm">{t('noSalesYetDash')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
