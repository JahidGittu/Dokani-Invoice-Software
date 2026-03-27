import { useState, useMemo, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextPurchaseNumber, type Product, type Supplier, type PurchaseRecord, type PurchaseItem } from "@/lib/store";
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

const PAGE_SIZE = 10;

export default function PurchaseScreen({ products, suppliers, purchases, onAddPurchase, onDeletePurchase, onAddStock, onUpdateSupplierDue }: PurchaseScreenProps) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [discount, setDiscount] = useState('');
  const [delivery, setDelivery] = useState('');
  const [paid, setPaid] = useState('');
  const [remark, setRemark] = useState('');
  const [rows, setRows] = useState<{ id: number; productId: string; qty: number; rate: number }[]>([{ id: Date.now(), productId: '', qty: 1, rate: 0 }]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(purchases.length / PAGE_SIZE));
  const paginatedPurchases = useMemo(() => purchases.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [purchases, page]);

  const addRow = () => setRows(prev => [...prev, { id: Date.now(), productId: '', qty: 1, rate: 0 }]);
  const removeRow = (id: number) => setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: string, value: string | number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
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
    if (!items.length) { toast.error(t('addAtLeastOneItem')); return; }
    if (!supplierName.trim()) { toast.error('Select a supplier'); return; }

    const purchase: PurchaseRecord = {
      id: crypto.randomUUID(), invoice: getNextPurchaseNumber(), supplierName,
      date: new Date().toISOString(), items, total: subtotal, discount: discountVal,
      delivery: deliveryVal, payable, paid: paidVal, due: dueVal, remark,
    };
    onAddPurchase(purchase);
    onAddStock(items.map(i => ({ productId: i.productId, qty: i.carton })));
    if (dueVal > 0) onUpdateSupplierDue(supplierName, dueVal);
    toast.success(t('purchaseSaved'));
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

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('purchase')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('purchaseHistory')}</h2>
        </div>
        <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span>{t('addPurchase')}
        </button>
      </div>

      {/* Add Purchase Form */}
      {showForm && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-6 space-y-4">
          <h3 className="text-lg font-bold">{t('addPurchase')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('supplierLabel')}</label>
              <select value={supplierName} onChange={e => setSupplierName(e.target.value)} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none">
                <option value="">{t('supplierLabel')}...</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('discount')}</label>
              <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('delivery')}</label>
              <input type="number" value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="0" className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
            </div>
          </div>

          {/* Items */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                <th className="px-3 py-2">{t('products')}</th><th className="px-3 py-2 text-center">{t('qty')}</th><th className="px-3 py-2 text-right">{t('rate')}</th><th className="px-3 py-2 text-right">{t('total')}</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>{rows.map(row => (
                <tr key={row.id} className="border-b border-pos-surface-container">
                  <td className="px-3 py-2">
                    <select value={row.productId} onChange={e => selectProduct(row.id, e.target.value)} className="w-full bg-transparent border-b border-border text-sm py-1 outline-none">
                      <option value="">{t('products')}...</option>
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
          </div>
          <button onClick={addRow} className="text-xs text-pos-secondary font-bold flex items-center gap-1 hover:underline">
            <span className="material-symbols-outlined text-sm">add</span>{t('addItem')}
          </button>

          {/* Summary */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('notes')}</label>
              <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none resize-none" />
            </div>
            <div className="w-full sm:w-56 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-pos-on-surface-variant">{t('subtotal')}</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
              {discountVal > 0 && <div className="flex justify-between text-pos-error text-xs"><span>{t('discount')}</span><span>-{formatCurrency(discountVal)}</span></div>}
              {deliveryVal > 0 && <div className="flex justify-between text-xs"><span>{t('delivery')}</span><span>+{formatCurrency(deliveryVal)}</span></div>}
              <div className="h-[2px] bg-pos-on-surface" />
              <div className="flex justify-between font-black text-lg"><span>Payable</span><span className="text-pos-secondary">{formatCurrency(payable)}</span></div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[hsl(125,60%,35%)]">{t('paid')}</span>
                <input type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" className="w-20 bg-[hsl(125,100%,95%)] border border-[hsl(125,60%,70%)] rounded text-xs py-1 px-1.5 text-right outline-none font-bold" />
              </div>
              <div className="flex justify-between text-xs">
                <span className={`font-bold ${dueVal > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{t('due')}</span>
                <span className={`font-bold ${dueVal > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(dueVal)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={resetForm} className="px-6 py-2 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
            <button onClick={handleSave} className="px-6 py-2 bg-pos-secondary text-white rounded-lg font-semibold text-sm">{t('saveSale')}</button>
          </div>
        </div>
      )}

      {/* Purchase History */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-4 sm:px-8 py-5 bg-pos-surface-low">
          <h3 className="text-base font-semibold">{t('purchaseHistory')} <span className="text-pos-on-surface-variant font-normal text-sm">({purchases.length})</span></h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
              <th className="px-4 sm:px-6 py-3">{t('invoice')}</th>
              <th className="px-4 sm:px-6 py-3">{t('supplierLabel')}</th>
              <th className="px-4 sm:px-6 py-3 hidden sm:table-cell">{t('items')}</th>
              <th className="px-4 sm:px-6 py-3">{t('total')}</th>
              <th className="px-4 sm:px-6 py-3 hidden md:table-cell">{t('paid')}</th>
              <th className="px-4 sm:px-6 py-3 hidden md:table-cell">{t('due')}</th>
              <th className="px-4 sm:px-6 py-3 hidden lg:table-cell">{t('date')}</th>
              <th className="px-4 sm:px-6 py-3 text-right">{t('actions')}</th>
            </tr></thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginatedPurchases.length > 0 ? paginatedPurchases.map(p => (
                <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                  <td className="px-4 sm:px-6 py-4 text-xs font-bold text-pos-secondary">{p.invoice}</td>
                  <td className="px-4 sm:px-6 py-4 text-sm">{p.supplierName}</td>
                  <td className="px-4 sm:px-6 py-4 text-xs hidden sm:table-cell">{p.items.length}</td>
                  <td className="px-4 sm:px-6 py-4 font-bold">{formatCurrency(p.payable)}</td>
                  <td className="px-4 sm:px-6 py-4 text-xs font-semibold text-[hsl(125,60%,35%)] hidden md:table-cell">{formatCurrency(p.paid)}</td>
                  <td className={`px-4 sm:px-6 py-4 text-xs font-semibold hidden md:table-cell ${p.due > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(p.due)}</td>
                  <td className="px-4 sm:px-6 py-4 text-xs text-pos-on-surface-variant hidden lg:table-cell">{(() => { try { return new Date(p.date).toLocaleDateString('en-GB'); } catch { return p.date; } })()}</td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <button onClick={() => setShowDeleteConfirm(p.id)} className="text-pos-error text-xs hover:underline">{t('delete')}</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-8 py-8 text-center text-xs text-pos-on-surface-variant">{t('noSalesYet')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {purchases.length > PAGE_SIZE && (
          <div className="px-6 py-3 bg-pos-surface-low border-t border-pos-surface-container flex justify-between items-center">
            <span className="text-xs text-pos-on-surface-variant">{t('page')} {page + 1} {t('of')} {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">{t('prev')}</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">{t('next')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{t('purchaseDeleted')}</h3>
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
