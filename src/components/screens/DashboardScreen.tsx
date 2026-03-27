import { recentSales, formatCurrency } from "@/lib/data";

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
}

export default function DashboardScreen({ onNavigate }: DashboardScreenProps) {
  const stats = [
    { label: "Today's Sales", value: '৳42,500', icon: 'payments', iconBg: 'bg-pos-secondary-container', iconColor: 'text-pos-secondary', trend: '+12% vs yesterday', trendColor: 'text-pos-tertiary' },
    { label: 'Total Products', value: '124', icon: 'inventory_2', iconBg: 'bg-pos-tertiary-container', iconColor: 'text-pos-tertiary', trend: '3 added this week', trendColor: 'text-pos-tertiary' },
    { label: 'Total Stock', value: '3,847', icon: 'layers', iconBg: 'bg-pos-primary-container', iconColor: 'text-pos-on-primary-container', trend: '89 sold today', trendColor: 'text-pos-on-surface-variant' },
    { label: 'Customers', value: '286', icon: 'group', iconBg: 'bg-pos-secondary-container', iconColor: 'text-pos-secondary', trend: '7 new this month', trendColor: 'text-pos-tertiary' },
  ];

  const barHeights = [40, 65, 55, 90, 75, 45, 58];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Today — March 27, 2026</span>
          <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Business Overview</h2>
        </div>
        <button onClick={() => onNavigate('sales')} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">add_shopping_cart</span> New Sale
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-pos-surface-lowest rounded-xl p-6 shadow-sm border border-pos-surface-container">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-pos-on-surface-variant uppercase tracking-widest">{s.label}</span>
              <div className={`w-9 h-9 ${s.iconBg} rounded-lg flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.iconColor} text-lg`}>{s.icon}</span>
              </div>
            </div>
            <div className="text-3xl font-black tracking-tighter text-pos-on-surface">{s.value}</div>
            <div className={`mt-2 flex items-center gap-1 ${s.trendColor} text-xs font-bold`}>
              <span className="material-symbols-outlined text-sm">trending_up</span>{s.trend}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 bg-pos-surface-low p-8 rounded-xl">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-lg font-semibold mb-1">Weekly Sales Performance</h3>
              <p className="text-sm text-pos-on-surface-variant">Last 7 days revenue</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-pos-tertiary">
              <span className="material-symbols-outlined text-sm">trending_up</span>+12.5%
            </span>
          </div>
          <div className="flex items-end justify-between h-40 gap-3 px-2">
            {days.map((day, i) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full rounded-t-sm hover:brightness-90 cursor-pointer ${i === 3 ? 'bg-pos-secondary-dim' : 'bg-pos-secondary-container'}`}
                  style={{ height: `${barHeights[i]}%` }}
                />
                <span className={`text-[10px] font-bold uppercase ${i === 3 || i === 6 ? 'text-pos-secondary' : 'text-pos-on-surface-variant'}`}>{day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-4 bg-pos-surface-lowest rounded-xl p-6 shadow-sm border border-pos-surface-container flex flex-col">
          <h3 className="text-base font-semibold mb-1">Low Stock Alert</h3>
          <p className="text-xs text-pos-on-surface-variant mb-5">Items needing restock</p>
          <div className="space-y-4 flex-1">
            {[
              { name: 'Pearl White 30×30', pct: 8, boxes: 8, isError: true },
              { name: 'Ivory Stone 12×24', pct: 12, boxes: 12, isError: true },
              { name: 'Sand Beige 12×12', pct: 18, boxes: 18, isError: false },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${item.isError ? 'bg-pos-error-container' : 'bg-pos-tertiary-container'} flex items-center justify-center flex-shrink-0`}>
                  <span className={`material-symbols-outlined ${item.isError ? 'text-pos-on-error-container' : 'text-pos-on-tertiary-container'} text-base`}>{item.isError ? 'warning' : 'info'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{item.name}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 flex-1 bg-pos-surface-container rounded-full overflow-hidden">
                      <div className={`h-full ${item.isError ? 'bg-pos-error' : 'bg-pos-tertiary'} rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                    <span className={`text-[10px] ${item.isError ? 'text-pos-error' : 'text-pos-tertiary'} font-bold ml-1`}>{item.boxes} boxes</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate('inventory')} className="mt-5 w-full py-2 text-xs font-semibold text-pos-secondary border border-pos-secondary-container rounded-lg hover:bg-pos-secondary-container transition-colors">
            View All Inventory
          </button>
        </div>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-8 py-5 flex justify-between items-center bg-pos-surface-low">
          <h3 className="text-base font-semibold">Recent Transactions</h3>
          <button onClick={() => onNavigate('sales')} className="text-sm font-medium text-pos-secondary flex items-center gap-1 hover:underline">
            View All <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
              <th className="px-8 py-3">Invoice</th><th className="px-8 py-3">Customer</th><th className="px-8 py-3">Product</th><th className="px-8 py-3">Amount</th><th className="px-8 py-3">Time</th><th className="px-8 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pos-surface-container">
            {recentSales.map((s) => (
              <tr key={s.id} className="hover:bg-pos-surface-low transition-colors">
                <td className="px-8 py-4 font-mono text-xs font-bold text-pos-secondary">{s.invoice}</td>
                <td className="px-8 py-4 font-medium">{s.customer}</td>
                <td className="px-8 py-4 text-sm text-pos-on-surface-variant">{s.product}</td>
                <td className="px-8 py-4 font-bold">{formatCurrency(s.amount)}</td>
                <td className="px-8 py-4 text-xs text-pos-on-surface-variant">{s.time}</td>
                <td className="px-8 py-4 text-right">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${s.status === 'Paid' ? 'bg-pos-tertiary-container text-pos-on-tertiary-container' : 'bg-pos-surface-container text-pos-on-surface-variant'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
