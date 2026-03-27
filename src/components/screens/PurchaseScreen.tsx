import { useState, useMemo, useRef, useCallback } from "react";
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

const PAGE_SIZE = 20;

interface NewPurchaseRow {
  key: number;
  supplierName: string;
  productName: string;
  productId: string;
  qty: string;
  rate: string;
  paid: string;
  remark: string;
}

const emptyRow = (): NewPurchaseRow => ({
  key: Date.now() + Math.random(),
  supplierName: '', productName: '', productId: '', qty: '1', rate: '', paid: '', remark: '',
});

type SortField = 'date' | 'supplierName' | 'payable' | 'due';

export default function PurchaseScreen({ products, suppliers, purchases, onAddPurchase, onDeletePurchase, onAddStock, onUpdateSupplierDue }: PurchaseScreenProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [viewId, setViewId] = useState<string | null>(null);

  // Inline editing
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  // New entry row
  const [newRow, setNewRow] = useState<NewPurchaseRow>(emptyRow());
  const supplierRef = useRef<HTMLInputElement>(null);

  // Sort
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };
  const sortIcon = (field: SortField) => sortField === field ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';

  const debouncedSearch = useDebounce(search, 250);
  const filtered = useMemo(() => {
    const list = purchases.filter(p =>
      p.invoice.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.remark.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === 'supplierName') cmp = a.supplierName.localeCompare(b.supplierName);
      else if (sortField === 'payable') cmp = a.payable - b.payable;
      else if (sortField === 'due') cmp = a.due - b.due;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [purchases, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  // ── New row save ──
  const isRowComplete = (r: NewPurchaseRow) => !!(r.supplierName && r.productId && r.rate);

  const autoSaveRow = useCallback(() => {
    if (!isRowComplete(newRow)) { toast.error('Supplier, Product ও Rate দিন'); return; }
    const product = products.find(p => p.id === newRow.productId);
    const qty = parseInt(newRow.qty) || 1;
    const rate = parseFloat(newRow.rate) || 0;
    const total = qty * rate;
    const paidVal = parseFloat(newRow.paid) || 0;
    const due = Math.max(0, total - paidVal);

    const item: PurchaseItem = {
      productId: newRow.productId, name: product?.name || newRow.productName,
      barcode: product?.barcode || '', carton: qty, piece: 0, sqftQty: 0,
      buyRate: rate, subTotal: total,
    };

    const purchase: PurchaseRecord = {
      id: crypto.randomUUID(), invoice: getNextPurchaseNumber(),
      supplierName: newRow.supplierName, date: new Date().toISOString(),
      items: [item], total, discount: 0, delivery: 0, payable: total,
      paid: paidVal, due, remark: newRow.remark,
    };

    onAddPurchase(purchase);
    onAddStock([{ productId: newRow.productId, qty }]);
    if (due > 0) onUpdateSupplierDue(newRow.supplierName, due);
    toast.success(`✓ Purchase saved — ${product?.name}`);
    setNewRow(emptyRow());
    setTimeout(() => supplierRef.current?.focus(), 50);
  }, [newRow, products, onAddPurchase, onAddStock, onUpdateSupplierDue]);

  const updateNewRow = (field: keyof NewPurchaseRow, value: string) => {
    setNewRow(prev => ({ ...prev, [field]: value }));
  };

  const selectNewProduct = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (p) {
      setNewRow(prev => ({ ...prev, productId, productName: p.name, rate: String(p.buyRate || p.pricePerBox) }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); autoSaveRow(); }
  };

  // ── Delete ──
  const confirmDelete = () => {
    if (showDeleteConfirm) { onDeletePurchase(showDeleteConfirm); toast.success(t('purchaseDeleted')); }
    setShowDeleteConfirm(null);
  };

  const inputCls = "w-full bg-transparent border-none text-xs py-1.5 px-1.5 outline-none focus:bg-[hsl(var(--accent))] transition-colors placeholder:text-muted-foreground/40";

  // ── View details modal ──
  const viewPurchase = purchases.find(p => p.id === viewId);

  return (
    <section className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-1">{t('purchase')}</span>
          <h2 className="text-2xl sm:text-4xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('purchaseHistory')} <span className="text-lg font-normal text-pos-on-surface-variant">({purchases.length})</span></h2>
        </div>
        <div className="relative w-full sm:w-auto">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-full sm:w-56 bg-pos-surface-high border-none rounded-lg text-xs py-2.5 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="Search purchases..." />
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
        </div>
      </div>

      {/* ═══ UNIFIED TABLE ═══ */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full min-w-[900px] relative">
            <thead className="sticky top-0 z-10">
              <tr className="text-[9px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-low border-b border-pos-surface-container">
                <th className="px-2 py-2.5 w-8 text-center">#</th>
                <th className="px-2 py-2.5">{t('invoice')}</th>
                <th className="px-2 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('date')}>
                  <span className="inline-flex items-center gap-0.5">{t('date')} <span className="material-symbols-outlined text-[10px]">{sortIcon('date')}</span></span>
                </th>
                <th className="px-2 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('supplierName')}>
                  <span className="inline-flex items-center gap-0.5">{t('supplierLabel')} <span className="material-symbols-outlined text-[10px]">{sortIcon('supplierName')}</span></span>
                </th>
                <th className="px-2 py-2.5">{t('products')}</th>
                <th className="px-2 py-2.5 text-center">{t('qty')}</th>
                <th className="px-2 py-2.5 text-right">{t('rate')}</th>
                <th className="px-2 py-2.5 text-right cursor-pointer select-none" onClick={() => toggleSort('payable')}>
                  <span className="inline-flex items-center gap-0.5 justify-end">{t('total')} <span className="material-symbols-outlined text-[10px]">{sortIcon('payable')}</span></span>
                </th>
                <th className="px-2 py-2.5 text-right">{t('paid')}</th>
                <th className="px-2 py-2.5 text-right cursor-pointer select-none" onClick={() => toggleSort('due')}>
                  <span className="inline-flex items-center gap-0.5 justify-end">{t('due')} <span className="material-symbols-outlined text-[10px]">{sortIcon('due')}</span></span>
                </th>
                <th className="px-2 py-2.5">Remark</th>
                <th className="px-2 py-2.5 text-center w-16">{t('action')}</th>
              </tr>

              {/* ═══ NEW ENTRY ROW ═══ */}
              <tr className="bg-[hsl(210,40%,96%)] dark:bg-[hsl(210,25%,12%)] border-b-2 border-[hsl(210,50%,70%)] hover:bg-[hsl(210,40%,94%)] dark:hover:bg-[hsl(210,25%,14%)] transition-colors"
                onKeyDown={handleKeyDown}>
                <td className="px-2 py-1 text-center">
                  <span className="material-symbols-outlined text-[hsl(210,60%,45%)] text-base">add_circle</span>
                </td>
                <td className="px-2 py-1 text-[10px] text-muted-foreground font-mono">Auto</td>
                <td className="px-2 py-1 text-[10px] text-muted-foreground">Today</td>
                <td className="px-0 py-1 border-r border-[hsl(210,30%,80%)]">
                  <ComboInput
                    value={newRow.supplierName}
                    onChange={v => updateNewRow('supplierName', v)}
                    options={suppliers.map(s => s.name)}
                    placeholder="Supplier..."
                    className={inputCls}
                  />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(210,30%,80%)]">
                  <select value={newRow.productId} onChange={e => selectNewProduct(e.target.value)}
                    className="w-full bg-transparent border-none text-xs py-1.5 px-1 outline-none focus:bg-[hsl(var(--accent))]">
                    <option value="">Product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.size})</option>)}
                  </select>
                </td>
                <td className="px-0 py-1 border-r border-[hsl(210,30%,80%)]">
                  <input type="number" value={newRow.qty} onChange={e => updateNewRow('qty', e.target.value)} className={`${inputCls} text-center`} placeholder="1" />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(210,30%,80%)]">
                  <input type="number" value={newRow.rate} onChange={e => updateNewRow('rate', e.target.value)} className={`${inputCls} text-right`} placeholder="৳ Rate" />
                </td>
                <td className="px-2 py-1 text-right text-xs font-bold text-pos-secondary">
                  {formatCurrency((parseInt(newRow.qty) || 0) * (parseFloat(newRow.rate) || 0))}
                </td>
                <td className="px-0 py-1 border-r border-[hsl(210,30%,80%)] bg-[hsl(125,100%,95%)] dark:bg-[hsl(125,30%,12%)]">
                  <input type="number" value={newRow.paid} onChange={e => updateNewRow('paid', e.target.value)} className={`${inputCls} text-right font-bold`} placeholder="৳ Paid" />
                </td>
                <td className="px-2 py-1 text-right text-xs font-bold">
                  <span className={`${(((parseInt(newRow.qty) || 0) * (parseFloat(newRow.rate) || 0)) - (parseFloat(newRow.paid) || 0)) > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>
                    {formatCurrency(Math.max(0, ((parseInt(newRow.qty) || 0) * (parseFloat(newRow.rate) || 0)) - (parseFloat(newRow.paid) || 0)))}
                  </span>
                </td>
                <td className="px-0 py-1 border-r border-[hsl(210,30%,80%)]">
                  <input value={newRow.remark} onChange={e => updateNewRow('remark', e.target.value)} className={inputCls} placeholder="Note..." />
                </td>
                <td className="px-2 py-1 text-center">
                  <button onClick={autoSaveRow} disabled={!isRowComplete(newRow)}
                    className="w-7 h-7 rounded-lg bg-[hsl(210,60%,45%)] text-white flex items-center justify-center disabled:opacity-30 hover:bg-[hsl(210,60%,38%)] transition-colors mx-auto"
                    title="Save (Enter)">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </button>
                </td>
              </tr>
            </thead>

            <tbody className="divide-y divide-pos-surface-container">
              {paginated.map((p, idx) => {
                const totalQty = p.items.reduce((s, i) => s + (i.carton || 0), 0);
                const productNames = p.items.map(i => i.name).join(', ');
                const avgRate = p.items.length ? p.items.reduce((s, i) => s + i.buyRate, 0) / p.items.length : 0;
                return (
                  <tr key={p.id} className="hover:bg-pos-surface-low transition-colors group">
                    <td className="px-2 py-2.5 text-center text-[10px] text-muted-foreground font-mono">{page * PAGE_SIZE + idx + 1}</td>
                    <td className="px-2 py-2.5 text-xs font-bold text-pos-secondary">{p.invoice}</td>
                    <td className="px-2 py-2.5 text-xs text-pos-on-surface-variant">{(() => { try { return new Date(p.date).toLocaleDateString('en-GB'); } catch { return p.date; } })()}</td>
                    <td className="px-2 py-2.5 text-sm font-semibold">{p.supplierName}</td>
                    <td className="px-2 py-2.5 text-xs max-w-[150px] truncate" title={productNames}>{productNames || '—'}</td>
                    <td className="px-2 py-2.5 text-xs text-center">{totalQty}</td>
                    <td className="px-2 py-2.5 text-xs text-right">{formatCurrency(avgRate)}</td>
                    <td className="px-2 py-2.5 text-right font-bold text-sm">{formatCurrency(p.payable)}</td>
                    <td className="px-2 py-2.5 text-right text-xs font-semibold text-[hsl(125,60%,35%)]">{formatCurrency(p.paid)}</td>
                    <td className={`px-2 py-2.5 text-right text-xs font-semibold ${p.due > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(p.due)}</td>
                    <td className="px-2 py-2.5 text-[10px] text-muted-foreground truncate max-w-[100px]" title={p.remark}>{p.remark || '—'}</td>
                    <td className="px-2 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewId(p.id)} className="w-5 h-5 rounded bg-[hsl(210,60%,45%)] text-white flex items-center justify-center" title="View">
                          <span className="material-symbols-outlined text-xs">visibility</span>
                        </button>
                        <button onClick={() => setShowDeleteConfirm(p.id)} className="w-5 h-5 rounded bg-pos-error text-white flex items-center justify-center" title={t('delete')}>
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={12} className="px-8 py-6 text-center text-xs text-pos-on-surface-variant">{t('noSalesYet')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-2.5 bg-pos-surface-low border-t border-pos-surface-container flex justify-between items-center">
            <span className="text-xs text-pos-on-surface-variant">{t('showing')} {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {t('of')} {filtered.length}</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2.5 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">{t('prev')}</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 text-xs font-bold rounded-lg ${page === i ? 'bg-pos-secondary text-white' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>{i + 1}</button>
              )).slice(Math.max(0, page - 2), page + 3)}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2.5 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">{t('next')}</button>
            </div>
          </div>
        )}

        {/* Hint bar */}
        <div className="px-4 py-2 bg-pos-surface-low border-t border-pos-surface-container flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="px-1 py-0.5 bg-pos-surface-container rounded text-[9px] font-mono">Enter</kbd> সেভ ও নতুন রো</span>
          <span>Supplier, Product ও Rate বাধ্যতামূলক</span>
        </div>
      </div>

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
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
