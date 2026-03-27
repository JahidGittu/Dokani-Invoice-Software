import { useMemo } from "react";
import { toast } from "sonner";
import { formatCurrency, downloadCSV, type SaleRecord, type Product, type Customer } from "@/lib/store";

interface ReportsScreenProps {
  sales?: SaleRecord[];
  products?: Product[];
  customers?: Customer[];
}

export default function ReportsScreen({ sales = [], products = [], customers = [] }: ReportsScreenProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthlySales = sales.filter(s => {
      try { const d = new Date(s.date); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; } catch { return false; }
    });
    const monthlyRevenue = monthlySales.reduce((s, sale) => s + sale.total, 0);
    const totalOrders = monthlySales.length;
    const avgTicket = totalOrders > 0 ? Math.round(monthlyRevenue / totalOrders) : 0;

    // Weekly for chart
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData: { day: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const dayTotal = sales.reduce((sum, s) => {
        try { return new Date(s.date).toDateString() === ds ? sum + s.total : sum; } catch { return sum; }
      }, 0);
      weeklyData.push({ day: days[d.getDay()], total: dayTotal });
    }

    // Product breakdown
    const productSales: Record<string, number> = {};
    monthlySales.forEach(s => s.items.forEach(item => {
      productSales[item.name] = (productSales[item.name] || 0) + (item.qty * item.price);
    }));
    const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const totalProductRevenue = Object.values(productSales).reduce((s, v) => s + v, 0) || 1;

    return { monthlyRevenue, totalOrders, avgTicket, weeklyData, topProducts, totalProductRevenue, monthlySales };
  }, [sales]);

  const maxWeekly = Math.max(...stats.weeklyData.map(d => d.total), 1);

  const exportReport = () => {
    const rows = [['Metric', 'Value'],
      ['Monthly Revenue', String(stats.monthlyRevenue)],
      ['Total Orders', String(stats.totalOrders)],
      ['Avg. Ticket', String(stats.avgTicket)],
      ['Total Products', String(products.length)],
      ['Total Customers', String(customers.length)],
    ];
    downloadCSV(rows, 'report_export.csv');
    toast.success('Report exported!');
  };

  const colors = ['bg-pos-secondary-container', 'bg-pos-tertiary-container', 'bg-pos-primary-container', 'bg-pos-error-container', 'bg-pos-surface-container'];

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Performance Overview</span>
          <h2 className="text-3xl sm:text-[3.5rem] font-bold text-pos-on-surface leading-tight tracking-tighter">Business Intelligence</h2>
        </div>
        <button onClick={exportReport} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">file_download</span>Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Monthly Revenue</div><div className="text-2xl font-black text-pos-on-surface">{formatCurrency(stats.monthlyRevenue)}</div><div className="text-xs text-pos-tertiary font-bold mt-1">{stats.totalOrders} orders</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Sales (all time)</div><div className="text-2xl font-black text-pos-secondary">{formatCurrency(sales.reduce((s, sale) => s + sale.total, 0))}</div><div className="text-xs text-pos-on-surface-variant mt-1">{sales.length} transactions</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Orders</div><div className="text-2xl font-black text-pos-on-surface">{stats.totalOrders}</div><div className="text-xs text-pos-tertiary font-bold mt-1">This month</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Avg. Ticket</div><div className="text-2xl font-black text-pos-on-surface">{formatCurrency(stats.avgTicket)}</div><div className="text-xs text-pos-on-surface-variant mt-1">{customers.length} customers</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-pos-surface-low p-6 sm:p-8 rounded-xl">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-xl font-semibold mb-1">Daily Sales Performance</h3>
              <p className="text-sm text-pos-on-surface-variant">Last 7 days revenue</p>
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
          <h3 className="text-lg font-semibold mb-6">Top Products</h3>
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
            <div className="text-xs text-pos-on-surface-variant">No sales data yet this month.</div>
          )}
        </div>
      </div>
    </section>
  );
}
