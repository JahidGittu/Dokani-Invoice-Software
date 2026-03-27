import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { type Product, formatCurrency } from "@/lib/store";
import { toast } from "sonner";

interface ProductsScreenProps {
  products: Product[];
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
}

export default function ProductsScreen({ products, onAddProduct, onUpdateProduct, onDeleteProduct }: ProductsScreenProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', size: '', finish: 'Glossy', pricePerBox: '', sqftPerBox: '', stock: '', batch: '' });

  const debouncedSearch = useDebounce(search, 250);
  const filtered = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || p.batch.toLowerCase().includes(debouncedSearch.toLowerCase())),
    [products, debouncedSearch]
  );

  const resetForm = () => setForm({ name: '', size: '', finish: 'Glossy', pricePerBox: '', sqftPerBox: '', stock: '', batch: '' });

  const handleSave = () => {
    if (!form.name || !form.pricePerBox) { toast.error(t('nameAndPriceReq')); return; }
    if (editId) {
      onUpdateProduct(editId, {
        name: form.name, size: form.size, finish: form.finish,
        pricePerBox: parseFloat(form.pricePerBox), sqftPerBox: parseFloat(form.sqftPerBox),
        stock: parseInt(form.stock), batch: form.batch,
      });
      toast.success(t('productUpdated'));
    } else {
      onAddProduct({
        name: form.name, size: form.size, finish: form.finish,
        pricePerBox: parseFloat(form.pricePerBox), sqftPerBox: parseFloat(form.sqftPerBox) || 0,
        stock: parseInt(form.stock) || 0, batch: form.batch,
      });
      toast.success(t('productAdded'));
    }
    setShowAddModal(false); setEditId(null); resetForm();
  };

  const openEdit = (p: Product) => {
    setForm({ name: p.name, size: p.size, finish: p.finish, pricePerBox: String(p.pricePerBox), sqftPerBox: String(p.sqftPerBox), stock: String(p.stock), batch: p.batch });
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
          <h3 className="text-base font-semibold">{t('allProducts')} <span className="text-pos-on-surface-variant font-normal">({products.length})</span></h3>
          <div className="relative w-full sm:w-auto">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-52 bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder={t('searchProducts')} />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
                <th className="px-4 sm:px-8 py-3">{t('productName')}</th><th className="px-4 sm:px-8 py-3">{t('size')}</th><th className="px-4 sm:px-8 py-3 hidden sm:table-cell">{t('finish')}</th><th className="px-4 sm:px-8 py-3">{t('pricePerBox')}</th><th className="px-4 sm:px-8 py-3 hidden md:table-cell">{t('sqftPerBox')}</th><th className="px-4 sm:px-8 py-3">{t('stock')}</th><th className="px-4 sm:px-8 py-3 hidden lg:table-cell">{t('batch')}</th><th className="px-4 sm:px-8 py-3 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                  <td className="px-4 sm:px-8 py-4 font-semibold">{p.name}</td>
                  <td className="px-4 sm:px-8 py-4"><span className="px-2 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-xs font-bold">{p.size}</span></td>
                  <td className="px-4 sm:px-8 py-4 text-sm hidden sm:table-cell">{p.finish}</td>
                  <td className="px-4 sm:px-8 py-4 font-bold text-pos-secondary">{formatCurrency(p.pricePerBox)}</td>
                  <td className="px-4 sm:px-8 py-4 text-sm hidden md:table-cell">{p.sqftPerBox}</td>
                  <td className="px-4 sm:px-8 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${p.stock <= 0 ? 'bg-pos-error text-white' : p.stock <= 20 ? 'bg-pos-error-container text-pos-on-error-container' : 'bg-pos-tertiary-container text-pos-on-tertiary-container'}`}>
                      {p.stock} {t('boxes')} {p.stock <= 20 && '⚠'}
                    </span>
                  </td>
                  <td className="px-4 sm:px-8 py-4 text-xs text-pos-on-surface-variant font-mono hidden lg:table-cell">{p.batch}</td>
                  <td className="px-4 sm:px-8 py-4 text-right space-x-2">
                    <button onClick={() => openEdit(p)} className="text-pos-secondary text-xs font-semibold hover:underline">{t('edit')}</button>
                    {onDeleteProduct && <button onClick={() => setShowDeleteConfirm(p.id)} className="text-pos-error text-xs font-semibold hover:underline">{t('delete')}</button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-8 py-8 text-center text-xs text-pos-on-surface-variant">{t('noProducts')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => { setShowAddModal(false); setEditId(null); }}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[480px] shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">{editId ? t('editProduct') : t('addNewProduct')}</h3>
              <button onClick={() => { setShowAddModal(false); setEditId(null); }} className="text-pos-on-surface-variant hover:text-pos-on-surface"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('productNameReq')}</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="e.g. Royal Marble" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('size')}</label><input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="24×24" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('finish')}</label><select value={form.finish} onChange={e => setForm(f => ({ ...f, finish: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"><option>Glossy</option><option>Matte</option><option>Lappato</option><option>Rustic</option><option>Carving</option></select></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('priceBoxReq')}</label><input value={form.pricePerBox} onChange={e => setForm(f => ({ ...f, pricePerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="1200" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('sqftPerBox')}</label><input value={form.sqftPerBox} onChange={e => setForm(f => ({ ...f, sqftPerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="9.2" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('stock')} ({t('boxes')})</label><input value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="100" /></div>
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
