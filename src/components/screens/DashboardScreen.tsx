import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getLowStockProducts, type Product, type Customer, type SaleRecord } from "@/lib/store";

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  products: Product[];
  customers: Customer[];
  sales: SaleRecord[];
}

export default function DashboardScreen({ onNavigate, products, customers, sales }: DashboardScreenProps) {
  const { t } = useI18n();
  const todayStr = new Date().toDateString();

  const { todayTotal, todayCount, todayPaid, todayDue, totalDueAll } = useMemo(() => {
    let total = 0, count = 0, paid = 0, due = 0;
    sales.forEach(s => {
      try {
        if (new Date(s.date).toDateString() === todayStr) {
          total += s.total; count++;
          paid += (s.paid ?? s.total);
          due += (s.due ?? 0);
        }
      } catch {}
    });
    const totalDueAll = sales.reduce((sum, s) => sum + (s.due ?? 0), 0);
    return { todayTotal: total, todayCount: count, todayPaid: paid, todayDue: due, totalDueAll };
  }, [sales, todayStr]);

  const customerDueTotal = useMemo(() => customers.reduce((sum, c) => sum + (c.totalDue || 0), 0), [customers]);
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

  const stats = [
    { label: t('todaysSales'), value: formatCurrency(todayTotal), icon: 'payments', iconBg: 'bg-pos-secondary-container', iconColor: 'text-pos-secondary', trend: `${todayCount} ${t('salesToday')}`, trendColor: 'text-pos-tertiary' },
    { label: t('paid'), value: formatCurrency(todayPaid), icon: 'check_circle', iconBg: 'bg-[hsl(125,40%,90%)]', iconColor: 'text-[hsl(125,60%,35%)]', trend: t('todaysSales'), trendColor: 'text-[hsl(125,60%,35%)]' },
    { label: t('totalDue'), value: formatCurrency(totalDueAll), icon: 'warning', iconBg: 'bg-pos-error-container', iconColor: 'text-pos-error', trend: `${t('customers')}: ${formatCurrency(customerDueTotal)}`, trendColor: 'text-pos-error' },
    { label: t('totalStock'), value: totalStock.toLocaleString(), icon: 'layers', iconBg: 'bg-pos-primary-container', iconColor: 'text-pos-on-primary-container', trend: `${lowStock.length} ${t('lowStock')}`, trendColor: lowStock.length > 0 ? 'text-pos-error' : 'text-pos-on-surface-variant' },
  ];

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('today')} — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('businessOverview')}</h2>
        </div>
        <button onClick={() => onNavigate('new-sale')} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">add_shopping_cart</span> {t('newSale')}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-pos-surface-container">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] sm:text-xs font-bold text-pos-on-surface-variant uppercase tracking-widest">{s.label}</span>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 ${s.iconBg} rounded-lg flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.iconColor} text-base sm:text-lg`}>{s.icon}</span>
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-black tracking-tighter text-pos-on-surface">{s.value}</div>
            <div className={`mt-2 flex items-center gap-1 ${s.trendColor} text-[10px] sm:text-xs font-bold`}>
              <span className="material-symbols-outlined text-sm">trending_up</span>{s.trend}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-pos-surface-low p-6 sm:p-8 rounded-xl">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-lg font-semibold mb-1">{t('weeklySales')}</h3>
              <p className="text-sm text-pos-on-surface-variant">{t('last7Days')}</p>
            </div>
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
      </div>

      {/* Recent Sales */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-6 sm:px-8 py-5 flex justify-between items-center bg-pos-surface-low">
          <h3 className="text-base font-semibold">{t('recentTransactions')}</h3>
          <button onClick={() => onNavigate('sales')} className="text-sm font-medium text-pos-secondary flex items-center gap-1 hover:underline">
            {t('viewAll')} <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
                <th className="px-6 sm:px-8 py-3">{t('invoice')}</th><th className="px-6 sm:px-8 py-3">{t('customer')}</th><th className="px-6 sm:px-8 py-3 hidden sm:table-cell">{t('items')}</th><th className="px-6 sm:px-8 py-3">{t('amount')}</th><th className="px-6 sm:px-8 py-3 hidden md:table-cell">{t('time')}</th><th className="px-6 sm:px-8 py-3 text-right">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {sales.slice(0, 5).map((s) => (
                <tr key={s.id} className="hover:bg-pos-surface-low transition-colors">
                  <td className="px-6 sm:px-8 py-4 font-mono text-xs font-bold text-pos-secondary">{s.invoice}</td>
                  <td className="px-6 sm:px-8 py-4 font-medium text-sm">{s.customer}</td>
                  <td className="px-6 sm:px-8 py-4 text-sm text-pos-on-surface-variant hidden sm:table-cell">{s.items.map(i => i.name).join(', ')}</td>
                  <td className="px-6 sm:px-8 py-4 font-bold">{formatCurrency(s.total)}</td>
                  <td className="px-6 sm:px-8 py-4 text-xs text-pos-on-surface-variant hidden md:table-cell">{s.time}</td>
                  <td className="px-6 sm:px-8 py-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${s.status === 'paid' ? 'bg-pos-tertiary-container text-pos-on-tertiary-container' : s.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-pos-secondary-container text-pos-on-secondary-container'}`}>
                      {s.status === 'paid' ? t('paid') : s.status === 'pending' ? t('pending') : t('credit')}
                    </span>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr><td colSpan={6} className="px-8 py-8 text-center text-pos-on-surface-variant text-sm">{t('noSalesYetDash')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
