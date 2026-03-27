import { useState, useCallback, useRef } from "react";
import { products, formatCurrency, getNextInvoiceNumber, type CartItem, type Product } from "@/lib/data";
import { toast } from "sonner";
import InvoiceModal from "@/components/InvoiceModal";

export default function SalesScreen() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1 }];
    });
    toast(`${product.name} added to cart!`);
  }, []);

  const changeQty = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], qty: updated[index].qty + delta };
      if (updated[index].qty <= 0) updated.splice(index, 1);
      return updated;
    });
  };

  const total = cart.reduce((sum, c) => sum + c.product.pricePerBox * c.qty, 0);

  const handleCheckout = () => {
    if (!cart.length) { toast('Cart is empty! Add products first.'); return; }
    const inv = getNextInvoiceNumber();
    setInvoiceNumber(inv);
    setShowInvoice(true);
  };

  const handleInvoiceClose = () => {
    setShowInvoice(false);
    setCart([]);
    setCustomerName('');
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2.5 pl-9 focus:ring-2 focus:ring-pos-secondary outline-none"
              placeholder="Search product..."
            />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-1">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => addToCart(p)}
              className="bg-pos-surface-lowest rounded-xl p-4 border border-pos-surface-container cursor-pointer transition-all duration-200 hover:border-pos-secondary hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="w-full h-20 bg-pos-surface-container rounded-lg mb-3 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-pos-on-surface-variant">grid_view</span>
              </div>
              <div className="font-semibold text-sm">{p.name}</div>
              <div className="text-xs text-pos-on-surface-variant mt-0.5">{p.size} · {p.finish}</div>
              <div className="font-black text-pos-secondary mt-2">{formatCurrency(p.pricePerBox)}</div>
              <div className={`text-[10px] font-bold mt-1 ${p.stock <= 20 ? 'text-pos-error' : 'text-pos-tertiary'}`}>
                {p.stock <= 20 ? `⚠ ${p.stock} boxes` : `✓ ${p.stock} boxes`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 bg-pos-surface-lowest border-l border-pos-surface-container flex flex-col">
        <div className="p-5 border-b border-pos-surface-container">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-base">Current Sale</h3>
            <span className="text-xs text-pos-on-surface-variant">{cart.length} items</span>
          </div>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"
            placeholder="Customer name (optional)"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-pos-on-surface-variant">
              <span className="material-symbols-outlined text-3xl mb-2">shopping_cart</span>
              <span className="text-xs">Click a product to add</span>
            </div>
          ) : (
            cart.map((c, i) => (
              <div key={c.product.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-pos-surface-low transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{c.product.name}</div>
                  <div className="text-[10px] text-pos-on-surface-variant">{c.product.size} {c.product.finish} · {formatCurrency(c.product.pricePerBox)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(i, -1)} className="w-6 h-6 rounded bg-pos-surface-container text-sm font-bold hover:bg-pos-surface-high flex items-center justify-center">−</button>
                  <span className="text-xs font-bold w-5 text-center">{c.qty}</span>
                  <button onClick={() => changeQty(i, 1)} className="w-6 h-6 rounded bg-pos-surface-container text-sm font-bold hover:bg-pos-surface-high flex items-center justify-center">+</button>
                </div>
                <div className="text-xs font-bold text-pos-secondary w-16 text-right">{formatCurrency(c.product.pricePerBox * c.qty)}</div>
              </div>
            ))
          )}
        </div>

        <div className="p-5 border-t border-pos-surface-container space-y-3">
          <div className="flex justify-between text-xs text-pos-on-surface-variant">
            <span>Subtotal</span><span className="font-bold">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between font-black text-lg">
            <span>Total</span><span className="text-pos-secondary">{formatCurrency(total)}</span>
          </div>
          <button
            onClick={handleCheckout}
            className="w-full py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform"
          >
            <span className="material-symbols-outlined text-lg">receipt_long</span>
            Checkout — {formatCurrency(total)}
          </button>
        </div>
      </div>

      {showInvoice && (
        <InvoiceModal
          invoiceNumber={invoiceNumber}
          customerName={customerName || 'Walk-in Customer'}
          cart={cart}
          total={total}
          onClose={handleInvoiceClose}
        />
      )}
    </div>
  );
}
