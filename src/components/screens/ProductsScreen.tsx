import { useState, useMemo, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { type Product, formatCurrency, PRODUCT_CATEGORIES, PRODUCT_BRANDS } from "@/lib/store";
import { toast } from "sonner";

interface ProductsScreenProps {
  products: Product[];
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
}

const PAGE_SIZE = 20;
const FINISHES = ['Glossy', 'Matte', 'Lappato', 'Rustic', 'Carving'];

interface InlineRow {
  key: number;
  name: string; category: string; brand: string; size: string; finish: string;
  buyRate: string; pricePerBox: string; sqftPerBox: string; piecesPerBox: string;
  stock: string; batch: string; barcode: string;
  saved?: boolean;
}

const emptyRow = (): InlineRow => ({
  key: Date.now() + Math.random(),
  name: '', category: 'Wall Tiles', brand: '', size: '', finish: 'Glossy',
  buyRate: '', pricePerBox: '', sqftPerBox: '', piecesPerBox: '4', stock: '', batch: '', barcode: '',
});

export default function ProductsScreen({ products, onAddProduct, onUpdateProduct, onDeleteProduct }: ProductsScreenProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({
    name: '', size: '', finish: 'Glossy', pricePerBox: '', sqftPerBox: '', piecesPerBox: '4', stock: '', batch: '',
    barcode: '', category: 'Wall Tiles', brand: '', buyRate: '',
  });

  // Single new-entry row at the bottom of the table
  const [newRow, setNewRow] = useState<InlineRow>(emptyRow());
  const nameRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 250);
  const filtered = useMemo(() =>
    products.filter(p =>
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.batch.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(debouncedSearch.toLowerCase())
    ),
    [products, debouncedSearch]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedProducts = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  const resetForm = () => setForm({ name: '', size: '', finish: 'Glossy', pricePerBox: '', sqftPerBox: '', piecesPerBox: '4', stock: '', batch: '', barcode: '', category: 'Wall Tiles', brand: '', buyRate: '' });

  const handleSave = () => {
    if (!form.name || !form.pricePerBox) { toast.error(t('nameAndPriceReq')); return; }
    const data = {
      name: form.name, size: form.size, finish: form.finish,
      pricePerBox: parseFloat(form.pricePerBox), sqftPerBox: parseFloat(form.sqftPerBox) || 0,
      piecesPerBox: parseInt(form.piecesPerBox) || 4,
      stock: parseInt(form.stock) || 0, batch: form.batch,
      barcode: form.barcode, category: form.category, brand: form.brand,
      buyRate: parseFloat(form.buyRate) || 0,
    };
    if (editId) { onUpdateProduct(editId, data); toast.success(t('productUpdated')); }
    else { onAddProduct(data); toast.success(t('productAdded')); }
    setShowAddModal(false); setEditId(null); resetForm();
  };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name, size: p.size, finish: p.finish,
      pricePerBox: String(p.pricePerBox), sqftPerBox: String(p.sqftPerBox),
      piecesPerBox: String(p.piecesPerBox || 4),
      stock: String(p.stock), batch: p.batch,
      barcode: p.barcode || '', category: p.category || 'Wall Tiles',
      brand: p.brand || '', buyRate: String(p.buyRate || 0),
    });
    setEditId(p.id); setShowAddModal(true);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm && onDeleteProduct) { onDeleteProduct(showDeleteConfirm); toast.success(t('productDeleted')); }
    setShowDeleteConfirm(null);
  };

  // Check if the new row has enough data to auto-save
  const isRowComplete = (r: InlineRow) => !!(r.name && r.pricePerBox);

  const autoSaveRow = useCallback(() => {
    if (!isRowComplete(newRow)) return;
    onAddProduct({
      name: newRow.name, size: newRow.size, finish: newRow.finish,
      pricePerBox: parseFloat(newRow.pricePerBox), sqftPerBox: parseFloat(newRow.sqftPerBox) || 0,
      piecesPerBox: parseInt(newRow.piecesPerBox) || 4,
      stock: parseInt(newRow.stock) || 0, batch: newRow.batch,
      barcode: newRow.barcode, category: newRow.category, brand: newRow.brand,
      buyRate: parseFloat(newRow.buyRate) || 0,
    });
    toast.success(`✓ ${newRow.name} saved`);
    setNewRow(emptyRow());
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [newRow, onAddProduct]);

  const updateNewRow = (field: keyof InlineRow, value: string) => {
    setNewRow(prev => ({ ...prev, [field]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      autoSaveRow();
    }
  };

  const inputCls = "w-full bg-transparent border-none text-xs py-1.5 px-1.5 outline-none focus:bg-[hsl(var(--accent))] transition-colors placeholder:text-muted-foreground/40";
  const selectCls = "w-full bg-transparent border-none text-xs py-1.5 px-0.5 outline-none focus:bg-[hsl(var(--accent))] transition-colors";

  return (
    <section className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-1">{t('stockManagement')}</span>
          <h2 className="text-2xl sm:text-4xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('products')} <span className="text-lg font-normal text-pos-on-surface-variant">({products.length})</span></h2>
        </div>
        <div className="relative w-full sm:w-auto">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-full sm:w-56 bg-pos-surface-high border-none rounded-lg text-xs py-2.5 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder={t('searchProducts')} />
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
        </div>
      </div>

      {/* ═══ UNIFIED TABLE ═══ */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="text-[9px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-low border-b border-pos-surface-container">
                <th className="px-2 py-2.5 w-8 text-center">#</th>
                <th className="px-2 py-2.5">{t('productName')}</th>
                <th className="px-2 py-2.5">{t('categoryLabel')}</th>
                <th className="px-2 py-2.5">{t('brandLabel')}</th>
                <th className="px-2 py-2.5">{t('size')}</th>
                <th className="px-2 py-2.5">Finish</th>
                <th className="px-2 py-2.5 text-right">{t('buyRateLabel')}</th>
                <th className="px-2 py-2.5 text-right">{t('salesRateLabel')}</th>
                <th className="px-2 py-2.5 text-center">Sqft</th>
                <th className="px-2 py-2.5 text-center">Pcs</th>
                <th className="px-2 py-2.5 text-center">{t('stock')}</th>
                <th className="px-2 py-2.5">Batch</th>
                <th className="px-2 py-2.5 text-center w-16">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {/* Existing products */}
              {paginatedProducts.map((p, idx) => (
                <tr key={p.id} className="hover:bg-pos-surface-low transition-colors group">
                  <td className="px-2 py-2.5 text-center text-[10px] text-muted-foreground font-mono">{page * PAGE_SIZE + idx + 1}</td>
                  <td className="px-2 py-2.5 font-semibold text-sm">{p.name}</td>
                  <td className="px-2 py-2.5 text-xs">{p.category || '—'}</td>
                  <td className="px-2 py-2.5 text-xs">{p.brand || '—'}</td>
                  <td className="px-2 py-2.5"><span className="px-1.5 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-[10px] font-bold">{p.size || '—'}</span></td>
                  <td className="px-2 py-2.5 text-xs">{p.finish}</td>
                  <td className="px-2 py-2.5 text-xs text-right">{formatCurrency(p.buyRate || 0)}</td>
                  <td className="px-2 py-2.5 text-right font-bold text-pos-secondary text-sm">{formatCurrency(p.pricePerBox)}</td>
                  <td className="px-2 py-2.5 text-xs text-center">{p.sqftPerBox || '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-center">{p.piecesPerBox || 4}</td>
                  <td className="px-2 py-2.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${p.stock <= 0 ? 'bg-pos-error text-white' : p.stock <= 20 ? 'bg-pos-error-container text-pos-on-error-container' : 'bg-pos-tertiary-container text-pos-on-tertiary-container'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-[10px] font-mono text-muted-foreground">{p.barcode || p.batch || '—'}</td>
                  <td className="px-2 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(p)} className="w-5 h-5 rounded bg-[hsl(125,60%,35%)] text-white flex items-center justify-center" title={t('edit')}><span className="material-symbols-outlined text-xs">edit</span></button>
                      {onDeleteProduct && <button onClick={() => setShowDeleteConfirm(p.id)} className="w-5 h-5 rounded bg-pos-error text-white flex items-center justify-center" title={t('delete')}><span className="material-symbols-outlined text-xs">delete</span></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedProducts.length === 0 && !search && (
                <tr><td colSpan={13} className="px-8 py-6 text-center text-xs text-pos-on-surface-variant">{t('noProducts')}</td></tr>
              )}

              {/* ═══ NEW ENTRY ROW (always at bottom) ═══ */}
              <tr className="bg-[hsl(125,40%,96%)] dark:bg-[hsl(125,25%,12%)] border-t-2 border-[hsl(125,50%,70%)] hover:bg-[hsl(125,40%,94%)] dark:hover:bg-[hsl(125,25%,14%)] transition-colors"
                onKeyDown={handleKeyDown}>
                <td className="px-2 py-1 text-center">
                  <span className="material-symbols-outlined text-[hsl(125,60%,35%)] text-base">add_circle</span>
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <input ref={nameRef} value={newRow.name} onChange={e => updateNewRow('name', e.target.value)}
                    className={`${inputCls} font-semibold`} placeholder="নাম লিখুন..." autoFocus />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <select value={newRow.category} onChange={e => updateNewRow('category', e.target.value)} className={selectCls}>
                    {PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <select value={newRow.brand} onChange={e => updateNewRow('brand', e.target.value)} className={selectCls}>
                    <option value="">—</option>
                    {PRODUCT_BRANDS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <input value={newRow.size} onChange={e => updateNewRow('size', e.target.value)} className={inputCls} placeholder="60×60" />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <select value={newRow.finish} onChange={e => updateNewRow('finish', e.target.value)} className={selectCls}>
                    {FINISHES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <input type="number" value={newRow.buyRate} onChange={e => updateNewRow('buyRate', e.target.value)} className={`${inputCls} text-right`} placeholder="৳ Buy" />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)] bg-[hsl(54,97%,92%)] dark:bg-[hsl(54,30%,15%)]">
                  <input type="number" value={newRow.pricePerBox} onChange={e => updateNewRow('pricePerBox', e.target.value)} className={`${inputCls} text-right font-bold`} placeholder="৳ Sale *" />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <input type="number" value={newRow.sqftPerBox} onChange={e => updateNewRow('sqftPerBox', e.target.value)} className={`${inputCls} text-center`} placeholder="sqft" />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <input type="number" value={newRow.piecesPerBox} onChange={e => updateNewRow('piecesPerBox', e.target.value)} className={`${inputCls} text-center`} placeholder="pcs" />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <input type="number" value={newRow.stock} onChange={e => updateNewRow('stock', e.target.value)} className={`${inputCls} text-center`} placeholder="qty" />
                </td>
                <td className="px-0 py-1 border-r border-[hsl(125,30%,80%)]">
                  <input value={newRow.batch} onChange={e => updateNewRow('batch', e.target.value)} className={inputCls} placeholder="batch" />
                </td>
                <td className="px-2 py-1 text-center">
                  <button onClick={autoSaveRow} disabled={!isRowComplete(newRow)}
                    className="w-7 h-7 rounded-lg bg-[hsl(125,60%,35%)] text-white flex items-center justify-center disabled:opacity-30 hover:bg-[hsl(125,60%,28%)] transition-colors mx-auto"
                    title="Save (Enter)">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </button>
                </td>
              </tr>
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
          <span><kbd className="px-1 py-0.5 bg-pos-surface-container rounded text-[9px] font-mono">Tab</kbd> পরের ফিল্ড</span>
          <span><kbd className="px-1 py-0.5 bg-pos-surface-container rounded text-[9px] font-mono">Enter</kbd> সেভ ও নতুন রো</span>
          <span>Name ও Sale Price বাধ্যতামূলক</span>
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => { setShowAddModal(false); setEditId(null); }}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[560px] shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">{editId ? t('editProduct') : t('addNewProduct')}</h3>
              <button onClick={() => { setShowAddModal(false); setEditId(null); }} className="text-pos-on-surface-variant hover:text-pos-on-surface"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('productNameReq')}</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="e.g. Royal Marble" /></div>
              <div>
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('categoryLabel')}</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none">
                  {PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('brandLabel')}</label>
                <select value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none">
                  <option value="">—</option>
                  {PRODUCT_BRANDS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('size')}</label><input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="24×24" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('finish')}</label><select value={form.finish} onChange={e => setForm(f => ({ ...f, finish: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none">{FINISHES.map(f => <option key={f}>{f}</option>)}</select></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('buyRateLabel')} (৳)</label><input value={form.buyRate} onChange={e => setForm(f => ({ ...f, buyRate: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="900" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('salesRateLabel')} (৳) *</label><input value={form.pricePerBox} onChange={e => setForm(f => ({ ...f, pricePerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="1200" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('sqftPerBox')}</label><input value={form.sqftPerBox} onChange={e => setForm(f => ({ ...f, sqftPerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="9.2" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Pieces/Box</label><input value={form.piecesPerBox} onChange={e => setForm(f => ({ ...f, piecesPerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="4" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('stock')} ({t('boxes')})</label><input value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="100" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('barcode')}</label><input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="01" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('batchNo')}</label><input value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="BT-2501" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAddModal(false); setEditId(null); }} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm">{editId ? t('updateProduct') : t('saveProduct')}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-pos-on-error-container">delete</span>
              </div>
              <h3 className="text-lg font-bold">{t('deleteProduct')}</h3>
            </div>
            <p className="text-sm text-pos-on-surface-variant mb-6">{t('deleteProductMsg')}</p>
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
