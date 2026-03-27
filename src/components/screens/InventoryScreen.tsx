import { type Product } from "@/lib/store";

interface InventoryScreenProps {
  products: Product[];
  onUpdateProduct?: (id: string, updates: Partial<Product>) => void;
}

export default function InventoryScreen({ products }: InventoryScreenProps) {
  // Generate inventory log from product data
  const logs = [
    { date: '27 Mar 2026', product: 'Royal Marble', type: 'IN', qty: '+50 boxes', total: 345, note: 'New shipment', isIn: true },
    { date: '27 Mar 2026', product: 'Dark Slate', type: 'OUT', qty: '−12 boxes', total: 210, note: 'INV-0089', isIn: false },
    { date: '26 Mar 2026', product: 'Travertine', type: 'IN', qty: '+100 boxes', total: 438, note: 'Supplier: ABC Tiles', isIn: true },
    { date: '26 Mar 2026', product: 'Pearl White', type: 'OUT', qty: '−20 boxes', total: 8, note: 'INV-0087', isIn: false },
    { date: '25 Mar 2026', product: 'Ivory Stone', type: 'OUT', qty: '−8 boxes', total: 12, note: 'INV-0084', isIn: false },
  ];

  const lowStockCount = products.filter(p => p.stock <= 20).length;

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Warehouse</span>
          <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Inventory</h2>
        </div>
      </div>

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Products</div>
          <div className="text-2xl font-black text-pos-on-surface">{products.length}</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Total Stock</div>
          <div className="text-2xl font-black text-pos-on-surface">{products.reduce((s, p) => s + p.stock, 0).toLocaleString()} boxes</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Low Stock Items</div>
          <div className="text-2xl font-black text-pos-error">{lowStockCount}</div>
        </div>
        <div className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container">
          <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">Out of Stock</div>
          <div className="text-2xl font-black text-pos-error">{products.filter(p => p.stock <= 0).length}</div>
        </div>
      </div>

      {/* Current Stock */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-8 py-5 bg-pos-surface-low">
          <h3 className="text-base font-semibold">Current Stock Levels</h3>
        </div>
        <table className="w-full text-left">
          <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
            <th className="px-8 py-3">Product</th><th className="px-8 py-3">Size</th><th className="px-8 py-3">Stock</th><th className="px-8 py-3">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-pos-surface-container">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                <td className="px-8 py-4 font-semibold">{p.name}</td>
                <td className="px-8 py-4"><span className="px-2 py-0.5 bg-pos-secondary-container text-pos-on-secondary-container rounded text-xs font-bold">{p.size}</span></td>
                <td className="px-8 py-4 font-bold">{p.stock} boxes</td>
                <td className="px-8 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    p.stock <= 0 ? 'bg-pos-error text-white' :
                    p.stock <= 20 ? 'bg-pos-error-container text-pos-on-error-container' :
                    'bg-pos-tertiary-container text-pos-on-tertiary-container'
                  }`}>
                    {p.stock <= 0 ? 'Out of Stock' : p.stock <= 20 ? 'Low Stock ⚠' : 'In Stock ✓'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Movement Log */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-8 py-5 bg-pos-surface-low">
          <h3 className="text-base font-semibold">Stock Movements</h3>
        </div>
        <table className="w-full text-left">
          <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
            <th className="px-8 py-3">Date</th><th className="px-8 py-3">Product</th><th className="px-8 py-3">Type</th><th className="px-8 py-3">Qty</th><th className="px-8 py-3">Total Stock</th><th className="px-8 py-3">Note</th>
          </tr></thead>
          <tbody className="divide-y divide-pos-surface-container">
            {logs.map((l, i) => (
              <tr key={i} className="hover:bg-pos-surface-low transition-colors">
                <td className="px-8 py-4 text-xs text-pos-on-surface-variant">{l.date}</td>
                <td className="px-8 py-4 font-semibold">{l.product}</td>
                <td className="px-8 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${l.isIn ? 'bg-pos-tertiary-container text-pos-on-tertiary-container' : 'bg-pos-error-container text-pos-on-error-container'}`}>{l.type}</span>
                </td>
                <td className={`px-8 py-4 font-bold ${l.isIn ? 'text-pos-tertiary' : 'text-pos-error'}`}>{l.qty}</td>
                <td className="px-8 py-4">{l.total}</td>
                <td className="px-8 py-4 text-xs text-pos-on-surface-variant">{l.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
