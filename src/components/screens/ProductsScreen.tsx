import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { type Product, formatCurrency } from "@/lib/store";
import { toast } from "sonner";

interface ProductsScreenProps {
  products: Product[];
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
}

export default function ProductsScreen({ products, onAddProduct, onUpdateProduct, onDeleteProduct }: ProductsScreenProps) {
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
    if (!form.name || !form.pricePerBox) { toast.error('Name and price required!'); return; }
    if (editId) {
      onUpdateProduct(editId, {
        name: form.name, size: form.size, finish: form.finish,
        pricePerBox: parseFloat(form.pricePerBox), sqftPerBox: parseFloat(form.sqftPerBox),
        stock: parseInt(form.stock), batch: form.batch,
      });
      toast.success('Product updated!');
    } else {
      onAddProduct({
        name: form.name, size: form.size, finish: form.finish,
        pricePerBox: parseFloat(form.pricePerBox), sqftPerBox: parseFloat(form.sqftPerBox) || 0,
        stock: parseInt(form.stock) || 0, batch: form.batch,
      });
      toast.success('Product added!');
    }
    setShowAddModal(false);
    setEditId(null);
    resetForm();
  };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name, size: p.size, finish: p.finish,
      pricePerBox: String(p.pricePerBox), sqftPerBox: String(p.sqftPerBox),
      stock: String(p.stock), batch: p.batch,
    });
    setEditId(p.id);
    setShowAddModal(true);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm && onDeleteProduct) {
      onDeleteProduct(showDeleteConfirm);
      toast.success('Product deleted!');
    }
    setShowDeleteConfirm(null);
  };

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Stock Management</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Products</h2>
        </div>
        <button onClick={() => { resetForm(); setEditId(null); setShowAddModal(true); }} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span>Add Product
        </button>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-4 sm:px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-pos-surface-low">
          <h3 className="text-base font-semibold">All Products <span className="text-pos-on-surface-variant font-normal">({products.length})</span></h3>
          <div className="relative w-full sm:w-auto">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-52 bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="Search products..." />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
                <th className="px-4 sm:px-8 py-3">Product Name</th><th className="px-4 sm:px-8 py-3">Size</th><th className="px-4 sm:px-8 py-3 hidden sm:table-cell">Finish</th><th className="px-4 sm:px-8 py-3">Price/Box</th><th className="px-4 sm:px-8 py-3 hidden md:table-cell">Sqft/Box</th><th className="px-4 sm:px-8 py-3">Stock</th><th className="px-4 sm:px-8 py-3 hidden lg:table-cell">Batch</th><th className="px-4 sm:px-8 py-3 text-right">Action</th>
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
                      {p.stock} boxes {p.stock <= 20 && '⚠'}
                    </span>
                  </td>
                  <td className="px-4 sm:px-8 py-4 text-xs text-pos-on-surface-variant font-mono hidden lg:table-cell">{p.batch}</td>
                  <td className="px-4 sm:px-8 py-4 text-right space-x-2">
                    <button onClick={() => openEdit(p)} className="text-pos-secondary text-xs font-semibold hover:underline">Edit</button>
                    {onDeleteProduct && <button onClick={() => setShowDeleteConfirm(p.id)} className="text-pos-error text-xs font-semibold hover:underline">Delete</button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-8 py-8 text-center text-xs text-pos-on-surface-variant">No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => { setShowAddModal(false); setEditId(null); }}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[480px] shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">{editId ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditId(null); }} className="text-pos-on-surface-variant hover:text-pos-on-surface"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Product Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="e.g. Royal Marble" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Size</label><input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="24×24" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Finish</label><select value={form.finish} onChange={e => setForm(f => ({ ...f, finish: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"><option>Glossy</option><option>Matte</option><option>Lappato</option><option>Rustic</option><option>Carving</option></select></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Price / Box (৳) *</label><input value={form.pricePerBox} onChange={e => setForm(f => ({ ...f, pricePerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="1200" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Sqft / Box</label><input value={form.sqftPerBox} onChange={e => setForm(f => ({ ...f, sqftPerBox: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="9.2" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Stock (Boxes)</label><input value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="100" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Batch No.</label><input value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="BT-2501" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAddModal(false); setEditId(null); }} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm">{editId ? 'Update' : 'Save'} Product</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-pos-on-error-container">delete</span>
              </div>
              <h3 className="text-lg font-bold">Delete Product?</h3>
            </div>
            <p className="text-sm text-pos-on-surface-variant mb-6">This action cannot be undone. The product will be permanently removed.</p>
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
