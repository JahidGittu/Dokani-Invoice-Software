import { useState, useMemo, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { type Product, formatCurrency } from "@/lib/store";
import { useProductOptions } from "@/hooks/useProductOptions";
import ComboInput from "@/components/ComboInput";
import { toast } from "sonner";

interface ProductsScreenProps {
  products: Product[];
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
}

const PAGE_SIZE = 20;
const UNIT_OPTIONS = ['SQFT', 'Piece', 'Set', 'KG', 'Litre', 'Yard', 'Feet', 'Roll', 'Box'];

interface AddFormData {
  barcode: string; category: string; name: string; brand: string;
  unit: string; height: string; width: string; piecesPerBox: string;
  buyRate: string; pricePerBox: string; stock: string; reorderLimit: string;
  size: string; finish: string; sqftPerBox: string; batch: string;
}

const emptyForm = (): AddFormData => ({
  barcode: '', category: 'Wall Tiles', name: '', brand: '',
  unit: 'SQFT', height: '', width: '', piecesPerBox: '4',
  buyRate: '', pricePerBox: '', stock: '', reorderLimit: '15',
  size: '', finish: 'Glossy', sqftPerBox: '', batch: '',
});

type EditableField = 'name' | 'category' | 'brand' | 'size' | 'finish' | 'buyRate' | 'pricePerBox' | 'sqftPerBox' | 'piecesPerBox' | 'stock' | 'batch';
type ComboField = 'category' | 'brand' | 'size' | 'finish';
const COMBO_FIELDS: ComboField[] = ['category', 'brand', 'size', 'finish'];

export default function ProductsScreen({ products, onAddProduct, onUpdateProduct, onDeleteProduct }: ProductsScreenProps) {
  const { t } = useI18n();
  const { getOptions, addOption } = useProductOptions();
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showAddForm, setShowAddForm] = useState(true);

  // Inline cell editing
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  // Add form
  const [form, setForm] = useState<AddFormData>(emptyForm());
  const nameRef = useRef<HTMLInputElement>(null);

  const [sortField, setSortField] = useState<'name' | 'updated_at' | 'stock' | 'pricePerBox' | 'category' | 'brand'>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };
  const sortIcon = (field: typeof sortField) => sortField === field ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';

  const debouncedSearch = useDebounce(search, 250);
  const filtered = useMemo(() => {
    const list = products.filter(p =>
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.batch.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(debouncedSearch.toLowerCase())
    );
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'stock') cmp = a.stock - b.stock;
      else if (sortField === 'pricePerBox') cmp = a.pricePerBox - b.pricePerBox;
      else if (sortField === 'category') cmp = (a.category || '').localeCompare(b.category || '');
      else if (sortField === 'brand') cmp = (a.brand || '').localeCompare(b.brand || '');
      else cmp = (a.id || '').localeCompare(b.id || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [products, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedProducts = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  // ── Inline cell edit helpers ──
  const startEdit = (productId: string, field: EditableField, currentValue: string | number) => {
    setEditingCell(`${productId}:${field}`);
    setEditValue(String(currentValue ?? ''));
    setTimeout(() => editRef.current?.focus(), 30);
  };

  const commitEdit = useCallback((productId: string, field: EditableField, value: string) => {
    const numericFields = ['buyRate', 'pricePerBox', 'sqftPerBox', 'piecesPerBox', 'stock'];
    const update: Partial<Product> = {};
    if (numericFields.includes(field)) {
      (update as any)[field] = parseFloat(value) || 0;
    } else {
      (update as any)[field] = value;
    }
    onUpdateProduct(productId, update);
    setEditingCell(null);
  }, [onUpdateProduct]);

  const confirmDelete = () => {
    if (showDeleteConfirm && onDeleteProduct) { onDeleteProduct(showDeleteConfirm); toast.success(t('productDeleted')); }
    setShowDeleteConfirm(null);
  };

  // ── Add form helpers ──
  const updateForm = (field: keyof AddFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Product Name is required'); return; }
    if (!form.buyRate && !form.pricePerBox) { toast.error('Buy Rate or Sales Rate is required'); return; }

    onAddProduct({
      name: form.name.trim(),
      category: form.category,
      brand: form.brand,
      size: form.size || (form.height && form.width ? `${form.height}×${form.width}` : ''),
      finish: form.finish,
      unit: form.unit,
      height: form.height,
      width: form.width,
      piecesPerBox: parseInt(form.piecesPerBox) || 4,
      buyRate: parseFloat(form.buyRate) || 0,
      pricePerBox: parseFloat(form.pricePerBox) || 0,
      sqftPerBox: parseFloat(form.sqftPerBox) || 0,
      stock: parseInt(form.stock) || 0,
      reorderLimit: parseInt(form.reorderLimit) || 0,
      batch: form.batch || form.barcode,
      barcode: form.barcode,
    });
    toast.success(`✓ ${form.name} সেভ হয়েছে`);
    setForm(emptyForm());
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const handleReset = () => setForm(emptyForm());

  const editInputCls = "w-full bg-[hsl(var(--accent))] border border-primary/30 text-xs py-1 px-1.5 outline-none rounded";
  const formInputCls = "w-full bg-[hsl(220,60%,97%)] dark:bg-[hsl(220,20%,15%)] border border-[hsl(220,30%,85%)] dark:border-[hsl(220,20%,25%)] rounded-md text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-all";

  // Render an editable cell
  const renderCell = (p: Product, field: EditableField, display: React.ReactNode, align?: string) => {
    const cellKey = `${p.id}:${field}`;
    const isEditing = editingCell === cellKey;
    const isCombo = (COMBO_FIELDS as string[]).includes(field);

    if (isEditing && isCombo) {
      return (
        <td className="px-0 py-0.5" onClick={e => e.stopPropagation()}>
          <ComboInput
            value={editValue}
            onChange={v => { setEditValue(v); commitEdit(p.id, field, v); }}
            options={getOptions(field as ComboField)}
            onAddNew={v => addOption(field as ComboField, v)}
            placeholder={field}
            className={editInputCls}
          />
        </td>
      );
    }

    if (isEditing) {
      return (
        <td className="px-0 py-0.5" onClick={e => e.stopPropagation()}>
          <input
            ref={editRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(p.id, field, editValue); }
              if (e.key === 'Escape') setEditingCell(null);
            }}
            onBlur={() => commitEdit(p.id, field, editValue)}
            type={['buyRate', 'pricePerBox', 'sqftPerBox', 'piecesPerBox', 'stock'].includes(field) ? 'number' : 'text'}
            className={`${editInputCls} ${align || ''}`}
          />
        </td>
      );
    }

    return (
      <td
        className={`px-2 py-2.5 cursor-pointer hover:bg-[hsl(var(--accent))] transition-colors ${align || ''}`}
        onDoubleClick={() => startEdit(p.id, field, (p as any)[field] ?? '')}
        title="ডাবল ক্লিক করে এডিট করুন"
      >
        {display}
      </td>
    );
  };

  return (
    <section className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--primary))] font-semibold mb-1">
            <span>Product Information</span>
            <span className="text-muted-foreground">›</span>
            <span>{showAddForm ? 'Add Product' : 'Product List'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-pos-on-surface leading-tight tracking-tighter">
            {t('products')} <span className="text-lg font-normal text-pos-on-surface-variant">({products.length})</span>
          </h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-base">{showAddForm ? 'list' : 'add'}</span>
          {showAddForm ? 'Product List' : 'Add Product'}
        </button>
      </div>

      {/* ═══ ADD PRODUCT FORM (Card Style like epos) ═══ */}
      {showAddForm && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-5 sm:p-6">
          {/* Row 1: Barcode, Category, Product Name, Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Barcode</label>
              <input value={form.barcode} onChange={e => updateForm('barcode', e.target.value)} className={formInputCls} placeholder="Barcode / Product Code" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <ComboInput value={form.category} onChange={v => updateForm('category', v)} options={getOptions('category')} onAddNew={v => addOption('category', v)} placeholder="Select Category" className={formInputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input ref={nameRef} value={form.name} onChange={e => updateForm('name', e.target.value)} className={formInputCls} placeholder="Enter product name" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Product Brand</label>
              <ComboInput value={form.brand} onChange={v => updateForm('brand', v)} options={getOptions('brand')} onAddNew={v => addOption('brand', v)} placeholder="Select Brand" className={formInputCls} />
            </div>
          </div>

          {/* Row 2: Unit, Height, Width, Unit Per Carton, Buy Rate, Sales Rate */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
                Unit <span className="text-red-500">*</span>
              </label>
              <select value={form.unit} onChange={e => updateForm('unit', e.target.value)} className={formInputCls}>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Height</label>
              <input type="number" value={form.height} onChange={e => updateForm('height', e.target.value)} className={formInputCls} placeholder="Height" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Width</label>
              <input type="number" value={form.width} onChange={e => updateForm('width', e.target.value)} className={formInputCls} placeholder="Width" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Unit Per Carton</label>
              <input type="number" value={form.piecesPerBox} onChange={e => updateForm('piecesPerBox', e.target.value)} className={formInputCls} placeholder="e.g. 10" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
                Buy Rate <span className="text-red-500">*</span>
              </label>
              <input type="number" value={form.buyRate} onChange={e => updateForm('buyRate', e.target.value)} className={formInputCls} placeholder="৳ 0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Sales Rate</label>
              <input type="number" value={form.pricePerBox} onChange={e => updateForm('pricePerBox', e.target.value)} className={formInputCls} placeholder="৳ 0" />
            </div>
          </div>

          {/* Row 3: Opening Stock, Re-Order Limit, Size, Finish, Sqft/Box */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Opening Stock</label>
              <input type="number" value={form.stock} onChange={e => updateForm('stock', e.target.value)} className={formInputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Re-Order Limit</label>
              <input type="number" value={form.reorderLimit} onChange={e => updateForm('reorderLimit', e.target.value)} className={formInputCls} placeholder="15" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Size</label>
              <ComboInput value={form.size} onChange={v => updateForm('size', v)} options={getOptions('size')} onAddNew={v => addOption('size', v)} placeholder="e.g. 60×60" className={formInputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Finish</label>
              <ComboInput value={form.finish} onChange={v => updateForm('finish', v)} options={getOptions('finish')} onAddNew={v => addOption('finish', v)} placeholder="Finish" className={formInputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Sqft/Box</label>
              <input type="number" value={form.sqftPerBox} onChange={e => updateForm('sqftPerBox', e.target.value)} className={formInputCls} placeholder="0" />
            </div>
          </div>

          {/* Save & Reset Buttons */}
          <div className="flex gap-3">
            <button onClick={handleSave}
              className="px-6 py-2.5 bg-[hsl(125,60%,38%)] text-white rounded-lg font-semibold text-sm hover:bg-[hsl(125,60%,32%)] transition-colors shadow-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">save</span>
              Save
            </button>
            <button onClick={handleReset}
              className="px-6 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm hover:bg-pos-surface-high transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative w-full sm:w-auto">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-full sm:w-64 bg-pos-surface-high border-none rounded-lg text-xs py-2.5 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder={t('searchProducts')} />
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
      </div>

      {/* ═══ PRODUCT TABLE ═══ */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full min-w-[1100px] relative">
            <thead className="sticky top-0 z-10">
              <tr className="text-[9px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-low border-b border-pos-surface-container">
                <th className="px-2 py-2.5 w-8 text-center">#</th>
                <th className="px-2 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  <span className="inline-flex items-center gap-0.5">{t('productName')} <span className="material-symbols-outlined text-[10px]">{sortIcon('name')}</span></span>
                </th>
                <th className="px-2 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('category')}>
                  <span className="inline-flex items-center gap-0.5">{t('categoryLabel')} <span className="material-symbols-outlined text-[10px]">{sortIcon('category')}</span></span>
                </th>
                <th className="px-2 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('brand')}>
                  <span className="inline-flex items-center gap-0.5">{t('brandLabel')} <span className="material-symbols-outlined text-[10px]">{sortIcon('brand')}</span></span>
                </th>
                <th className="px-2 py-2.5">{t('size')}</th>
                <th className="px-2 py-2.5">Finish</th>
                <th className="px-2 py-2.5 text-right">{t('buyRateLabel')}</th>
                <th className="px-2 py-2.5 text-right cursor-pointer select-none" onClick={() => toggleSort('pricePerBox')}>
                  <span className="inline-flex items-center gap-0.5 justify-end">{t('salesRateLabel')} <span className="material-symbols-outlined text-[10px]">{sortIcon('pricePerBox')}</span></span>
                </th>
                <th className="px-2 py-2.5 text-center">Sqft</th>
                <th className="px-2 py-2.5 text-center">Pcs</th>
                <th className="px-2 py-2.5 text-center cursor-pointer select-none" onClick={() => toggleSort('stock')}>
                  <span className="inline-flex items-center gap-0.5">{t('stock')} <span className="material-symbols-outlined text-[10px]">{sortIcon('stock')}</span></span>
                </th>
                <th className="px-2 py-2.5">Bar/Code</th>
                <th className="px-2 py-2.5 text-center w-12">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginatedProducts.map((p, idx) => (
                <tr key={p.id} className="hover:bg-pos-surface-low transition-colors group">
                  <td className="px-2 py-2.5 text-center text-[10px] text-muted-foreground font-mono">{page * PAGE_SIZE + idx + 1}</td>
                  {renderCell(p, 'name', <span className="font-semibold text-sm">{p.name}</span>)}
                  {renderCell(p, 'category', <span className="text-xs">{p.category || '—'}</span>)}
                  {renderCell(p, 'brand', <span className="text-xs">{p.brand || '—'}</span>)}
                  {renderCell(p, 'size', <span className="px-1.5 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-[10px] font-bold">{p.size || '—'}</span>)}
                  {renderCell(p, 'finish', <span className="text-xs">{p.finish}</span>)}
                  {renderCell(p, 'buyRate', <span className="text-xs">{formatCurrency(p.buyRate || 0)}</span>, 'text-right')}
                  {renderCell(p, 'pricePerBox', <span className="font-bold text-pos-secondary text-sm">{formatCurrency(p.pricePerBox)}</span>, 'text-right')}
                  {renderCell(p, 'sqftPerBox', <span className="text-xs">{p.sqftPerBox || '—'}</span>, 'text-center')}
                  {renderCell(p, 'piecesPerBox', <span className="text-xs">{p.piecesPerBox || 4}</span>, 'text-center')}
                  {renderCell(p, 'stock', (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${p.stock <= 0 ? 'bg-pos-error text-white' : p.stock <= (p.reorderLimit || 20) ? 'bg-pos-error-container text-pos-on-error-container' : 'bg-pos-tertiary-container text-pos-on-tertiary-container'}`}>
                      {p.stock}
                    </span>
                  ), 'text-center')}
                  {renderCell(p, 'batch', <span className="text-[10px] font-mono text-muted-foreground">{p.barcode || p.batch || '—'}</span>)}
                  <td className="px-2 py-2.5 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => {
                        const w = window.open('', '_blank', 'width=400,height=300');
                        if (!w) return;
                        w.document.write(`<!DOCTYPE html><html><head><title>Barcode</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:monospace;text-align:center}h2{margin:0;font-size:18px}p{font-size:24px;letter-spacing:4px;font-weight:900;margin:8px 0}@media print{body{margin:0}}</style></head><body><h2>${p.name}</h2><p>${p.barcode || p.batch || p.id.slice(0,8)}</p><div style="font-size:12px">${p.size} · ${p.category || ''}</div></body></html>`);
                        w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
                      }}
                        className="w-5 h-5 rounded bg-[hsl(25,95%,53%)] text-white flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity" title="Barcode Print">
                        <span className="material-symbols-outlined text-xs">barcode</span>
                      </button>
                      {onDeleteProduct && (
                        <button onClick={() => setShowDeleteConfirm(p.id)} className="w-5 h-5 rounded bg-pos-error text-white flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity" title={t('delete')}>
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedProducts.length === 0 && !search && (
                <tr><td colSpan={13} className="px-8 py-6 text-center text-xs text-pos-on-surface-variant">{t('noProducts')}</td></tr>
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
          <span><kbd className="px-1 py-0.5 bg-pos-surface-container rounded text-[9px] font-mono">Double Click</kbd> সেল এডিট</span>
          <span>টেবিলে যেকোনো সেল ডাবল ক্লিক করে এডিট করুন</span>
        </div>
      </div>

      {/* Delete confirm */}
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
