import { useState } from "react";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const avgSpend = customers.length > 0 ? Math.round(totalRevenue / customers.length) : 0;

  const handleSave = () => {
    if (!form.name) { toast.error(t('nameRequired')); return; }
    onAddCustomer(form.name, form.phone, form.address);
    toast.success(t('customerAdded'));
    setShowAdd(false);
    setForm({ name: '', phone: '', address: '' });
  };

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('crm')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('customers')}</h2>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">person_add</span>{t('addCustomer')}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('totalCustomers')}</div><div className="text-2xl font-black text-pos-on-surface">{customers.length}</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('totalRevenue')}</div><div className="text-2xl font-black text-pos-secondary">{formatCurrency(totalRevenue)}</div></div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container"><div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('avgSpend')}</div><div className="text-2xl font-black text-pos-tertiary">{formatCurrency(avgSpend)}</div></div>
      </div>
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-4 sm:px-8 py-5 bg-pos-surface-low">
          <h3 className="text-base font-semibold">{t('allCustomers')} <span className="text-pos-on-surface-variant font-normal">({customers.length})</span></h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
              <th className="px-4 sm:px-8 py-3">{t('customer')}</th><th className="px-4 sm:px-8 py-3">{t('phoneLabel')}</th><th className="px-4 sm:px-8 py-3 hidden sm:table-cell">{t('addressLabel')}</th><th className="px-4 sm:px-8 py-3">{t('totalSpent')}</th><th className="px-4 sm:px-8 py-3 hidden md:table-cell">{t('lastOrder')}</th>
            </tr></thead>
            <tbody className="divide-y divide-pos-surface-container">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-pos-surface-low transition-colors">
                  <td className="px-4 sm:px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${colorMap[c.color]}`}>{c.initials}</div>
                      <span className="font-semibold">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-8 py-4 text-sm text-pos-on-surface-variant">{c.phone}</td>
                  <td className="px-4 sm:px-8 py-4 text-sm text-pos-on-surface-variant hidden sm:table-cell">{c.address}</td>
                  <td className="px-4 sm:px-8 py-4 font-bold text-pos-secondary">{formatCurrency(c.totalSpent)}</td>
                  <td className="px-4 sm:px-8 py-4 text-xs text-pos-on-surface-variant hidden md:table-cell">{c.lastOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowAdd(false)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[400px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">{t('addCustomer')}</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('name')} *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('phoneLabel')}</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('addressLabel')}</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
