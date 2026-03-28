import { useState, useMemo, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { type Customer, type SaleRecord, formatCurrency } from "@/lib/store";
import { toast } from "sonner";

interface CustomersScreenProps {
  customers: Customer[];
  sales?: SaleRecord[];
  onAddCustomer: (name: string, phone: string, address: string) => void;
  onDeleteCustomer?: (id: string) => void;
  onUpdateCustomerDue?: (id: string, newDue: number) => void;
}

const colorMap: Record<string, string> = {
  secondary: 'bg-pos-secondary-container text-pos-on-secondary-container',
  tertiary: 'bg-pos-tertiary-container text-pos-on-tertiary-container',
  primary: 'bg-pos-primary-container text-pos-on-primary-container',
  error: 'bg-pos-error-container text-pos-on-error-container',
};

export default function CustomersScreen({ customers, sales = [], onAddCustomer, onDeleteCustomer, onUpdateCustomerDue }: CustomersScreenProps) {
  const { t } = useI18n();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCollectDue, setShowCollectDue] = useState<Customer | null>(null);
  const [collectAmount, setCollectAmount] = useState('');

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.address.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalDues = customers.reduce((s, c) => s + (c.totalDue || 0), 0);
  const avgSpend = customers.length > 0 ? Math.round(totalRevenue / customers.length) : 0;

  const handleSave = () => {
    if (!form.name) { toast.error(t('nameRequired')); return; }
    onAddCustomer(form.name, form.phone, form.address);
    toast.success(t('customerAdded'));
    setShowAdd(false);
    setForm({ name: '', phone: '', address: '' });
  };

  const handleDelete = (id: string) => {
    onDeleteCustomer?.(id);
    toast.success('Customer deleted');
    setShowDeleteConfirm(null);
  };

  const handleCollectDue = () => {
    if (!showCollectDue || !collectAmount) return;
    const amount = Number(collectAmount);
    if (amount <= 0 || amount > (showCollectDue.totalDue || 0)) {
      toast.error('Invalid amount');
      return;
    }
    const newDue = (showCollectDue.totalDue || 0) - amount;
    onUpdateCustomerDue?.(showCollectDue.id, newDue);
    toast.success(`৳${amount} collected from ${showCollectDue.name}`);
    setShowCollectDue(null);
    setCollectAmount('');
  };

  // Get customer's sales history
  const customerSales = useMemo(() => {
    if (!selectedCustomer) return [];
    return sales.filter(s => s.customer === selectedCustomer.name);
  }, [selectedCustomer, sales]);

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('crm')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('customers')}</h2>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">person_add</span>{t('addCustomer')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('totalCustomers')}</div>
          <div className="text-2xl font-black text-pos-on-surface">{customers.length}</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('totalRevenue')}</div>
          <div className="text-2xl font-black text-pos-secondary">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Dues</div>
          <div className="text-2xl font-black text-destructive">{formatCurrency(totalDues)}</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">{t('avgSpend')}</div>
          <div className="text-2xl font-black text-pos-tertiary">{formatCurrency(avgSpend)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">search</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-ring"
          placeholder="Search customers..." />
      </div>

      {/* Customer Table */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-4 sm:px-8 py-5 bg-pos-surface-low">
          <h3 className="text-base font-semibold">{t('allCustomers')} <span className="text-pos-on-surface-variant font-normal">({filtered.length})</span></h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
              <th className="px-4 sm:px-6 py-3">{t('customer')}</th>
              <th className="px-4 sm:px-6 py-3">{t('phoneLabel')}</th>
              <th className="px-4 sm:px-6 py-3 hidden sm:table-cell">{t('addressLabel')}</th>
              <th className="px-4 sm:px-6 py-3">{t('totalSpent')}</th>
              <th className="px-4 sm:px-6 py-3">Due</th>
              <th className="px-4 sm:px-6 py-3 hidden md:table-cell">{t('lastOrder')}</th>
              <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-pos-surface-container">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-pos-surface-low transition-colors cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${colorMap[c.color]}`}>{c.initials}</div>
                      <span className="font-semibold">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-pos-on-surface-variant">{c.phone}</td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-pos-on-surface-variant hidden sm:table-cell">{c.address}</td>
                  <td className="px-4 sm:px-6 py-4 font-bold text-pos-secondary">{formatCurrency(c.totalSpent)}</td>
                  <td className="px-4 sm:px-6 py-4 font-bold text-destructive">{(c.totalDue || 0) > 0 ? formatCurrency(c.totalDue) : '—'}</td>
                  <td className="px-4 sm:px-6 py-4 text-xs text-pos-on-surface-variant hidden md:table-cell">{c.lastOrder}</td>
                  <td className="px-4 sm:px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {(c.totalDue || 0) > 0 && (
                        <button onClick={() => { setShowCollectDue(c); setCollectAmount(''); }}
                          className="p-1.5 rounded-md hover:bg-green-100 text-green-600" title="Collect Due">
                          <span className="material-symbols-outlined text-sm">payments</span>
                        </button>
                      )}
                      <button onClick={() => setShowDeleteConfirm(c.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title="Delete">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
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

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[350px] shadow-2xl p-7 text-center" onClick={e => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-destructive mb-3">warning</span>
            <h3 className="text-lg font-bold mb-2">Delete Customer?</h3>
            <p className="text-sm text-muted-foreground mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-pos-surface-container rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 py-2.5 bg-destructive text-white rounded-lg font-semibold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Due Modal */}
      {showCollectDue && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowCollectDue(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[400px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Collect Due Payment</h3>
            <p className="text-sm text-muted-foreground mb-4">{showCollectDue.name} — Total Due: <span className="font-bold text-destructive">{formatCurrency(showCollectDue.totalDue || 0)}</span></p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Amount to Collect *</label>
                <input type="number" value={collectAmount} onChange={e => setCollectAmount(e.target.value)}
                  placeholder="Enter amount" max={showCollectDue.totalDue || 0}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" />
              </div>
              <div className="text-xs text-muted-foreground">
                Remaining after collection: <span className="font-bold">{formatCurrency(Math.max(0, (showCollectDue.totalDue || 0) - Number(collectAmount || 0)))}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCollectDue(null)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={handleCollectDue} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm">Collect</button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Sidebar */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/35 flex justify-end z-[1000]" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-pos-surface-lowest w-[95vw] max-w-[500px] h-full shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-pos-surface-container">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Customer Details</h3>
                <button onClick={() => setSelectedCustomer(null)} className="p-1.5 rounded-md hover:bg-pos-surface-container">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${colorMap[selectedCustomer.color]}`}>{selectedCustomer.initials}</div>
                <div>
                  <div className="text-lg font-bold">{selectedCustomer.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedCustomer.phone}</div>
                  <div className="text-xs text-muted-foreground">{selectedCustomer.address}</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 p-6">
              <div className="bg-pos-surface-high rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground uppercase font-bold">Spent</div>
                <div className="text-lg font-black text-pos-secondary">{formatCurrency(selectedCustomer.totalSpent)}</div>
              </div>
              <div className="bg-pos-surface-high rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground uppercase font-bold">Due</div>
                <div className="text-lg font-black text-destructive">{formatCurrency(selectedCustomer.totalDue || 0)}</div>
              </div>
              <div className="bg-pos-surface-high rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground uppercase font-bold">Orders</div>
                <div className="text-lg font-black">{customerSales.length}</div>
              </div>
            </div>

            {/* Due Sales */}
            {(selectedCustomer.totalDue || 0) > 0 && (
              <div className="px-6 mb-4">
                <button onClick={() => { setShowCollectDue(selectedCustomer); setCollectAmount(''); setSelectedCustomer(null); }}
                  className="w-full py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-lg">payments</span>
                  Collect Due ({formatCurrency(selectedCustomer.totalDue || 0)})
                </button>
              </div>
            )}

            {/* Sales History */}
            <div className="px-6 pb-6">
              <h4 className="text-sm font-bold uppercase text-muted-foreground mb-3">Sales History</h4>
              {customerSales.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No sales found</p>
              ) : (
                <div className="space-y-2">
                  {customerSales.map(s => (
                    <div key={s.id} className="bg-pos-surface-high rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-mono text-muted-foreground">{s.invoice}</div>
                        <div className="text-xs text-muted-foreground">{s.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{formatCurrency(s.total)}</div>
                        {(s.due ?? 0) > 0 && (
                          <div className="text-[10px] font-bold text-destructive">Due: {formatCurrency(s.due ?? 0)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
