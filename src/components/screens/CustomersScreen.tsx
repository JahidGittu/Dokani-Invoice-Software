import { customers, formatCurrency } from "@/lib/data";
import { toast } from "sonner";

const colorMap: Record<string, string> = {
  secondary: 'bg-pos-secondary-container text-pos-on-secondary-container',
  tertiary: 'bg-pos-tertiary-container text-pos-on-tertiary-container',
  primary: 'bg-pos-primary-container text-pos-on-primary-container',
  error: 'bg-pos-error-container text-pos-on-error-container',
};

export default function CustomersScreen() {
  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">CRM</span>
          <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Customers</h2>
        </div>
        <button onClick={() => toast('Add Customer form opening...')} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">person_add</span>Add Customer
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Customers</div><div className="text-2xl font-black text-pos-on-surface">286</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Revenue</div><div className="text-2xl font-black text-pos-secondary">৳12,40,000</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Avg. Spend</div><div className="text-2xl font-black text-pos-tertiary">৳4,335</div></div>
      </div>
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-8 py-5 bg-pos-surface-low">
          <h3 className="text-base font-semibold">All Customers <span className="text-pos-on-surface-variant font-normal">(286)</span></h3>
        </div>
        <table className="w-full text-left">
          <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
            <th className="px-8 py-3">Customer</th><th className="px-8 py-3">Phone</th><th className="px-8 py-3">Address</th><th className="px-8 py-3">Total Spent</th><th className="px-8 py-3">Last Order</th><th className="px-8 py-3 text-right">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-pos-surface-container">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-pos-surface-low transition-colors">
                <td className="px-8 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${colorMap[c.color]}`}>{c.initials}</div>
                    <span className="font-semibold">{c.name}</span>
                  </div>
                </td>
                <td className="px-8 py-4 text-sm text-pos-on-surface-variant">{c.phone}</td>
                <td className="px-8 py-4 text-sm text-pos-on-surface-variant">{c.address}</td>
                <td className="px-8 py-4 font-bold text-pos-secondary">{formatCurrency(c.totalSpent)}</td>
                <td className="px-8 py-4 text-xs text-pos-on-surface-variant">{c.lastOrder}</td>
                <td className="px-8 py-4 text-right">
                  <button onClick={() => toast(`${c.name} order history loading...`)} className="text-pos-secondary text-xs font-semibold hover:underline">History</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
