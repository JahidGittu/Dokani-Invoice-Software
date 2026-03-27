import { useState } from "react";
import { type Customer, formatCurrency } from "@/lib/store";
import { toast } from "sonner";

interface CustomersScreenProps {
  customers: Customer[];
  onAddCustomer: (name: string, phone: string, address: string) => void;
  onDeleteCustomer?: (id: string) => void;
}

const colorMap: Record<string, string> = {
  secondary: 'bg-pos-secondary-container text-pos-on-secondary-container',
  tertiary: 'bg-pos-tertiary-container text-pos-on-tertiary-container',
  primary: 'bg-pos-primary-container text-pos-on-primary-container',
  error: 'bg-pos-error-container text-pos-on-error-container',
};

export default function CustomersScreen({ customers, onAddCustomer }: CustomersScreenProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const avgSpend = customers.length > 0 ? Math.round(totalRevenue / customers.length) : 0;

  const handleSave = () => {
    if (!form.name) { toast.error('Name required!'); return; }
    onAddCustomer(form.name, form.phone, form.address);
    toast.success('Customer added!');
    setShowAdd(false);
    setForm({ name: '', phone: '', address: '' });
  };

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">CRM</span>
          <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Customers</h2>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">person_add</span>Add Customer
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Customers</div><div className="text-2xl font-black text-pos-on-surface">{customers.length}</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Revenue</div><div className="text-2xl font-black text-pos-secondary">{formatCurrency(totalRevenue)}</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Avg. Spend</div><div className="text-2xl font-black text-pos-tertiary">{formatCurrency(avgSpend)}</div></div>
      </div>
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-8 py-5 bg-pos-surface-low">
          <h3 className="text-base font-semibold">All Customers <span className="text-pos-on-surface-variant font-normal">({customers.length})</span></h3>
        </div>
        <table className="w-full text-left">
          <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
            <th className="px-8 py-3">Customer</th><th className="px-8 py-3">Phone</th><th className="px-8 py-3">Address</th><th className="px-8 py-3">Total Spent</th><th className="px-8 py-3">Last Order</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowAdd(false)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[400px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Add Customer</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Address</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
