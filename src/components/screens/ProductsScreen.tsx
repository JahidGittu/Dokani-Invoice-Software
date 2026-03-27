import { useState, useMemo } from "react";
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

const PAGE_SIZE = 10;

export default function ProductsScreen({ products, onAddProduct, onUpdateProduct, onDeleteProduct }: ProductsScreenProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({
    name: '', size: '', finish: 'Glossy', pricePerBox: '', sqftPerBox: '', stock: '', batch: '',
    barcode: '', category: 'Wall Tiles', brand: '', buyRate: '',
  });

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

  const resetForm = () => setForm({ name: '', size: '', finish: 'Glossy', pricePerBox: '', sqftPerBox: '', stock: '', batch: '', barcode: '', category: 'Wall Tiles', brand: '', buyRate: '' });

  const handleSave = () => {
    if (!form.name || !form.pricePerBox) { toast.error(t('nameAndPriceReq')); return; }
    const data = {
      name: form.name, size: form.size, finish: form.finish,
      pricePerBox: parseFloat(form.pricePerBox), sqftPerBox: parseFloat(form.sqftPerBox) || 0,
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

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('stockManagement')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('products')}</h2>
        </div>
        <button onClick={() => { resetForm(); setEditId(null); setShowAddModal(true); }} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span>{t('addProduct')}
        </button>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-4 sm:px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-pos-surface-low">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">{t('allProducts')} <span className="text-pos-on-surface-variant font-normal">({filtered.length})</span></h3>
            <select value={PAGE_SIZE} className="bg-pos-surface-high border-none rounded text-xs py-1 px-2 outline-none text-pos-on-surface">
              <option>10</option>
            </select>
            <span className="text-xs text-pos-on-surface-variant">{t('entries')}</span>
          </div>
          <div className="relative w-full sm:w-auto">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-full sm:w-52 bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder={t('searchProducts')} />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
                <th className="px-4 sm:px-6 py-3">{t('barcode')}</th>
                <th className="px-4 sm:px-6 py-3">{t('categoryLabel')}</th>
                <th className="px-4 sm:px-6 py-3">{t('productName')}</th>
                <th className="px-4 sm:px-6 py-3 hidden md:table-cell">{t('size')}</th>
                <th className="px-4 sm:px-6 py-3 hidden md:table-cell">{t('brandLabel')}</th>
                <th className="px-4 sm:px-6 py-3 hidden lg:table-cell">{t('buyRateLabel')}</th>
                <th className="px-4 sm:px-6 py-3">{t('salesRateLabel')}</th>
                <th className="px-4 sm:px-6 py-3">{t('stock')}</th>
                <th className="px-4 sm:px-6 py-3 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginatedProducts.map((p) => (
                <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                  <td className="px-4 sm:px-6 py-4 text-xs font-mono text-pos-on-surface-variant">{p.barcode || p.batch || '—'}</td>
                  <td className="px-4 sm:px-6 py-4 text-xs">{p.category || '—'}</td>
                  <td className="px-4 sm:px-6 py-4 font-semibold">{p.name}</td>
                  <td className="px-4 sm:px-6 py-4 hidden md:table-cell"><span className="px-2 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-xs font-bold">{p.size}</span></td>
                  <td className="px-4 sm:px-6 py-4 text-xs hidden md:table-cell">{p.brand || '—'}</td>
                  <td className="px-4 sm:px-6 py-4 text-xs hidden lg:table-cell">{formatCurrency(p.buyRate || 0)}</td>
                  <td className="px-4 sm:px-6 py-4 font-bold text-pos-secondary">{formatCurrency(p.pricePerBox)}</td>
                  <td className="px-4 sm:px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${p.stock <= 0 ? 'bg-pos-error text-white' : p.stock <= 20 ? 'bg-pos-error-container text-pos-on-error-container' : 'bg-pos-tertiary-container text-pos-on-tertiary-container'}`}>
                      {p.stock} {t('boxes')} {p.stock <= 20 && '⚠'}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="w-7 h-7 rounded bg-[hsl(125,60%,35%)] text-white flex items-center justify-center" title={t('edit')}><span className="material-symbols-outlined text-sm">edit</span></button>
                      <button className="w-7 h-7 rounded bg-pos-secondary text-white flex items-center justify-center" title={t('barcode')}><span className="material-symbols-outlined text-sm">barcode</span></button>
                      {onDeleteProduct && <button onClick={() => setShowDeleteConfirm(p.id)} className="w-7 h-7 rounded bg-pos-error text-white flex items-center justify-center" title={t('delete')}><span className="material-symbols-outlined text-sm">delete</span></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedProducts.length === 0 && (
                <tr><td colSpan={9} className="px-8 py-8 text-center text-xs text-pos-on-surface-variant">{t('noProducts')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="px-6 py-3 bg-pos-surface-low border-t border-pos-surface-container flex justify-between items-center">
            <span className="text-xs text-pos-on-surface-variant">{t('showing')} {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {t('of')} {filtered.length}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">{t('prev')}</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`w-7 h-7 text-xs font-bold rounded-lg ${page === i ? 'bg-pos-secondary text-white' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>{i + 1}</button>
              )).slice(Math.max(0, page - 2), page + 3)}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">{t('next')}</button>
            </div>
          </div>
        )}
      </div>

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
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('finish')}</label><select value={form.finish} onChange={e => setForm(f => ({ ...f, finish: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"><option>Glossy</option><option>Matte</option><option>Lappato</option><option>Rustic</option><option>Carving</option></select></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('buyRateLabel')} (৳)</label><input value={form.buyRate} onChange={e => setForm(f => ({ ...f, buyRate: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="900" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('salesRateLabel')} (৳) *</label><input value={form.pricePerBox} onChange={e => setForm(f => ({ ...f, pricePerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="1200" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('sqftPerBox')}</label><input value={form.sqftPerBox} onChange={e => setForm(f => ({ ...f, sqftPerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="9.2" /></div>
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
