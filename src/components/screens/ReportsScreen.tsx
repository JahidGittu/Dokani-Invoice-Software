import { toast } from "sonner";
import { formatCurrency, type SaleRecord } from "@/lib/store";

interface ReportsScreenProps {
  sales?: SaleRecord[];
}

export default function ReportsScreen({ sales = [] }: ReportsScreenProps) {
  return (
    <section className="p-8 max-w-7xl mx-auto space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Performance Overview</span>
          <h2 className="text-[3.5rem] font-bold text-pos-on-surface leading-tight tracking-tighter">Business Intelligence</h2>
        </div>
        <div className="flex gap-4">
          <button onClick={() => toast('Generating PDF export...')} className="px-6 py-3 bg-pos-primary-container text-pos-on-primary-container rounded-lg font-medium flex items-center gap-2 hover:bg-pos-surface-highest transition-colors">
            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>PDF Export
          </button>
          <button onClick={() => toast('Exporting to Excel...')} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
            <span className="material-symbols-outlined text-lg">file_download</span>Export to Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Monthly Revenue</div><div className="text-2xl font-black text-pos-on-surface">৳12,40,000</div><div className="text-xs text-pos-tertiary font-bold mt-1">↑ 8% vs last month</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Gross Profit</div><div className="text-2xl font-black text-pos-tertiary">৳2,87,500</div><div className="text-xs text-pos-on-surface-variant mt-1">Margin: 23.2%</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Orders</div><div className="text-2xl font-black text-pos-on-surface">347</div><div className="text-xs text-pos-tertiary font-bold mt-1">28 this week</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Avg. Ticket</div><div className="text-2xl font-black text-pos-on-surface">৳3,576</div><div className="text-xs text-pos-tertiary font-bold mt-1">↑ 5% growth</div></div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-8 bg-pos-surface-low p-8 rounded-xl">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h3 className="text-xl font-semibold mb-1">Daily Sales Performance</h3>
              <p className="text-sm text-pos-on-surface-variant">Last 7 days revenue tracking</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-pos-tertiary"><span className="material-symbols-outlined text-sm">trending_up</span>+12.5%</span>
          </div>
          <div className="flex items-end justify-between h-48 gap-4 px-4">
            {[40, 65, 55, 90, 75, 45, 30].map((h, i) => {
              const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-3">
                  <div className={`w-full rounded-t-sm hover:brightness-90 cursor-pointer ${i === 3 ? 'bg-pos-secondary-dim' : 'bg-pos-secondary-container'}`} style={{ height: `${h}%` }} />
                  <span className={`text-[10px] font-bold uppercase ${i === 3 ? 'text-pos-secondary' : 'text-pos-on-surface-variant'}`}>{days[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="col-span-4 bg-pos-surface-lowest p-8 rounded-xl shadow-sm flex flex-col items-center text-center">
          <h3 className="text-lg font-semibold mb-8">Category Mix</h3>
          <div className="relative w-48 h-48 mb-8">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(224 100% 92%)" strokeDasharray="60, 100" strokeWidth="4" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(132 100% 76%)" strokeDasharray="25, 100" strokeDashoffset="-60" strokeWidth="4" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(20 11% 89%)" strokeDasharray="15, 100" strokeDashoffset="-85" strokeWidth="4" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold">1.2k</span><span className="text-[10px] font-bold text-pos-on-surface-variant uppercase">Units Sold</span></div>
          </div>
          <div className="w-full space-y-3">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pos-secondary-container" /><span className="text-xs font-medium">Ceramics</span></div><span className="text-xs font-bold">60%</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pos-tertiary-container" /><span className="text-xs font-medium">Porcelain</span></div><span className="text-xs font-bold">25%</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pos-primary-container" /><span className="text-xs font-medium">Natural Stone</span></div><span className="text-xs font-bold">15%</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
