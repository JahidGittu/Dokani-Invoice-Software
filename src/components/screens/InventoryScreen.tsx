export default function InventoryScreen() {
  const logs = [
    { date: '27 Mar 2026', product: 'Royal Marble', type: 'IN', qty: '+50 boxes', total: 345, note: 'New shipment', isIn: true },
    { date: '27 Mar 2026', product: 'Dark Slate', type: 'OUT', qty: '−12 boxes', total: 210, note: 'INV-0089', isIn: false },
    { date: '26 Mar 2026', product: 'Travertine', type: 'IN', qty: '+100 boxes', total: 438, note: 'Supplier: ABC Tiles', isIn: true },
    { date: '26 Mar 2026', product: 'Pearl White', type: 'OUT', qty: '−20 boxes', total: 8, note: 'INV-0087', isIn: false },
    { date: '25 Mar 2026', product: 'Ivory Stone', type: 'OUT', qty: '−8 boxes', total: 12, note: 'INV-0084', isIn: false },
  ];

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Warehouse</span>
          <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Inventory Log</h2>
        </div>
      </div>
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-8 py-5 flex justify-between items-center bg-pos-surface-low">
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
