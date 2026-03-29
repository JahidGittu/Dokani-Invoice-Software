import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, type Supplier } from "@/lib/store";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface SupplierScreenProps {
  suppliers: Supplier[];
  onAddSupplier: (name: string, phone: string, address: string, contactPerson?: string) => void;
  onDeleteSupplier: (id: string) => void;
}

export default function SupplierScreen({ suppliers, onAddSupplier, onDeleteSupplier }: SupplierScreenProps) {
  const { t } = useI18n();
  const [view, setView] = useState<'list' | 'add'>('list');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim()) { toast.error('Supplier name required'); return; }
    onAddSupplier(name, phone, address, contactPerson);
    toast.success(t('supplierAdded'));
    resetForm();
  };

  const resetForm = () => {
    setName(''); setContactPerson(''); setPhone(''); setAddress(''); setOpeningBalance('');
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) { onDeleteSupplier(showDeleteConfirm); toast.success(t('supplierDeleted')); }
    setShowDeleteConfirm(null);
  };

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header with buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-1">{t('supplierLabel')}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('suppliers')}</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setView('add')}
            className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 text-sm transition-all ${
              view === 'add'
                ? 'bg-pos-secondary text-white shadow-lg'
                : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'
            }`}
          >
            <span className="material-symbols-outlined text-lg">add</span>
            {t('addSupplier')}
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 text-sm transition-all ${
              view === 'list'
                ? 'bg-pos-secondary text-white shadow-lg'
                : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'
            }`}
          >
            <span className="material-symbols-outlined text-lg">list</span>
            Supplier List
          </button>
        </div>
      </div>

      {/* Add Supplier Form - visible in 'add' view */}
      {view === 'add' && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-6 space-y-5">
          <div className="flex items-center gap-2 text-pos-secondary font-semibold text-sm">
            <span>Supplier</span>
            <span className="text-pos-on-surface-variant">›</span>
            <span>Supplier Entry</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Supplier *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Mir Ceramic Limited"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Contact Person</label>
              <input
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="Dealer / Salesman name"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Address</label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Address"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Mobile</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-pos-on-surface">Opening Balance</label>
              <input
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
                type="number"
                placeholder="0"
                className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none focus:border-pos-secondary transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAdd}
              className="px-6 py-2.5 bg-[hsl(125,60%,35%)] hover:bg-[hsl(125,60%,30%)] text-white rounded-lg font-semibold text-sm transition-colors"
            >
              Save
            </button>
            <button
              onClick={resetForm}
              className="px-6 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm hover:bg-pos-surface-high transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Supplier Table */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-pos-surface-container/50">
              <TableHead className="w-12 text-center font-bold">#</TableHead>
              <TableHead className="font-bold">Supplier</TableHead>
              <TableHead className="font-bold">Contact Person</TableHead>
              <TableHead className="font-bold">Mobile</TableHead>
              <TableHead className="text-right font-bold">Balance</TableHead>
              <TableHead className="text-center font-bold w-28">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-pos-on-surface-variant text-sm">
                  No suppliers found. Add your first supplier.
                </TableCell>
              </TableRow>
            )}
            {suppliers.map((s, idx) => (
              <TableRow key={s.id} className="hover:bg-pos-surface-container/30">
                <TableCell className="text-center font-medium text-pos-on-surface-variant">{idx + 1}</TableCell>
                <TableCell className="font-semibold">{s.name}</TableCell>
                <TableCell className="text-pos-on-surface-variant">{s.contactPerson || '—'}</TableCell>
                <TableCell className="text-pos-on-surface-variant">{s.phone || '—'}</TableCell>
                <TableCell className={`text-right font-bold ${(s.totalDue || 0) > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>
                  {formatCurrency(s.totalDue || 0)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="text-pos-secondary hover:underline text-xs font-medium"
                      onClick={() => {/* TODO: edit */}}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(s.id)}
                      className="text-pos-error hover:underline text-xs font-medium"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{t('delete')}</h3>
            <p className="text-sm text-pos-on-surface-variant mb-6">Are you sure you want to delete this supplier?</p>
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
