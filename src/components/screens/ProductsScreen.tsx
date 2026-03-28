import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import BulkProductView from "@/components/BulkProductView";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { type Product, formatCurrency } from "@/lib/store";
import { useProductOptions } from "@/hooks/useProductOptions";
import ComboInput from "@/components/ComboInput";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import JsBarcode from "jsbarcode";
import { TILE_SIZE_OPTIONS, getAutoPackaging } from "@/lib/tile-packaging";

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

export default function ProductsScreen({ products, onAddProduct, onUpdateProduct, onDeleteProduct }: ProductsScreenProps) {
  const { t } = useI18n();
  const { getOptions, addOption } = useProductOptions();
  const [search, setSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [activeView, setActiveView] = useState<'add' | 'bulk' | 'list'>('add');

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<AddFormData>(emptyForm());

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Barcode modal
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [barcodeQty, setBarcodeQty] = useState(1);
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13'>('CODE128');
  const barcodeContainerRef = useRef<HTMLDivElement>(null);

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

  const confirmDelete = () => {
    if (showDeleteConfirm && onDeleteProduct) { onDeleteProduct(showDeleteConfirm); toast.success(t('productDeleted')); }
    setShowDeleteConfirm(null);
  };

  // ── Image upload helper ──
  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleImageSelect = (file: File | null, isEdit = false) => {
    if (!file) {
      isEdit ? (setEditImageFile(null), setEditImagePreview('')) : (setImageFile(null), setImagePreview(''));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) { setEditImageFile(file); setEditImagePreview(reader.result as string); }
      else { setImageFile(file); setImagePreview(reader.result as string); }
    };
    reader.readAsDataURL(file);
  };

  // ── Add form helpers ──
  const updateForm = (field: keyof AddFormData, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Auto-suggest piecesPerBox when height or width changes
      if ((field === 'height' || field === 'width') && next.unit === 'SQFT') {
        const pkg = getAutoPackaging(
          field === 'height' ? value : next.height,
          field === 'width' ? value : next.width
        );
        if (pkg) next.piecesPerBox = String(pkg.piecesPerBox);
      }
      return next;
    });
  };

  const applyTileSize = (sizeOpt: typeof TILE_SIZE_OPTIONS[0], update: (f: keyof AddFormData, v: string) => void) => {
    update('height', sizeOpt.height);
    update('width', sizeOpt.width);
    update('piecesPerBox', String(sizeOpt.piecesPerBox));
  };

  const isSqft = (unit: string) => unit === 'SQFT';

  const validateForm = (f: AddFormData): string | null => {
    if (!f.name.trim()) return 'Product Name is required';
    if (!f.buyRate && !f.pricePerBox) return 'Buy Rate or Sales Rate is required';
    if (isSqft(f.unit)) {
      if (!f.height.trim()) return 'Height is required for SQFT unit';
      if (!f.width.trim()) return 'Width is required for SQFT unit';
      if (!f.piecesPerBox.trim() || parseInt(f.piecesPerBox) <= 0) return 'Unit Per Carton is required for SQFT unit';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateForm(form);
    if (err) { toast.error(err); return; }

    let imageUrl = '';
    if (imageFile) {
      try {
        setUploading(true);
        imageUrl = await uploadImage(imageFile);
      } catch {
        toast.error('Image upload failed');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onAddProduct({
      name: form.name.trim(), category: form.category, brand: form.brand,
      size: form.size || (form.height && form.width ? `${form.height}×${form.width}` : ''),
      finish: form.finish, unit: form.unit, height: form.height, width: form.width,
      piecesPerBox: parseInt(form.piecesPerBox) || 4, buyRate: parseFloat(form.buyRate) || 0,
      pricePerBox: parseFloat(form.pricePerBox) || 0, sqftPerBox: parseFloat(form.sqftPerBox) || 0,
      stock: parseInt(form.stock) || 0, reorderLimit: parseInt(form.reorderLimit) || 0,
      batch: form.batch || form.barcode, barcode: form.barcode, imageUrl,
    });
    toast.success(`✓ ${form.name} সেভ হয়েছে`);
    setForm(emptyForm());
    setImageFile(null);
    setImagePreview('');
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const handleReset = () => { setForm(emptyForm()); setImageFile(null); setImagePreview(''); };

  // ── Edit modal helpers ──
  const openEditModal = (p: Product) => {
    setEditProduct(p);
    setEditForm({
      barcode: p.barcode || '', category: p.category || '', name: p.name, brand: p.brand || '',
      unit: p.unit || 'SQFT', height: p.height || '', width: p.width || '', piecesPerBox: String(p.piecesPerBox || 4),
      buyRate: String(p.buyRate || ''), pricePerBox: String(p.pricePerBox || ''),
      stock: String(p.stock || ''), reorderLimit: String(p.reorderLimit || 0),
      size: p.size || '', finish: p.finish || '', sqftPerBox: String(p.sqftPerBox || ''), batch: p.batch || '',
    });
    setEditImagePreview(p.imageUrl || '');
    setEditImageFile(null);
  };

  const saveEdit = async () => {
    if (!editProduct) return;
    const err = validateForm(editForm);
    if (err) { toast.error(err); return; }

    let imageUrl = editProduct.imageUrl || '';
    if (editImageFile) {
      try {
        setUploading(true);
        imageUrl = await uploadImage(editImageFile);
      } catch {
        toast.error('Image upload failed');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onUpdateProduct(editProduct.id, {
      name: editForm.name.trim(), category: editForm.category, brand: editForm.brand,
      size: editForm.size || (editForm.height && editForm.width ? `${editForm.height}×${editForm.width}` : ''),
      finish: editForm.finish, unit: editForm.unit, height: editForm.height, width: editForm.width,
      piecesPerBox: parseInt(editForm.piecesPerBox) || 4, buyRate: parseFloat(editForm.buyRate) || 0,
      pricePerBox: parseFloat(editForm.pricePerBox) || 0, sqftPerBox: parseFloat(editForm.sqftPerBox) || 0,
      stock: parseInt(editForm.stock) || 0, reorderLimit: parseInt(editForm.reorderLimit) || 0,
      batch: editForm.batch || editForm.barcode, barcode: editForm.barcode, imageUrl,
    });
    toast.success(`✓ ${editForm.name} আপডেট হয়েছে`);
    setEditProduct(null);
    setEditImageFile(null);
    setEditImagePreview('');
  };

  const updateEditForm = (field: keyof AddFormData, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // ── Barcode generation ──
  useEffect(() => {
    if (!barcodeProduct || !barcodeContainerRef.current) return;
    const container = barcodeContainerRef.current;
    container.innerHTML = '';
    const code = barcodeProduct.barcode || barcodeProduct.batch || barcodeProduct.id.slice(0, 12);

    for (let i = 0; i < barcodeQty; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'inline-block border border-dashed border-gray-300 p-3 m-1 text-center';
      wrapper.style.pageBreakInside = 'avoid';

      const nameEl = document.createElement('div');
      nameEl.className = 'text-xs font-bold mb-1';
      nameEl.textContent = barcodeProduct.name;
      wrapper.appendChild(nameEl);

      if (barcodeProduct.size || (barcodeProduct.height && barcodeProduct.width)) {
        const sizeEl = document.createElement('div');
        sizeEl.className = 'text-[10px] text-gray-500 mb-1';
        sizeEl.textContent = barcodeProduct.size || `${barcodeProduct.height}×${barcodeProduct.width}`;
        wrapper.appendChild(sizeEl);
      }

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      wrapper.appendChild(svg);

      const priceEl = document.createElement('div');
      priceEl.className = 'text-xs font-bold mt-1';
      priceEl.textContent = `৳${barcodeProduct.pricePerBox}`;
      wrapper.appendChild(priceEl);

      container.appendChild(wrapper);

      try {
        JsBarcode(svg, code, {
          format: barcodeFormat,
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 11,
          margin: 2,
        });
      } catch {
        svg.remove();
        const errEl = document.createElement('div');
        errEl.className = 'text-red-500 text-xs py-2';
        errEl.textContent = `Invalid barcode for ${barcodeFormat}. Try CODE128.`;
        wrapper.insertBefore(errEl, priceEl);
      }
    }
  }, [barcodeProduct, barcodeQty, barcodeFormat]);

  const printBarcodes = () => {
    if (!barcodeContainerRef.current) return;
    const w = window.open('', '_blank', 'width=600,height=400');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Barcodes - ${barcodeProduct?.name}</title>
      <style>body{font-family:sans-serif;padding:10px}
      .barcode-item{display:inline-block;border:1px dashed #ccc;padding:12px;margin:4px;text-align:center;page-break-inside:avoid}
      @media print{body{margin:0;padding:5px}.barcode-item{border:1px dashed #ddd}}</style></head><body>`);
    w.document.write(barcodeContainerRef.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const formInputCls = "w-full bg-[hsl(220,60%,97%)] dark:bg-[hsl(220,20%,15%)] border border-[hsl(220,30%,85%)] dark:border-[hsl(220,20%,25%)] rounded-md text-sm py-2.5 px-3 outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] transition-all";

  // Shared form renderer
  const renderFormFields = (
    f: AddFormData,
    update: (field: keyof AddFormData, val: string) => void,
    imgPreview: string,
    onImgChange: (file: File | null) => void,
    ref?: React.RefObject<HTMLInputElement>
  ) => {
    const sqftRequired = isSqft(f.unit);
    return (
      <>
        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Barcode</label>
            <input value={f.barcode} onChange={e => update('barcode', e.target.value)} className={formInputCls} placeholder="Barcode / Product Code" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Category <span className="text-destructive">*</span></label>
            <ComboInput value={f.category} onChange={v => update('category', v)} options={getOptions('category')} onAddNew={v => addOption('category', v)} placeholder="Select Category" className={formInputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Product Name <span className="text-destructive">*</span></label>
            <input ref={ref || undefined} value={f.name} onChange={e => update('name', e.target.value)} className={formInputCls} placeholder="Enter product name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Product Brand</label>
            <ComboInput value={f.brand} onChange={v => update('brand', v)} options={getOptions('brand')} onAddNew={v => addOption('brand', v)} placeholder="Select Brand" className={formInputCls} />
          </div>
        </div>
        {/* Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Unit <span className="text-destructive">*</span></label>
            <select value={f.unit} onChange={e => update('unit', e.target.value)} className={formInputCls}>
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {sqftRequired && (
            <div>
              <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
                সাইজ সিলেক্ট <span className="text-muted-foreground font-normal text-[10px]">(দ্রুত)</span>
              </label>
              <select
                value={f.height && f.width ? `${f.height}×${f.width}` : ''}
                onChange={e => {
                  const opt = TILE_SIZE_OPTIONS.find(o => o.value === e.target.value);
                  if (opt) { update('height', opt.height); update('width', opt.width); update('piecesPerBox', String(opt.piecesPerBox)); }
                }}
                className={formInputCls}
              >
                <option value="">কাস্টম সাইজ</option>
                {TILE_SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
              Height {sqftRequired && <span className="text-destructive">*</span>}
            </label>
            <input type="number" value={f.height} onChange={e => update('height', e.target.value)} className={`${formInputCls} ${sqftRequired && !f.height.trim() ? 'ring-2 ring-destructive/50' : ''}`} placeholder='সে.মি.' />
          </div>
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
              Width {sqftRequired && <span className="text-destructive">*</span>}
            </label>
            <input type="number" value={f.width} onChange={e => update('width', e.target.value)} className={`${formInputCls} ${sqftRequired && !f.width.trim() ? 'ring-2 ring-destructive/50' : ''}`} placeholder="Width" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
              Unit Per Carton {sqftRequired && <span className="text-destructive">*</span>}
            </label>
            <input type="number" value={f.piecesPerBox} onChange={e => update('piecesPerBox', e.target.value)} className={`${formInputCls} ${sqftRequired && (!f.piecesPerBox.trim() || parseInt(f.piecesPerBox) <= 0) ? 'ring-2 ring-destructive/50' : ''}`} placeholder="e.g. 10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Buy Rate <span className="text-destructive">*</span></label>
            <input type="number" value={f.buyRate} onChange={e => update('buyRate', e.target.value)} className={formInputCls} placeholder="৳ 0" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Sales Rate</label>
            <input type="number" value={f.pricePerBox} onChange={e => update('pricePerBox', e.target.value)} className={formInputCls} placeholder="৳ 0" />
          </div>
        </div>
        {/* Row 3: Stock, Reorder, Image */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Opening Stock</label>
            <input type="number" value={f.stock} onChange={e => update('stock', e.target.value)} className={formInputCls} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Re-Order Limit</label>
            <input type="number" value={f.reorderLimit} onChange={e => update('reorderLimit', e.target.value)} className={formInputCls} placeholder="15" />
          </div>
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">
              Product Image <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <label className={`${formInputCls} cursor-pointer flex items-center gap-2 text-muted-foreground`}>
                <span className="material-symbols-outlined text-base">image</span>
                <span className="truncate text-xs">{imgPreview ? 'Change Image' : 'Choose Image...'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => onImgChange(e.target.files?.[0] || null)} />
              </label>
              {imgPreview && (
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0">
                  <img src={imgPreview} alt="preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => onImgChange(null)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs">×</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
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
            <span>{activeView === 'add' ? 'Add Product' : activeView === 'bulk' ? 'Bulk Add' : 'Product List'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-pos-on-surface leading-tight tracking-tighter">
            {t('products')} <span className="text-lg font-normal text-pos-on-surface-variant">({products.length})</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveView('add')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm ${activeView === 'add' ? 'bg-[hsl(var(--primary))] text-primary-foreground' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>
            <span className="material-symbols-outlined text-base">add</span>
            Add Product
          </button>
          <button onClick={() => setActiveView('bulk')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm ${activeView === 'bulk' ? 'bg-[hsl(25,95%,53%)] text-white' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>
            <span className="material-symbols-outlined text-base">playlist_add</span>
            Bulk Add
          </button>
          <button onClick={() => setActiveView('list')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm ${activeView === 'list' ? 'bg-[hsl(var(--primary))] text-primary-foreground' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>
            <span className="material-symbols-outlined text-base">list</span>
            Product List
          </button>
        </div>
      </div>

      {/* ═══ ADD PRODUCT FORM ═══ */}
      {activeView === 'add' && (
        <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container p-5 sm:p-6">
          {renderFormFields(form, updateForm, imagePreview, (f) => handleImageSelect(f, false), nameRef)}
          <div className="flex gap-3 mt-6">
            <button onClick={handleSave} disabled={uploading}
              className="px-6 py-2.5 bg-[hsl(125,60%,38%)] text-white rounded-lg font-semibold text-sm hover:bg-[hsl(125,60%,32%)] transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined text-base">{uploading ? 'hourglass_empty' : 'add'}</span> {uploading ? 'Adding...' : 'Add Product'}
            </button>
            <button onClick={handleReset}
              className="px-6 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm hover:bg-pos-surface-high transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-base">restart_alt</span> Reset
            </button>
          </div>
        </div>
      )}

      {activeView !== 'bulk' && <>
      {/* Search bar */}
      <div className="relative w-full sm:w-auto">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-full sm:w-64 bg-pos-surface-high border-none rounded-lg text-xs py-2.5 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder={t('searchProducts')} />
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
      </div>

      {/* ═══ PRODUCT TABLE ═══ */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full min-w-[700px] relative">
            <thead className="sticky top-0 z-10">
              <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-low border-b border-pos-surface-container">
                <th className="px-3 py-3 w-10 text-center align-middle">#</th>
                <th className="px-3 py-3 text-left align-middle cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  <span className="inline-flex items-center gap-1">{t('productName')} <span className="material-symbols-outlined text-[10px]">{sortIcon('name')}</span></span>
                </th>
                <th className="px-3 py-3 text-left align-middle cursor-pointer select-none" onClick={() => toggleSort('category')}>
                  <span className="inline-flex items-center gap-1">{t('categoryLabel')} <span className="material-symbols-outlined text-[10px]">{sortIcon('category')}</span></span>
                </th>
                <th className="px-3 py-3 text-center align-middle cursor-pointer select-none" onClick={() => toggleSort('brand')}>
                  <span className="inline-flex items-center gap-1 justify-center">{t('brandLabel')} <span className="material-symbols-outlined text-[10px]">{sortIcon('brand')}</span></span>
                </th>
                <th className="px-3 py-3 text-center align-middle">{t('size')}</th>
                <th className="px-3 py-3 text-center align-middle">{t('buyRateLabel')}</th>
                <th className="px-3 py-3 text-center align-middle cursor-pointer select-none" onClick={() => toggleSort('pricePerBox')}>
                  <span className="inline-flex items-center gap-1 justify-center">{t('salesRateLabel')} <span className="material-symbols-outlined text-[10px]">{sortIcon('pricePerBox')}</span></span>
                </th>
                <th className="px-3 py-3 text-center align-middle w-36">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginatedProducts.map((p, idx) => (
                <tr key={p.id} className="hover:bg-pos-surface-low transition-colors group cursor-pointer"
                  onDoubleClick={() => openEditModal(p)} title="ডাবল ক্লিক করে এডিট করুন">
                  <td className="px-3 py-3 text-center align-middle text-[11px] text-muted-foreground font-mono">{page * PAGE_SIZE + idx + 1}</td>
                  <td className="px-3 py-3 text-left align-middle">
                    <div className="flex items-center gap-2">
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt="" className="w-7 h-7 rounded object-cover border border-border flex-shrink-0" />
                      )}
                      <span className="font-semibold text-sm">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-left align-middle text-xs">{p.category || '—'}</td>
                  <td className="px-3 py-3 text-center align-middle text-xs">{p.brand || '—'}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className="px-2 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-[10px] font-bold">{p.size || (p.height && p.width ? `${p.height}×${p.width}` : '—')}</span>
                  </td>
                  <td className="px-3 py-3 text-center align-middle text-xs font-medium tabular-nums">{formatCurrency(p.buyRate || 0)}</td>
                  <td className="px-3 py-3 text-center align-middle text-sm font-bold text-pos-secondary tabular-nums">{formatCurrency(p.pricePerBox)}</td>
                  <td className="px-3 py-3 text-center align-middle" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-center">
                      {/* On/Off Toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateProduct(p.id, { stock: p.stock > 0 ? 0 : 1 }); }}
                        className={`w-9 h-5 rounded-full relative transition-colors ${p.stock > 0 ? 'bg-[hsl(125,60%,40%)]' : 'bg-muted'}`}
                        title={p.stock > 0 ? 'Active' : 'Inactive'}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${p.stock > 0 ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      {/* Edit */}
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                        className="w-6 h-6 rounded bg-[hsl(var(--primary))] text-primary-foreground flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity" title="Edit">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      {/* Barcode */}
                      <button onClick={(e) => { e.stopPropagation(); setBarcodeProduct(p); setBarcodeQty(1); }}
                        className="w-6 h-6 rounded bg-[hsl(25,95%,53%)] text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity" title="Barcode">
                        <span className="material-symbols-outlined text-sm">barcode</span>
                      </button>
                      {/* Delete */}
                      {onDeleteProduct && (
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(p.id); }}
                          className="w-6 h-6 rounded bg-pos-error text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity" title={t('delete')}>
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedProducts.length === 0 && !search && (
                <tr><td colSpan={8} className="px-8 py-6 text-center text-xs text-pos-on-surface-variant">{t('noProducts')}</td></tr>
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
          <span><kbd className="px-1 py-0.5 bg-pos-surface-container rounded text-[9px] font-mono">Double Click</kbd> রো তে ডাবল ক্লিক করে এডিট করুন</span>
        </div>
      </div>
      </>}

      {/* ═══ EDIT MODAL ═══ */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setEditProduct(null)}>
          <div className="bg-pos-surface-lowest rounded-2xl w-full max-w-[900px] shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-pos-surface-container sticky top-0 bg-pos-surface-lowest rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[hsl(var(--primary))]">edit_note</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-pos-on-surface">Edit Product</h3>
                  <p className="text-xs text-muted-foreground">{editProduct.name}</p>
                </div>
              </div>
              <button onClick={() => setEditProduct(null)} className="w-8 h-8 rounded-lg hover:bg-pos-surface-container flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-pos-on-surface-variant">close</span>
              </button>
            </div>
            <div className="p-5 sm:p-6">
              {renderFormFields(editForm, updateEditForm, editImagePreview, (f) => handleImageSelect(f, true))}
            </div>
            <div className="flex gap-3 p-5 border-t border-pos-surface-container sticky bottom-0 bg-pos-surface-lowest rounded-b-2xl">
              <button onClick={() => setEditProduct(null)}
                className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm hover:bg-pos-surface-high transition-colors">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={uploading}
                className="flex-1 py-2.5 bg-[hsl(var(--primary))] text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-base">{uploading ? 'hourglass_empty' : 'save'}</span> {uploading ? 'Uploading...' : 'Update Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BARCODE MODAL ═══ */}
      {barcodeProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" onClick={() => setBarcodeProduct(null)}>
          <div className="bg-pos-surface-lowest rounded-2xl w-full max-w-[700px] shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-pos-surface-container">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[hsl(25,95%,53%)]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[hsl(25,95%,53%)]">barcode</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-pos-on-surface">Barcode Generator</h3>
                  <p className="text-xs text-muted-foreground">{barcodeProduct.name}</p>
                </div>
              </div>
              <button onClick={() => setBarcodeProduct(null)} className="w-8 h-8 rounded-lg hover:bg-pos-surface-container flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-pos-on-surface-variant">close</span>
              </button>
            </div>

            {/* Controls */}
            <div className="p-5 border-b border-pos-surface-container">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Barcode Value</label>
                  <input value={barcodeProduct.barcode || barcodeProduct.batch || barcodeProduct.id.slice(0, 12)} readOnly className={`${formInputCls} bg-muted`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Format</label>
                  <select value={barcodeFormat} onChange={e => setBarcodeFormat(e.target.value as 'CODE128' | 'EAN13')} className={formInputCls}>
                    <option value="CODE128">CODE128 (Any text)</option>
                    <option value="EAN13">EAN-13 (13 digits)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pos-on-surface-variant mb-1.5">Quantity</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setBarcodeQty(q => Math.max(1, q - 1))} className="w-9 h-10 rounded-md bg-pos-surface-container flex items-center justify-center text-lg font-bold hover:bg-pos-surface-high">−</button>
                    <input type="number" min={1} max={100} value={barcodeQty} onChange={e => setBarcodeQty(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      className={`${formInputCls} text-center w-16`} />
                    <button onClick={() => setBarcodeQty(q => Math.min(100, q + 1))} className="w-9 h-10 rounded-md bg-pos-surface-container flex items-center justify-center text-lg font-bold hover:bg-pos-surface-high">+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-xs font-semibold text-pos-on-surface-variant mb-3">Preview ({barcodeQty} barcode{barcodeQty > 1 ? 's' : ''})</p>
              <div ref={barcodeContainerRef} className="flex flex-wrap gap-1 justify-center" />
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 border-t border-pos-surface-container">
              <button onClick={() => setBarcodeProduct(null)}
                className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm hover:bg-pos-surface-high transition-colors">
                Close
              </button>
              <button onClick={printBarcodes}
                className="flex-1 py-2.5 bg-[hsl(25,95%,53%)] text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">print</span> Print Barcodes
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Bulk Add View */}
      {activeView === 'bulk' && (
        <BulkProductView
          products={products}
          onAddProduct={onAddProduct}
          onUpdateProduct={onUpdateProduct}
        />
      )}
    </section>
  );
}
