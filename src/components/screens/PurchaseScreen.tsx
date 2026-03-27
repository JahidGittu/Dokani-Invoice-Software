import { useState, useMemo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextPurchaseNumber, type Product, type Supplier, type PurchaseRecord, type PurchaseItem } from "@/lib/store";
import ComboInput from "@/components/ComboInput";
import { toast } from "sonner";

interface PurchaseScreenProps {
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  onAddPurchase: (p: PurchaseRecord) => void;
  onDeletePurchase: (id: string) => void;
  onAddStock: (items: { productId: string; qty: number }[]) => void;
  onUpdateSupplierDue: (name: string, dueAmount: number) => void;
}

const PAGE_SIZES = [10, 25, 50, 100];

type SortField = 'invoice' | 'date' | 'supplierName' | 'qty' | 'payable' | 'paid' | 'due';

export default function PurchaseScreen({ products, suppliers, purchases, onAddPurchase, onDeletePurchase, onAddStock, onUpdateSupplierDue }: PurchaseScreenProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  // Sort
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };
  const sortIcon = (field: SortField) => sortField === field ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';

  // Form state
  const [supplierName, setSupplierName] = useState('');
  const [discount, setDiscount] = useState('');
  const [delivery, setDelivery] = useState('');
  const [paid, setPaid] = useState('');
  const [remark, setRemark] = useState('');
  const [rows, setRows] = useState<{ id: number; productId: string; qty: number; rate: number }[]>([{ id: Date.now(), productId: '', qty: 1, rate: 0 }]);

  const debouncedSearch = useDebounce(search, 250);
  const filtered = useMemo(() => {
    const list = purchases.filter(p =>
      p.invoice.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'invoice') cmp = a.invoice.localeCompare(b.invoice);
      else if (sortField === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === 'supplierName') cmp = a.supplierName.localeCompare(b.supplierName);
      else if (sortField === 'qty') cmp = a.items.reduce((s, i) => s + i.carton, 0) - b.items.reduce((s, i) => s + i.carton, 0);
      else if (sortField === 'payable') cmp = a.payable - b.payable;
      else if (sortField === 'paid') cmp = a.paid - b.paid;
      else if (sortField === 'due') cmp = a.due - b.due;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [purchases, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => filtered.slice(page * pageSize, (page + 1) * pageSize), [filtered, page, pageSize]);

  // Form helpers
  const addRow = () => setRows(prev => [...prev, { id: Date.now(), productId: '', qty: 1, rate: 0 }]);
  const removeRow = (id: number) => setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: string, value: string | number) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const selectProduct = (rowId: number, productId: string) => {
    const p = products.find(x => x.id === productId);
    if (p) setRows(prev => prev.map(r => r.id === rowId ? { ...r, productId, rate: p.buyRate || p.pricePerBox } : r));
  };

  const subtotal = rows.reduce((sum, r) => sum + r.qty * r.rate, 0);
  const discountVal = parseFloat(discount) || 0;
  const deliveryVal = parseFloat(delivery) || 0;
  const payable = Math.max(0, subtotal - discountVal + deliveryVal);
  const paidVal = parseFloat(paid) || 0;
  const dueVal = Math.max(0, payable - paidVal);

  const handleSave = () => {
    const items = rows.filter(r => r.productId && r.qty > 0).map(r => {
      const p = products.find(x => x.id === r.productId);
      return { productId: r.productId, name: p?.name || '', barcode: p?.barcode || '', carton: r.qty, piece: 0, sqftQty: 0, buyRate: r.rate, subTotal: r.qty * r.rate } as PurchaseItem;
    });
    if (!items.length) { toast.error('Add at least one item'); return; }
    if (!supplierName.trim()) { toast.error('Select a supplier'); return; }

    const purchase: PurchaseRecord = {
      id: crypto.randomUUID(), invoice: getNextPurchaseNumber(), supplierName,
      date: new Date().toISOString(), items, total: subtotal, discount: discountVal,
      delivery: deliveryVal, payable, paid: paidVal, due: dueVal, remark,
    };
    onAddPurchase(purchase);
    onAddStock(items.map(i => ({ productId: i.productId, qty: i.carton })));
    if (dueVal > 0) onUpdateSupplierDue(supplierName, dueVal);
    toast.success('Purchase saved');
    resetForm();
  };

  const resetForm = () => {
    setSupplierName(''); setDiscount(''); setDelivery(''); setPaid(''); setRemark('');
    setRows([{ id: Date.now(), productId: '', qty: 1, rate: 0 }]);
    setShowForm(false);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) { onDeletePurchase(showDeleteConfirm); toast.success(t('purchaseDeleted')); }
    setShowDeleteConfirm(null);
  };

  const viewPurchase = purchases.find(p => p.id === viewId);

  const SortHeader = ({ field, children, align }: { field: SortField; children: React.ReactNode; align?: string }) => (
    <th className={`px-4 py-3 cursor-pointer select-none hover:bg-pos-surface-container transition-colors ${align || ''}`} onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="material-symbols-outlined text-[11px] opacity-60">{sortIcon(field)}</span>
      </span>
    </th>
  );

  return (
    <section className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-1">{t('purchase')}</span>
          <h2 className="text-2xl sm:text-4xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('purchaseHistory')}</h2>
        </div>
        <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span>Add Purchase
        </button>
      </div>

      {/* ═══ HISTORY TABLE ═══ */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        {/* Controls bar */}
        <div className="px-4 py-3 bg-pos-surface-low flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-pos-surface-container">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-pos-on-surface-variant">Show</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} className="bg-pos-surface-high border border-pos-surface-container rounded px-2 py-1 text-xs outline-none">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-pos-on-surface-variant">entries</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-pos-on-surface-variant">Search:</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-44 bg-pos-surface-high border border-pos-surface-container rounded px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-pos-secondary" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-low border-b border-pos-surface-container">
                <SortHeader field="invoice">INVOICE #</SortHeader>
                <SortHeader field="date">DATE</SortHeader>
                <SortHeader field="supplierName">SUPPLIER</SortHeader>
                <SortHeader field="qty">QTY./SQFTQTY.</SortHeader>
                <SortHeader field="payable" align="text-right">TOTAL</SortHeader>
                <SortHeader field="paid" align="text-right">PAID</SortHeader>
                <SortHeader field="due" align="text-right">DUE</SortHeader>
                <th className="px-4 py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginated.map(p => {
                const totalQty = p.items.reduce((s, i) => s + (i.carton || 0), 0);
                return (
                  <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-pos-secondary">{p.invoice}</td>
                    <td className="px-4 py-3 text-sm">{(() => { try { return new Date(p.date).toLocaleDateString('en-GB'); } catch { return p.date; } })()}</td>
                    <td className="px-4 py-3 text-sm font-medium">{p.supplierName}</td>
                    <td className="px-4 py-3 text-sm">{totalQty}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(p.payable)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-[hsl(125,60%,35%)]">{formatCurrency(p.paid)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${p.due > 0 ? 'text-destructive' : ''}`}>{formatCurrency(p.due)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewId(p.id)} className="w-7 h-7 rounded bg-[hsl(125,60%,35%)] text-white flex items-center justify-center" title="View">
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                        <button className="w-7 h-7 rounded bg-pos-secondary text-white flex items-center justify-center" title="Edit">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => setShowDeleteConfirm(p.id)} className="w-7 h-7 rounded bg-pos-error text-white flex items-center justify-center" title="Delete">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={8} className="px-8 py-8 text-center text-sm text-pos-on-surface-variant">No purchases yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-pos-surface-low border-t border-pos-surface-container flex justify-between items-center">
          <span className="text-xs text-pos-on-surface-variant">
            Showing {filtered.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} entries
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs font-medium bg-pos-surface-container rounded disabled:opacity-40 hover:bg-pos-surface-high transition-colors">Previous</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 text-xs font-bold rounded ${page === i ? 'bg-pos-secondary text-white' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>{i + 1}</button>
            )).slice(Math.max(0, page - 2), page + 3)}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-xs font-medium bg-pos-surface-container rounded disabled:opacity-40 hover:bg-pos-surface-high transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* ═══ ADD PURCHASE MODAL ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={resetForm}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[650px] shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">Add Purchase</h3>
              <button onClick={resetForm} className="text-pos-on-surface-variant hover:text-pos-on-surface"><span className="material-symbols-outlined">close</span></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Supplier *</label>
                <ComboInput value={supplierName} onChange={setSupplierName} options={suppliers.map(s => s.name)} placeholder="Supplier..." className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Discount</label>
                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Delivery</label>
                <input type="number" value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="0" className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
              </div>
            </div>

            {/* Items */}
            <table className="w-full text-left text-sm mb-3">
              <thead><tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                <th className="px-3 py-2">Product</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 w-8"></th>
              </tr></thead>
              <tbody>{rows.map(row => (
                <tr key={row.id} className="border-b border-pos-surface-container">
                  <td className="px-3 py-2">
                    <select value={row.productId} onChange={e => selectProduct(row.id, e.target.value)} className="w-full bg-transparent border-b border-border text-sm py-1 outline-none">
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.size})</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input type="number" min={1} value={row.qty} onChange={e => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)} className="w-16 bg-transparent border-b border-border text-sm py-1 text-center outline-none" /></td>
                  <td className="px-3 py-2"><input type="number" value={row.rate} onChange={e => updateRow(row.id, 'rate', parseFloat(e.target.value) || 0)} className="w-20 bg-transparent border-b border-border text-sm py-1 text-right outline-none" /></td>
                  <td className="px-3 py-2 text-right font-bold">{formatCurrency(row.qty * row.rate)}</td>
                  <td className="px-3 py-2"><button onClick={() => removeRow(row.id)} className="text-pos-error"><span className="material-symbols-outlined text-sm">close</span></button></td>
                </tr>
              ))}</tbody>
            </table>
            <button onClick={addRow} className="text-xs text-pos-secondary font-bold flex items-center gap-1 hover:underline mb-4">
              <span className="material-symbols-outlined text-sm">add</span>Add Item
            </button>

            {/* Summary */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Notes</label>
                <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none resize-none" />
              </div>
              <div className="w-full sm:w-56 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-pos-on-surface-variant">Subtotal</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
                {discountVal > 0 && <div className="flex justify-between text-pos-error text-xs"><span>Discount</span><span>-{formatCurrency(discountVal)}</span></div>}
                {deliveryVal > 0 && <div className="flex justify-between text-xs"><span>Delivery</span><span>+{formatCurrency(deliveryVal)}</span></div>}
                <div className="h-[2px] bg-pos-on-surface" />
                <div className="flex justify-between font-black text-lg"><span>Payable</span><span className="text-pos-secondary">{formatCurrency(payable)}</span></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[hsl(125,60%,35%)]">Paid</span>
                  <input type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" className="w-20 bg-[hsl(125,100%,95%)] border border-[hsl(125,60%,70%)] rounded text-xs py-1 px-1.5 text-right outline-none font-bold" />
                </div>
                <div className="flex justify-between text-xs">
                  <span className={`font-bold ${dueVal > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>Due</span>
                  <span className={`font-bold ${dueVal > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(dueVal)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-5">
              <button onClick={resetForm} className="px-6 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-pos-secondary text-white rounded-lg font-semibold text-sm">Save Purchase</button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewPurchase && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setViewId(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[500px] shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Purchase #{viewPurchase.invoice}</h3>
              <button onClick={() => setViewId(null)} className="text-pos-on-surface-variant hover:text-pos-on-surface"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="font-semibold">{viewPurchase.supplierName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(viewPurchase.date).toLocaleDateString('en-GB')}</span></div>
              <div className="border-t border-pos-surface-container pt-2 mt-2">
                {viewPurchase.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-1">
                    <span>{item.name} × {item.carton}</span>
                    <span className="font-bold">{formatCurrency(item.subTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-pos-surface-container pt-2 space-y-1">
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-pos-secondary">{formatCurrency(viewPurchase.payable)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-[hsl(125,60%,35%)]">Paid</span><span>{formatCurrency(viewPurchase.paid)}</span></div>
                <div className="flex justify-between text-xs"><span className={viewPurchase.due > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}>Due</span><span>{formatCurrency(viewPurchase.due)}</span></div>
              </div>
              {viewPurchase.remark && <p className="text-xs text-muted-foreground mt-2">Note: {viewPurchase.remark}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-pos-on-error-container">delete</span>
              </div>
              <h3 className="text-lg font-bold">Delete Purchase</h3>
            </div>
            <p className="text-sm text-pos-on-surface-variant mb-6">Are you sure you want to delete this purchase?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
