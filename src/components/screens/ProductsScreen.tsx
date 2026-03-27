import { useState, useMemo, useRef, useEffect } from "react";
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

const PAGE_SIZE = 15;
const FINISHES = ['Glossy', 'Matte', 'Lappato', 'Rustic', 'Carving'];

const emptyRow = (): InlineRow => ({
  key: Date.now(),
  name: '', category: 'Wall Tiles', brand: '', size: '', finish: 'Glossy',
  buyRate: '', pricePerBox: '', sqftPerBox: '', piecesPerBox: '4', stock: '', batch: '', barcode: '',
});

interface InlineRow {
  key: number;
  name: string; category: string; brand: string; size: string; finish: string;
  buyRate: string; pricePerBox: string; sqftPerBox: string; piecesPerBox: string;
  stock: string; batch: string; barcode: string;
}

export default function ProductsScreen({ products, onAddProduct, onUpdateProduct, onDeleteProduct }: ProductsScreenProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [entryMode, setEntryMode] = useState<'inline' | 'modal'>('inline');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Modal form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '', size: '', finish: 'Glossy', pricePerBox: '', sqftPerBox: '', piecesPerBox: '4', stock: '', batch: '',
    barcode: '', category: 'Wall Tiles', brand: '', buyRate: '',
  });

  // Inline entry rows
  const [inlineRows, setInlineRows] = useState<InlineRow[]>([emptyRow()]);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // Modal save
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
    if (editId) {
      onUpdateProduct(editId, data);
      toast.success(t('productUpdated'));
    } else {
      onAddProduct(data);
      toast.success(t('productAdded'));
    }
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

  // Inline entry helpers
  const updateInlineRow = (idx: number, field: keyof InlineRow, value: string) => {
    setInlineRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addInlineRow = () => {
    setInlineRows(prev => [...prev, emptyRow()]);
    setTimeout(() => nameRefs.current[inlineRows.length]?.focus(), 50);
  };

  const removeInlineRow = (idx: number) => {
    if (inlineRows.length <= 1) return;
    setInlineRows(prev => prev.filter((_, i) => i !== idx));
  };

  const saveInlineRow = (idx: number) => {
    const r = inlineRows[idx];
    if (!r.name || !r.pricePerBox) { toast.error(t('nameAndPriceReq')); return; }
    onAddProduct({
      name: r.name, size: r.size, finish: r.finish,
      pricePerBox: parseFloat(r.pricePerBox), sqftPerBox: parseFloat(r.sqftPerBox) || 0,
      piecesPerBox: parseInt(r.piecesPerBox) || 4,
      stock: parseInt(r.stock) || 0, batch: r.batch,
      barcode: r.barcode, category: r.category, brand: r.brand,
      buyRate: parseFloat(r.buyRate) || 0,
    });
    toast.success(`✓ ${r.name} added`);
    // Reset that row and add a new empty one
    setInlineRows(prev => {
      const next = [...prev];
      next[idx] = emptyRow();
      return next;
    });
    setTimeout(() => nameRefs.current[idx]?.focus(), 50);
  };

  const saveAllInlineRows = () => {
    let count = 0;
    const remaining: InlineRow[] = [];
    inlineRows.forEach(r => {
      if (r.name && r.pricePerBox) {
        onAddProduct({
          name: r.name, size: r.size, finish: r.finish,
          pricePerBox: parseFloat(r.pricePerBox), sqftPerBox: parseFloat(r.sqftPerBox) || 0,
          piecesPerBox: parseInt(r.piecesPerBox) || 4,
          stock: parseInt(r.stock) || 0, batch: r.batch,
          barcode: r.barcode, category: r.category, brand: r.brand,
          buyRate: parseFloat(r.buyRate) || 0,
        });
        count++;
      } else {
        remaining.push(r);
      }
    });
    if (count > 0) {
      toast.success(`✓ ${count} products added`);
      setInlineRows(remaining.length > 0 ? remaining : [emptyRow()]);
    } else {
      toast.error('Fill at least Name & Price');
    }
  };

  // Handle Enter key to save row and move to next
  const handleInlineKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const r = inlineRows[idx];
      if (r.name && r.pricePerBox) {
        saveInlineRow(idx);
      }
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
          <h2 className="text-2xl sm:text-4xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('products')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Entry Mode */}
          <div className="flex bg-pos-surface-container rounded-lg p-0.5">
            <button onClick={() => setEntryMode('inline')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${entryMode === 'inline' ? 'bg-pos-secondary text-white shadow' : 'text-pos-on-surface-variant hover:text-pos-on-surface'}`}>
              <span className="material-symbols-outlined text-sm mr-1 align-middle">table_rows</span>Excel Style
            </button>
            <button onClick={() => setEntryMode('modal')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${entryMode === 'modal' ? 'bg-pos-secondary text-white shadow' : 'text-pos-on-surface-variant hover:text-pos-on-surface'}`}>
              <span className="material-symbols-outlined text-sm mr-1 align-middle">add_box</span>Modal
            </button>
          </div>
          {entryMode === 'modal' && (
            <button onClick={() => { resetForm(); setEditId(null); setShowAddModal(true); }}
              className="px-5 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform text-sm">
              <span className="material-symbols-outlined text-base">add</span>{t('addProduct')}
            </button>
          )}
        </div>
      </div>

      {/* ═══ INLINE EXCEL-STYLE ENTRY ═══ */}
      {entryMode === 'inline' && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container overflow-hidden">
          <div className="px-4 py-3 bg-[hsl(125,40%,95%)] dark:bg-[hsl(125,30%,15%)] border-b border-pos-surface-container flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[hsl(125,60%,35%)] text-lg">add_circle</span>
              <span className="text-sm font-bold text-[hsl(125,60%,30%)]">Quick Add Products</span>
              <span className="text-[10px] text-muted-foreground">(Enter দিয়ে সেভ করুন, Tab দিয়ে পরের ফিল্ডে যান)</span>
            </div>
            <div className="flex gap-2">
              <button onClick={addInlineRow} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg hover:bg-pos-surface-high transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">add</span>Row
              </button>
              <button onClick={saveAllInlineRows} className="px-4 py-1 text-xs font-bold bg-[hsl(125,60%,35%)] text-white rounded-lg hover:bg-[hsl(125,60%,30%)] transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">save</span>Save All
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="text-[9px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-low border-b border-pos-surface-container">
                  <th className="px-1 py-2 w-6 text-center">#</th>
                  <th className="px-1 py-2 w-[140px]">Name *</th>
                  <th className="px-1 py-2 w-[90px]">Category</th>
                  <th className="px-1 py-2 w-[80px]">Brand</th>
                  <th className="px-1 py-2 w-[70px]">Size</th>
                  <th className="px-1 py-2 w-[70px]">Finish</th>
                  <th className="px-1 py-2 w-[70px]">Buy ৳</th>
                  <th className="px-1 py-2 w-[70px]">Sale ৳ *</th>
                  <th className="px-1 py-2 w-[60px]">Sqft/Box</th>
                  <th className="px-1 py-2 w-[50px]">Pcs/Box</th>
                  <th className="px-1 py-2 w-[55px]">Stock</th>
                  <th className="px-1 py-2 w-[70px]">Batch</th>
                  <th className="px-1 py-2 w-[60px]">Barcode</th>
                  <th className="px-1 py-2 w-[60px] text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {inlineRows.map((row, idx) => (
                  <tr key={row.key} className="border-b border-pos-surface-container hover:bg-[hsl(125,40%,97%)] dark:hover:bg-[hsl(125,20%,12%)] transition-colors group"
                    onKeyDown={e => handleInlineKeyDown(e, idx)}>
                    <td className="px-1 py-0.5 text-center text-[10px] text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <input ref={el => nameRefs.current[idx] = el} value={row.name} onChange={e => updateInlineRow(idx, 'name', e.target.value)}
                        className={`${inputCls} font-semibold`} placeholder="Product Name" />
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <select value={row.category} onChange={e => updateInlineRow(idx, 'category', e.target.value)} className={selectCls}>
                        {PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <select value={row.brand} onChange={e => updateInlineRow(idx, 'brand', e.target.value)} className={selectCls}>
                        <option value="">—</option>
                        {PRODUCT_BRANDS.map(b => <option key={b}>{b}</option>)}
                      </select>
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <input value={row.size} onChange={e => updateInlineRow(idx, 'size', e.target.value)} className={inputCls} placeholder="60×60" />
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <select value={row.finish} onChange={e => updateInlineRow(idx, 'finish', e.target.value)} className={selectCls}>
                        {FINISHES.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <input type="number" value={row.buyRate} onChange={e => updateInlineRow(idx, 'buyRate', e.target.value)} className={`${inputCls} text-right`} placeholder="900" />
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container bg-[hsl(54,97%,95%)] dark:bg-[hsl(54,30%,15%)]">
                      <input type="number" value={row.pricePerBox} onChange={e => updateInlineRow(idx, 'pricePerBox', e.target.value)} className={`${inputCls} text-right font-bold`} placeholder="1200" />
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <input type="number" value={row.sqftPerBox} onChange={e => updateInlineRow(idx, 'sqftPerBox', e.target.value)} className={`${inputCls} text-right`} placeholder="9.6" />
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <input type="number" value={row.piecesPerBox} onChange={e => updateInlineRow(idx, 'piecesPerBox', e.target.value)} className={`${inputCls} text-center`} placeholder="4" />
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <input type="number" value={row.stock} onChange={e => updateInlineRow(idx, 'stock', e.target.value)} className={`${inputCls} text-center`} placeholder="100" />
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <input value={row.batch} onChange={e => updateInlineRow(idx, 'batch', e.target.value)} className={inputCls} placeholder="BT-01" />
                    </td>
                    <td className="px-0 py-0.5 border-r border-pos-surface-container">
                      <input value={row.barcode} onChange={e => updateInlineRow(idx, 'barcode', e.target.value)} className={inputCls} placeholder="001" />
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => saveInlineRow(idx)}
                          className="w-6 h-6 rounded bg-[hsl(125,60%,35%)] text-white flex items-center justify-center hover:bg-[hsl(125,60%,30%)] transition-colors"
                          title="Save (Enter)">
                          <span className="material-symbols-outlined text-sm">check</span>
                        </button>
                        <button onClick={() => removeInlineRow(idx)}
                          className="w-6 h-6 rounded bg-pos-error/80 text-white flex items-center justify-center hover:bg-pos-error transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove row">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addInlineRow}
            className="w-full py-2 border-t border-dashed border-pos-surface-container text-xs text-muted-foreground hover:text-[hsl(125,60%,35%)] hover:bg-[hsl(125,40%,97%)] dark:hover:bg-[hsl(125,20%,12%)] transition-colors flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">add</span>Add Row
          </button>
        </div>
      )}

      {/* ═══ PRODUCT LIST TABLE ═══ */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-pos-surface-low">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">{t('allProducts')} <span className="text-pos-on-surface-variant font-normal">({filtered.length})</span></h3>
          </div>
          <div className="relative w-full sm:w-auto">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-full sm:w-52 bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder={t('searchProducts')} />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
                <th className="px-3 py-2.5">{t('barcode')}</th>
                <th className="px-3 py-2.5">{t('categoryLabel')}</th>
                <th className="px-3 py-2.5">{t('productName')}</th>
                <th className="px-3 py-2.5 hidden md:table-cell">{t('size')}</th>
                <th className="px-3 py-2.5 hidden md:table-cell">{t('brandLabel')}</th>
                <th className="px-3 py-2.5 hidden lg:table-cell">{t('buyRateLabel')}</th>
                <th className="px-3 py-2.5">{t('salesRateLabel')}</th>
                <th className="px-3 py-2.5 hidden lg:table-cell">Pcs/Box</th>
                <th className="px-3 py-2.5">{t('stock')}</th>
                <th className="px-3 py-2.5 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginatedProducts.map((p) => (
                <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                  <td className="px-3 py-3 text-xs font-mono text-pos-on-surface-variant">{p.barcode || p.batch || '—'}</td>
                  <td className="px-3 py-3 text-xs">{p.category || '—'}</td>
                  <td className="px-3 py-3 font-semibold text-sm">{p.name}</td>
                  <td className="px-3 py-3 hidden md:table-cell"><span className="px-2 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-xs font-bold">{p.size}</span></td>
                  <td className="px-3 py-3 text-xs hidden md:table-cell">{p.brand || '—'}</td>
                  <td className="px-3 py-3 text-xs hidden lg:table-cell">{formatCurrency(p.buyRate || 0)}</td>
                  <td className="px-3 py-3 font-bold text-pos-secondary">{formatCurrency(p.pricePerBox)}</td>
                  <td className="px-3 py-3 text-xs hidden lg:table-cell text-center">{p.piecesPerBox || 4}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.stock <= 0 ? 'bg-pos-error text-white' : p.stock <= 20 ? 'bg-pos-error-container text-pos-on-error-container' : 'bg-pos-tertiary-container text-pos-on-tertiary-container'}`}>
                      {p.stock} {t('boxes')} {p.stock <= 20 && '⚠'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="w-6 h-6 rounded bg-[hsl(125,60%,35%)] text-white flex items-center justify-center" title={t('edit')}><span className="material-symbols-outlined text-sm">edit</span></button>
                      <button className="w-6 h-6 rounded bg-pos-secondary text-white flex items-center justify-center" title={t('barcode')}><span className="material-symbols-outlined text-sm">barcode</span></button>
                      {onDeleteProduct && <button onClick={() => setShowDeleteConfirm(p.id)} className="w-6 h-6 rounded bg-pos-error text-white flex items-center justify-center" title={t('delete')}><span className="material-symbols-outlined text-sm">delete</span></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedProducts.length === 0 && (
                <tr><td colSpan={10} className="px-8 py-8 text-center text-xs text-pos-on-surface-variant">{t('noProducts')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
      </div>

      {/* ═══ MODAL (for edit or modal-mode add) ═══ */}
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
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Pieces/Box (পিস/বক্স)</label><input value={form.piecesPerBox} onChange={e => setForm(f => ({ ...f, piecesPerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="4" /></div>
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

      {/* Delete Confirm */}
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
