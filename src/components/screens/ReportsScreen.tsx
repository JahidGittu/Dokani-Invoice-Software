import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { formatCurrency, downloadCSV, type SaleRecord, type Product, type Customer } from "@/lib/store";

interface ReportsScreenProps {
  sales?: SaleRecord[];
  products?: Product[];
  customers?: Customer[];
}

export default function ReportsScreen({ sales = [], products = [], customers = [] }: ReportsScreenProps) {
  const { t } = useI18n();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'profit' | 'due'>('overview');

  const filteredSales = useMemo(() => {
    if (!dateFrom && !dateTo) return sales;
    return sales.filter(s => {
      try {
        const d = new Date(s.date);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      } catch { return true; }
    });
  }, [sales, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthlySales = filteredSales.filter(s => { try { const d = new Date(s.date); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; } catch { return false; } });
    const monthlyRevenue = monthlySales.reduce((s, sale) => s + sale.total, 0);
    const totalOrders = monthlySales.length;
    const avgTicket = totalOrders > 0 ? Math.round(monthlyRevenue / totalOrders) : 0;
    const totalPaid = filteredSales.reduce((s, sale) => s + (sale.paid ?? sale.total), 0);
    const totalDue = filteredSales.reduce((s, sale) => s + (sale.due ?? 0), 0);
    const totalRevenue = filteredSales.reduce((s, sale) => s + sale.total, 0);

    // Profit calculation (needs buyRate)
    let totalCost = 0;
    filteredSales.forEach(s => s.items.forEach(item => {
      const p = products.find(pr => pr.id === item.productId);
      totalCost += (p?.buyRate || 0) * item.qty;
    }));
    const totalProfit = totalRevenue - totalCost;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData: { day: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const dayTotal = filteredSales.reduce((sum, s) => { try { return new Date(s.date).toDateString() === ds ? sum + s.total : sum; } catch { return sum; } }, 0);
      weeklyData.push({ day: days[d.getDay()], total: dayTotal });
    }

    const productSales: Record<string, number> = {};
    monthlySales.forEach(s => s.items.forEach(item => { productSales[item.name] = (productSales[item.name] || 0) + (item.qty * item.price); }));
    const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const totalProductRevenue = Object.values(productSales).reduce((s, v) => s + v, 0) || 1;

    // Due customers
    const dueCustomers = customers.filter(c => (c.totalDue || 0) > 0).sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0));

    return { monthlyRevenue, totalOrders, avgTicket, weeklyData, topProducts, totalProductRevenue, totalPaid, totalDue, totalRevenue, totalProfit, totalCost, dueCustomers };
  }, [filteredSales, products, customers]);

  const maxWeekly = Math.max(...stats.weeklyData.map(d => d.total), 1);

  const exportReport = () => {
    const rows = [['Metric', 'Value'], [t('monthlyRevenue'), String(stats.monthlyRevenue)], [t('totalOrders'), String(stats.totalOrders)], [t('avgTicket'), String(stats.avgTicket)], ['Total Paid', String(stats.totalPaid)], ['Total Due', String(stats.totalDue)], ['Profit', String(stats.totalProfit)], [t('totalProducts'), String(products.length)], [t('totalCustomers'), String(customers.length)]];
    downloadCSV(rows, 'report_export.csv');
    toast.success(t('reportExported'));
  };

  const colors = ['bg-pos-secondary-container', 'bg-pos-tertiary-container', 'bg-pos-primary-container', 'bg-pos-error-container', 'bg-pos-surface-container'];
  const tabs = [
    { id: 'overview' as const, label: t('businessOverview'), icon: 'dashboard' },
    { id: 'profit' as const, label: 'Profit', icon: 'trending_up' },
    { id: 'due' as const, label: t('totalDue'), icon: 'warning' },
  ];

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('performanceOverview')}</span>
          <h2 className="text-3xl sm:text-[3.5rem] font-bold text-pos-on-surface leading-tight tracking-tighter">{t('businessIntelligence')}</h2>
        </div>
        <button onClick={exportReport} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">file_download</span>{t('exportReport')}
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-pos-surface-lowest border border-pos-surface-container rounded-lg px-3 py-2">
          <span className="material-symbols-outlined text-pos-on-surface-variant text-sm">calendar_today</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-sm outline-none" />
          <span className="text-pos-on-surface-variant text-xs">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-sm outline-none" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-pos-error font-bold hover:underline">{t('clear')}</button>
        )}
        <div className="flex gap-1 ml-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${activeTab === tab.id ? 'bg-pos-secondary text-white' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('monthlyRevenue')}</div><div className="text-2xl font-black text-pos-on-surface">{formatCurrency(stats.monthlyRevenue)}</div><div className="text-xs text-pos-tertiary font-bold mt-1">{stats.totalOrders} {t('orders')}</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('paid')}</div><div className="text-2xl font-black text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalPaid)}</div><div className="text-xs text-pos-on-surface-variant mt-1">{filteredSales.length} {t('transactions')}</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('totalDue')}</div><div className="text-2xl font-black text-destructive">{formatCurrency(stats.totalDue)}</div><div className="text-xs text-pos-on-surface-variant mt-1">{stats.dueCustomers.length} {t('customers')}</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Profit</div><div className={`text-2xl font-black ${stats.totalProfit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(stats.totalProfit)}</div><div className="text-xs text-pos-on-surface-variant mt-1">Cost: {formatCurrency(stats.totalCost)}</div></div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-pos-surface-low p-6 sm:p-8 rounded-xl">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h3 className="text-xl font-semibold mb-1">{t('dailySalesPerformance')}</h3>
                <p className="text-sm text-pos-on-surface-variant">{t('last7Days')}</p>
              </div>
            </div>
            <div className="flex items-end justify-between h-48 gap-3 sm:gap-4 px-2 sm:px-4">
              {stats.weeklyData.map((d, i) => {
                const pct = Math.max(5, (d.total / maxWeekly) * 100);
                const isToday = i === 6;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-3">
                    <div className="text-[9px] font-bold text-pos-on-surface-variant">{d.total > 0 ? formatCurrency(d.total) : ''}</div>
                    <div className={`w-full rounded-t-sm hover:brightness-90 cursor-pointer transition-all ${isToday ? 'bg-pos-secondary-dim' : 'bg-pos-secondary-container'}`} style={{ height: `${pct}%` }} />
                    <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-pos-secondary' : 'text-pos-on-surface-variant'}`}>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="lg:col-span-4 bg-pos-surface-lowest p-6 sm:p-8 rounded-xl shadow-sm border border-pos-surface-container">
            <h3 className="text-lg font-semibold mb-6">{t('topProducts')}</h3>
            {stats.topProducts.length > 0 ? (
              <div className="space-y-4">
                {stats.topProducts.map(([name, revenue], i) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate mr-2">{name}</span>
                      <span className="font-bold text-pos-secondary">{formatCurrency(revenue)}</span>
                    </div>
                    <div className="h-2 bg-pos-surface-container rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[i] || colors[0]}`} style={{ width: `${(revenue / stats.totalProductRevenue) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-pos-on-surface-variant">{t('noSalesDataMonth')}</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'profit' && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-6">
          <h3 className="text-lg font-semibold mb-4">Profit Report</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                <th className="px-4 py-3">{t('products')}</th><th className="px-4 py-3 text-center">Sold Qty</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Profit</th>
              </tr></thead>
              <tbody className="divide-y divide-pos-surface-container">
                {products.map(p => {
                  const soldQty = filteredSales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((sq, i) => sq + i.qty, 0), 0);
                  if (soldQty === 0) return null;
                  const revenue = filteredSales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((sr, i) => sr + i.qty * i.price, 0), 0);
                  const cost = soldQty * (p.buyRate || 0);
                  const profit = revenue - cost;
                  return (
                    <tr key={p.id} className="hover:bg-pos-surface-low">
                      <td className="px-4 py-3 font-semibold">{p.name} <span className="text-[10px] text-pos-on-surface-variant">{p.size}</span></td>
                      <td className="px-4 py-3 text-center">{soldQty}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(revenue)}</td>
                      <td className="px-4 py-3 text-right text-pos-on-surface-variant">{formatCurrency(cost)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${profit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'due' && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-6">
          <h3 className="text-lg font-semibold mb-4">{t('totalDue')} Report</h3>
          <div className="space-y-3">
            {stats.dueCustomers.length > 0 ? stats.dueCustomers.map(c => (
              <div key={c.id} className="flex items-center justify-between p-4 bg-pos-surface-low rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                    <span className="text-xs font-bold text-pos-on-error-container">{c.initials}</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm">{c.name}</div>
                    <div className="text-[10px] text-pos-on-surface-variant">{c.phone}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-destructive">{formatCurrency(c.totalDue || 0)}</div>
                  <div className="text-[10px] text-pos-on-surface-variant">Total: {formatCurrency(c.totalSpent)}</div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-pos-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-3xl text-[hsl(125,60%,35%)] block mb-2">check_circle</span>
                No outstanding dues!
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
