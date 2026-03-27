import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, type Supplier } from "@/lib/store";
import { toast } from "sonner";

interface SupplierScreenProps {
  suppliers: Supplier[];
  onAddSupplier: (name: string, phone: string, address: string) => void;
  onDeleteSupplier: (id: string) => void;
}

export default function SupplierScreen({ suppliers, onAddSupplier, onDeleteSupplier }: SupplierScreenProps) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    onAddSupplier(name, phone, address);
    toast.success(t('supplierAdded'));
    setName(''); setPhone(''); setAddress(''); setShowForm(false);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) { onDeleteSupplier(showDeleteConfirm); toast.success(t('supplierDeleted')); }
    setShowDeleteConfirm(null);
  };

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('supplierLabel')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('suppliers')}</h2>
        </div>
        <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span>{t('addSupplier')}
        </button>
      </div>

      {showForm && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-6 space-y-4">
          <h3 className="text-lg font-bold">{t('addSupplier')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('name')} className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('phoneLabel')} className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder={t('address')} className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-6 py-2 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
            <button onClick={handleAdd} className="px-6 py-2 bg-pos-secondary text-white rounded-lg font-semibold text-sm">{t('saveSale')}</button>
          </div>
        </div>
      )}

      {/* Supplier List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(s => (
          <div key={s.id} className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pos-secondary-container flex items-center justify-center">
                  <span className="text-xs font-bold text-pos-on-secondary-container">{s.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <div className="font-bold text-sm">{s.name}</div>
                  <div className="text-[10px] text-pos-on-surface-variant">{s.phone}</div>
                </div>
              </div>
              <button onClick={() => setShowDeleteConfirm(s.id)} className="text-pos-error hover:underline text-xs">{t('delete')}</button>
            </div>
            {s.address && <div className="text-xs text-pos-on-surface-variant mb-2">📍 {s.address}</div>}
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-pos-on-surface-variant uppercase">{t('totalDue')}</span>
              <span className={`font-bold text-sm ${(s.totalDue || 0) > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(s.totalDue || 0)}</span>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && (
          <div className="col-span-full text-center py-12 text-pos-on-surface-variant text-sm">{t('noProducts')}</div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{t('delete')}</h3>
            <p className="text-sm text-pos-on-surface-variant mb-6">Are you sure?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
