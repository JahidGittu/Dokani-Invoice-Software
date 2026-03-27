import { useState, useCallback, useEffect, useRef } from "react";
import { formatCurrency, getNextInvoiceNumber, type CartItem, type Product, type SaleRecord } from "@/lib/store";
import { toast } from "sonner";
import InvoiceModal from "@/components/InvoiceModal";

interface SalesScreenProps {
  products: Product[];
  customers: { id: string; name: string; phone: string }[];
  onSaleComplete: (sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => void;
  companyName: string;
}

export default function SalesScreen({ products, customers, onSaleComplete, companyName }: SalesScreenProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'mobile'>('cash');
  const [notes, setNotes] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.size.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Customer autocomplete
  const customerSuggestions = customerName.length >= 1
    ? customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5)
    : [];

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} out of stock!`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          toast.error(`Only ${product.stock} boxes available!`);
          return prev;
        }
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
      if (newQty > updated[index].product.stock) {
        toast.error(`Only ${updated[index].product.stock} boxes in stock!`);
        return prev;
      }
      updated[index] = { ...updated[index], qty: newQty };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.product.pricePerBox * c.qty, 0);
  const discountValue = discountType === 'percent'
    ? Math.round(subtotal * (parseFloat(discount) || 0) / 100)
    : (parseFloat(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);

  const handleCheckout = () => {
    if (!cart.length) { toast.error('Cart is empty! Add products first.'); return; }

    const inv = getNextInvoiceNumber();
    const now = new Date();
    const sale: SaleRecord = {
      id: crypto.randomUUID(),
      invoice: inv,
      customer: customerName || 'Walk-in Customer',
      phone: customerPhone,
      items: cart.map(c => ({
        productId: c.product.id,
        name: c.product.name,
        detail: `${c.product.size} ${c.product.finish}`,
        qty: c.qty,
        price: c.product.pricePerBox,
      })),
      subtotal,
      discount: discountValue,
      discountType,
      total,
      paymentMethod,
      notes,
      status: 'paid',
      date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };

    const stockDeductions = cart.map(c => ({ productId: c.product.id, qty: c.qty }));
    onSaleComplete(sale, stockDeductions);
    setLastSale(sale);
    setShowInvoice(true);
    toast.success(`Sale ${inv} completed!`);
  };

  const handleInvoiceClose = () => {
    setShowInvoice(false);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount('');
    setNotes('');
    setLastSale(null);
  };

  // Keyboard shortcut: F2 to focus search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        customerInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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
              placeholder="Search product name or size..."
            />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">search</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-1 flex-1">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => addToCart(p)}
              className={`bg-pos-surface-lowest rounded-xl p-4 border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                p.stock <= 0 ? 'border-pos-error/30 opacity-60' : 'border-pos-surface-container hover:border-pos-secondary'
              }`}
            >
              <div className="w-full h-20 bg-pos-surface-container rounded-lg mb-3 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-pos-on-surface-variant">grid_view</span>
              </div>
              <div className="font-semibold text-sm">{p.name}</div>
              <div className="text-xs text-pos-on-surface-variant mt-0.5">{p.size} · {p.finish}</div>
              <div className="font-black text-pos-secondary mt-2">{formatCurrency(p.pricePerBox)}</div>
              <div className={`text-[10px] font-bold mt-1 ${p.stock <= 0 ? 'text-pos-error' : p.stock <= 20 ? 'text-pos-error' : 'text-pos-tertiary'}`}>
                {p.stock <= 0 ? '✕ Out of Stock' : p.stock <= 20 ? `⚠ ${p.stock} boxes` : `✓ ${p.stock} boxes`}
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-20 text-pos-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
              <span className="text-sm">No products found</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart + Form */}
      <div className="w-[340px] bg-pos-surface-lowest border-l border-pos-surface-container flex flex-col">
        <div className="p-4 border-b border-pos-surface-container space-y-2.5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-base">New Sale</h3>
            <span className="text-[10px] text-pos-on-surface-variant bg-pos-surface-container px-2 py-0.5 rounded font-bold">F2 = Focus</span>
          </div>

          {/* Customer autocomplete */}
          <div className="relative">
            <input
              ref={customerInputRef}
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"
              placeholder="Customer name *"
            />
            {showSuggestions && customerSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-pos-surface-lowest border border-pos-surface-container rounded-lg shadow-xl z-10 mt-1 overflow-hidden">
                {customerSuggestions.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-pos-surface-high transition-colors flex justify-between"
                    onMouseDown={() => {
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone);
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-pos-on-surface-variant">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"
            placeholder="Phone number (optional)"
          />

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                type="number"
                className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"
                placeholder="Discount"
              />
            </div>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percent')}
              className="bg-pos-surface-high border-none rounded-lg text-xs py-2 px-2 focus:ring-2 focus:ring-pos-secondary outline-none w-16"
            >
              <option value="flat">৳</option>
              <option value="percent">%</option>
            </select>
          </div>

          <div className="flex gap-1">
            {(['cash', 'credit', 'mobile'] as const).map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors capitalize ${
                  paymentMethod === m
                    ? 'bg-pos-secondary text-white'
                    : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'
                }`}
              >
                {m === 'cash' ? '💵 Cash' : m === 'credit' ? '💳 Credit' : '📱 Mobile'}
              </button>
            ))}
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"
            placeholder="Notes (optional)"
          />
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-pos-on-surface-variant">
              <span className="material-symbols-outlined text-3xl mb-2">shopping_cart</span>
              <span className="text-xs">Click a product to add</span>
            </div>
          ) : (
            cart.map((c, i) => (
              <div key={c.product.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-pos-surface-low transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{c.product.name}</div>
                  <div className="text-[10px] text-pos-on-surface-variant">{c.product.size} · {formatCurrency(c.product.pricePerBox)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(i, -1)} className="w-6 h-6 rounded bg-pos-surface-container text-sm font-bold hover:bg-pos-surface-high flex items-center justify-center">−</button>
                  <span className="text-xs font-bold w-5 text-center">{c.qty}</span>
                  <button onClick={() => changeQty(i, 1)} className="w-6 h-6 rounded bg-pos-surface-container text-sm font-bold hover:bg-pos-surface-high flex items-center justify-center">+</button>
                </div>
                <div className="text-xs font-bold text-pos-secondary w-14 text-right">{formatCurrency(c.product.pricePerBox * c.qty)}</div>
                <button onClick={() => removeFromCart(i)} className="opacity-0 group-hover:opacity-100 text-pos-error transition-opacity">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="p-4 border-t border-pos-surface-container space-y-2">
          <div className="flex justify-between text-xs text-pos-on-surface-variant">
            <span>Subtotal ({cart.reduce((s, c) => s + c.qty, 0)} items)</span>
            <span className="font-bold">{formatCurrency(subtotal)}</span>
          </div>
          {discountValue > 0 && (
            <div className="flex justify-between text-xs text-pos-error">
              <span>Discount</span>
              <span className="font-bold">-{formatCurrency(discountValue)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-lg pt-1 border-t border-pos-surface-container">
            <span>Total</span>
            <span className="text-pos-secondary">{formatCurrency(total)}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span className="material-symbols-outlined text-lg">receipt_long</span>
            Checkout — {formatCurrency(total)}
          </button>
        </div>
      </div>

      {showInvoice && lastSale && (
        <InvoiceModal
          sale={lastSale}
          companyName={companyName}
          onClose={handleInvoiceClose}
        />
      )}
    </div>
  );
}
