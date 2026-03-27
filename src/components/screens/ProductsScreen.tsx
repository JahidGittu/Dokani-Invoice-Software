import { useState } from "react";
import { products, formatCurrency } from "@/lib/data";
import { toast } from "sonner";

export default function ProductsScreen() {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Stock Management</span>
          <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Products</h2>
        </div>
        <button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span>Add Product
        </button>
      </div>

      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-8 py-5 flex justify-between items-center bg-pos-surface-low">
          <h3 className="text-base font-semibold">All Products <span className="text-pos-on-surface-variant font-normal">({products.length})</span></h3>
          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-9 pr-4 focus:ring-2 focus:ring-pos-secondary outline-none w-52" placeholder="Search products..." />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
              <th className="px-8 py-3">Product Name</th><th className="px-8 py-3">Size</th><th className="px-8 py-3">Finish</th><th className="px-8 py-3">Price/Box</th><th className="px-8 py-3">Sqft/Box</th><th className="px-8 py-3">Stock</th><th className="px-8 py-3">Batch</th><th className="px-8 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pos-surface-container">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                <td className="px-8 py-4 font-semibold">{p.name}</td>
                <td className="px-8 py-4"><span className="px-2 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-xs font-bold">{p.size}</span></td>
                <td className="px-8 py-4 text-sm">{p.finish}</td>
                <td className="px-8 py-4 font-bold text-pos-secondary">{formatCurrency(p.pricePerBox)}</td>
                <td className="px-8 py-4 text-sm">{p.sqftPerBox}</td>
                <td className="px-8 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${p.stock <= 20 ? 'bg-pos-error-container text-pos-on-error-container' : 'bg-pos-tertiary-container text-pos-on-tertiary-container'}`}>
                    {p.stock} boxes {p.stock <= 20 && '⚠'}
                  </span>
                </td>
                <td className="px-8 py-4 text-xs text-pos-on-surface-variant font-mono">{p.batch}</td>
                <td className="px-8 py-4 text-right">
                  <button onClick={() => toast(`Edit mode: ${p.name}`)} className="text-pos-secondary text-xs font-semibold hover:underline">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowAddModal(false)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[480px] shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Add New Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-pos-on-surface-variant hover:text-pos-on-surface"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Product Name</label><input className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="e.g. Royal Marble" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Size</label><input className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="24×24" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Finish</label><select className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"><option>Glossy</option><option>Matte</option><option>Lappato</option></select></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Price / Box (৳)</label><input type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="1200" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Sqft / Box</label><input type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="9.2" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Stock (Boxes)</label><input type="number" className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="100" /></div>
              <div><label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Batch No.</label><input className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="BT-2501" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={() => { toast('Product saved successfully!'); setShowAddModal(false); }} className="flex-1 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm">Save Product</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
