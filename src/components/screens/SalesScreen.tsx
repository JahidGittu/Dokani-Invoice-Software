import { useState, useCallback, useRef } from "react";
import { formatCurrency, getNextInvoiceNumber, downloadCSV, type CartItem, type Product, type SaleRecord, type Customer } from "@/lib/store";
import { toast } from "sonner";
import InvoiceModal from "@/components/InvoiceModal";

interface SalesScreenProps {
  products: Product[];
  customers: Customer[];
  sales: SaleRecord[];
  onSaleComplete: (sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => void;
  onDeleteSale: (id: string) => void;
  companyName: string;
  companyPhone?: string;
  companyAddress?: string;
  onNavigate: (screen: string) => void;
}

export default function SalesScreen({ products, customers, sales, onSaleComplete, onDeleteSale, companyName, companyPhone, companyAddress, onNavigate }: SalesScreenProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [viewSale, setViewSale] = useState<SaleRecord | null>(null);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.size.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const customerSuggestions = customerName.length >= 1
    ? customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5)
    : [];

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) { toast.error(`${product.name} out of stock!`); return; }
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) { toast.error(`Only ${product.stock} boxes available!`); return prev; }
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1 }];
    });
    toast.success(`${product.name} added!`);
  }, []);

  const changeQty = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].qty + delta;
      if (newQty <= 0) { updated.splice(index, 1); return updated; }
      if (newQty > updated[index].product.stock) { toast.error(`Only ${updated[index].product.stock} boxes in stock!`); return prev; }
      updated[index] = { ...updated[index], qty: newQty };
      return updated;
    });
  };

  const subtotal = cart.reduce((sum, c) => sum + c.product.pricePerBox * c.qty, 0);
  const discountValue = discountType === 'percent' ? Math.round(subtotal * (parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);

  const handleCheckout = () => {
    if (!cart.length) { toast.error('Cart is empty!'); return; }
    const inv = getNextInvoiceNumber();
    const now = new Date();
    const sale: SaleRecord = {
      id: crypto.randomUUID(),
      invoice: inv,
      customer: customerName || 'Walk-in Customer',
      phone: customerPhone,
      items: cart.map(c => ({ productId: c.product.id, name: c.product.name, detail: `${c.product.size} · ${c.product.finish}`, qty: c.qty, price: c.product.pricePerBox })),
      subtotal, discount: discountValue, discountType, total,
      paymentMethod: 'cash', notes: '', status: 'paid',
      date: now.toISOString(),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
    onSaleComplete(sale, cart.map(c => ({ productId: c.product.id, qty: c.qty })));
    setViewSale(sale);
    setShowInvoice(true);
    setCart([]); setCustomerName(''); setCustomerPhone(''); setDiscount('');
    toast.success(`Sale ${inv} completed!`);
  };

  const reopenInvoice = (s: SaleRecord) => { setViewSale(s); setShowInvoice(true); };

  const handleDeleteSale = (id: string) => {
    if (confirm('Delete this sale record?')) { onDeleteSale(id); toast.success('Sale deleted.'); }
  };

  const exportSalesCSV = () => {
    const rows = [['Invoice','Customer','Phone','Items','Subtotal','Discount','Total','Payment','Status','Date'],
      ...sales.map(s => [s.invoice, s.customer, s.phone||'', String(s.items.length), String(s.subtotal), String(s.discount), String(s.total), s.paymentMethod, s.status, s.date])
    ];
    downloadCSV(rows, 'sales_export.csv');
    toast.success('CSV exported!');
  };

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Point of Sale</span>
          <h2 className="text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">Sales / POS</h2>
        </div>
        <button onClick={() => onNavigate('new-sale')} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">receipt_long</span>New Sale Entry
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Product Grid */}
        <div className="col-span-7 space-y-4">
          <div className="relative">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-3 pl-10 focus:ring-2 focus:ring-pos-secondary outline-none"
              placeholder="Search by name, size, finish..." />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-pos-on-surface-variant">search</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.length > 0 ? filteredProducts.map(p => (
              <div key={p.id} onClick={() => addToCart(p)}
                className="bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="text-sm font-bold mb-1">{p.name}</div>
                <div className="text-xs text-pos-on-surface-variant mb-3">{p.size} · {p.finish}</div>
                <div className="flex justify-between items-end">
                  <div className="text-lg font-black text-pos-secondary">{formatCurrency(p.pricePerBox)}</div>
                  <div className="text-[10px] text-pos-on-surface-variant">{p.stock} boxes</div>
                </div>
              </div>
            )) : (
              <div className="text-xs text-pos-on-surface-variant col-span-2 py-4">No products. <button onClick={() => onNavigate('products')} className="text-pos-secondary underline">Add products first.</button></div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="col-span-5">
          <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container sticky top-24">
            <div className="px-5 py-4 border-b border-pos-surface-container flex justify-between items-center">
              <h3 className="font-semibold">Current Cart</h3>
              <button onClick={() => setCart([])} className="text-xs text-pos-error hover:underline">Clear</button>
            </div>
            {/* Customer in POS */}
            <div className="px-5 pt-4 relative">
              <input value={customerName} onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-8 focus:ring-2 focus:ring-pos-secondary outline-none"
                placeholder="Customer name (optional)" />
              <span className="material-symbols-outlined absolute left-7 top-1/2 mt-2 -translate-y-1/2 text-pos-on-surface-variant text-base">person</span>
              {showSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute left-5 right-5 bg-pos-surface-lowest border border-pos-surface-container rounded-lg shadow-xl z-10 mt-1 max-h-[160px] overflow-y-auto">
                  {customerSuggestions.map(c => (
                    <button key={c.id} onMouseDown={() => { setCustomerName(c.name); setCustomerPhone(c.phone); setShowSuggestions(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-pos-surface-high transition-colors">{c.name} <span className="text-pos-on-surface-variant">{c.phone}</span></button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 min-h-[180px]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-pos-on-surface-variant">
                  <span className="material-symbols-outlined text-3xl mb-2">shopping_cart</span>
                  <span className="text-xs">Click a product to add</span>
                </div>
              ) : cart.map((c, i) => (
                <div key={c.product.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-pos-surface-low transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{c.product.name}</div>
                    <div className="text-[10px] text-pos-on-surface-variant">{c.product.size} · {formatCurrency(c.product.pricePerBox)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(i, -1)} className="w-6 h-6 rounded bg-pos-surface-container text-sm font-bold hover:bg-pos-surface-high flex items-center justify-center">−</button>
                    <span className="text-xs font-bold w-5 text-center">{c.qty}</span>
                    <button onClick={() => changeQty(i, 1)} className="w-6 h-6 rounded bg-pos-surface-container text-sm font-bold hover:bg-pos-surface-high flex items-center justify-center">+</button>
                  </div>
                  <div className="text-xs font-bold text-pos-secondary w-16 text-right">{formatCurrency(c.product.pricePerBox * c.qty)}</div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4 space-y-3 border-t border-pos-surface-container pt-4">
              <div className="flex justify-between text-xs text-pos-on-surface-variant">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-pos-on-surface-variant">
                <span>Discount</span>
                <div className="flex gap-1 items-center">
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                    className="w-16 bg-pos-surface-high border-none rounded text-xs py-1 px-2 outline-none text-right" />
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percent')}
                    className="bg-pos-surface-high border-none rounded text-xs py-1 px-1 outline-none">
                    <option value="flat">৳</option><option value="percent">%</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between font-black text-base">
                <span>Total</span><span className="text-pos-secondary">{formatCurrency(total)}</span>
              </div>
              <button onClick={handleCheckout}
                className="w-full py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={!cart.length}>
                <span className="material-symbols-outlined text-base">receipt</span>Checkout & Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sales History */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        <div className="px-8 py-5 flex justify-between items-center bg-pos-surface-low">
          <h3 className="text-base font-semibold">Sales History</h3>
          <button onClick={exportSalesCSV} className="text-sm font-medium text-pos-secondary flex items-center gap-1 hover:underline">
            <span className="material-symbols-outlined text-base">download</span>Export
          </button>
        </div>
        <table className="w-full text-left">
          <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
            <th className="px-6 py-3">Invoice</th><th className="px-6 py-3">Customer</th><th className="px-6 py-3">Items</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3">Payment</th><th className="px-6 py-3">Date</th><th className="px-6 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-pos-surface-container">
            {sales.length > 0 ? sales.map(s => (
              <tr key={s.id} className="hover:bg-pos-surface-low transition-colors">
                <td className="px-6 py-4 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                <td className="px-6 py-4 text-sm">{s.customer}</td>
                <td className="px-6 py-4 text-xs">{s.items.length} item(s)</td>
                <td className="px-6 py-4 font-bold">{formatCurrency(s.total)}</td>
                <td className="px-6 py-4 text-xs capitalize">{s.paymentMethod}</td>
                <td className="px-6 py-4 text-xs text-pos-on-surface-variant">{(() => { try { return new Date(s.date).toLocaleDateString('en-GB'); } catch { return s.date; } })()}</td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button onClick={() => reopenInvoice(s)} className="text-pos-secondary text-xs hover:underline">View</button>
                  <button onClick={() => handleDeleteSale(s.id)} className="text-pos-error text-xs hover:underline">Delete</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-8 py-8 text-center text-xs text-pos-on-surface-variant">No sales recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showInvoice && viewSale && (
        <InvoiceModal sale={viewSale} companyName={companyName} companyPhone={companyPhone} companyAddress={companyAddress} onClose={() => setShowInvoice(false)} />
      )}
    </section>
  );
}
