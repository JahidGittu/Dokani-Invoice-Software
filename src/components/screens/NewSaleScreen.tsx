import { useState, useCallback, useRef, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency, getNextInvoiceNumber, calcDiscount, type Product, type SaleRecord, type Customer, type CompanySettings } from "@/lib/store";
import { toast } from "sonner";
import InvoiceModal from "@/components/InvoiceModal";

interface NewSaleRow {
  id: number;
  productId: string;
  qty: number;
  rate: number;
}

interface NewSaleScreenProps {
  products: Product[];
  customers: Customer[];
  settings: CompanySettings;
  onSaleComplete: (sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => void;
  onAutoAddCustomer: (name: string, phone: string, address: string) => void;
}

export default function NewSaleScreen({ products, customers, settings, onSaleComplete, onAutoAddCustomer }: NewSaleScreenProps) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState('cash');
  const [status, setStatus] = useState('paid');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [received, setReceived] = useState('');
  const [rows, setRows] = useState<NewSaleRow[]>([{ id: Date.now(), productId: '', qty: 1, rate: 0 }]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  const debouncedCustomer = useDebounce(customerName, 200);

  // Customer autocomplete
  const suggestions = useMemo(() =>
    debouncedCustomer.length >= 1
      ? customers.filter(c => c.name.toLowerCase().includes(debouncedCustomer.toLowerCase())).slice(0, 5)
      : [],
    [debouncedCustomer, customers]
  );

  const selectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setShowSuggestions(false);
  };

  // Row management
  const addRow = () => setRows(prev => [...prev, { id: Date.now(), productId: '', qty: 1, rate: 0 }]);

  const removeRow = (id: number) => {
    setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: keyof NewSaleRow, value: string | number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const selectProduct = (rowId: number, productId: string) => {
    const p = products.find(x => x.id === productId);
    if (p) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, productId, rate: p.pricePerBox, qty: r.qty || 1 } : r));
    }
  };

  // Barcode handler
  const handleBarcode = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return;
    const q = barcodeInput.trim().toLowerCase();
    const found = products.find(p => p.batch.toLowerCase() === q || p.name.toLowerCase() === q || p.id === q);
    if (found) {
      const existingRow = rows.find(r => r.productId === found.id);
      if (existingRow) {
        updateRow(existingRow.id, 'qty', existingRow.qty + 1);
      } else {
        const emptyRow = rows.find(r => !r.productId);
        if (emptyRow) {
          setRows(prev => prev.map(r => r.id === emptyRow.id ? { ...r, productId: found.id, rate: found.pricePerBox, qty: 1 } : r));
        } else {
          setRows(prev => [...prev, { id: Date.now(), productId: found.id, qty: 1, rate: found.pricePerBox }]);
        }
      }
      toast.success(`${found.name} added!`);
    } else {
      toast.error('Product not found!');
    }
    setBarcodeInput('');
  };

  // Calculations
  const subtotal = rows.reduce((sum, r) => sum + (r.qty * r.rate), 0);
  const discountVal = calcDiscount(subtotal, parseFloat(discount) || 0, discountType);
  const total = Math.max(0, subtotal - discountVal);
  const receivedNum = parseFloat(received) || 0;
  const change = receivedNum > 0 && receivedNum >= total ? receivedNum - total : 0;

  const collectSaleData = (): { sale: SaleRecord; deductions: { productId: string; qty: number }[] } | null => {
    const items = rows.filter(r => r.productId && r.qty > 0 && r.rate > 0).map(r => {
      const p = products.find(x => x.id === r.productId);
      return {
        productId: r.productId,
        name: p?.name || 'Custom Item',
        detail: p ? `${p.size} · ${p.finish}` : '',
        qty: r.qty,
        price: r.rate,
      };
    });
    if (!items.length) { toast.error('Add at least one item!'); return null; }

    const inv = getNextInvoiceNumber(settings.invPrefix);
    const now = new Date();
    const sale: SaleRecord = {
      id: crypto.randomUUID(),
      invoice: inv,
      customer: customerName || 'Walk-in Customer',
      phone,
      address,
      items,
      subtotal,
      discount: discountVal,
      discountType,
      total,
      paymentMethod: payment,
      notes,
      status: status as SaleRecord['status'],
      date: now.toISOString(),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
    const deductions = items.filter(i => i.productId).map(i => ({ productId: i.productId, qty: i.qty }));
    return { sale, deductions };
  };

  const commitSale = (sale: SaleRecord, deductions: { productId: string; qty: number }[]) => {
    onSaleComplete(sale, deductions);
    if (sale.customer !== 'Walk-in Customer' && !customers.find(c => c.name === sale.customer)) {
      onAutoAddCustomer(sale.customer, sale.phone, sale.address || '');
    }
  };

  const resetForm = () => {
    setCustomerName(''); setPhone(''); setAddress(''); setNotes('');
    setDiscount(''); setReceived(''); setPayment('cash'); setStatus('paid');
    setRows([{ id: Date.now(), productId: '', qty: 1, rate: 0 }]);
  };

  const handleSave = () => {
    const data = collectSaleData();
    if (!data) return;
    commitSale(data.sale, data.deductions);
    setLastSale(data.sale);
    setShowInvoice(true);
    resetForm();
  };

  const handleSaveAndPrint = () => {
    const data = collectSaleData();
    if (!data) return;
    commitSale(data.sale, data.deductions);
    setLastSale(data.sale);
    setShowInvoice(true);
    resetForm();
  };

  const handleSaveAndPDF = () => {
    const data = collectSaleData();
    if (!data) return;
    commitSale(data.sale, data.deductions);
    setLastSale(data.sale);
    setShowInvoice(true);
    resetForm();
  };

  return (
    <section className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">Create Transaction</span>
        <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">New Sale Entry</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Customer + Items */}
        <div className="space-y-5">
          {/* Customer Info */}
          <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">Customer Information</h3>
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Customer Name *</label>
                <input
                  value={customerName}
                  onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"
                  placeholder="e.g. Rahim Uddin"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-pos-surface-lowest border border-pos-surface-container rounded-lg shadow-xl z-10 mt-1 max-h-[180px] overflow-y-auto">
                    {suggestions.map(c => (
                      <button key={c.id} onMouseDown={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-pos-surface-high transition-colors flex justify-between">
                        <span>{c.name}</span><span className="text-pos-on-surface-variant">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Phone (optional)</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Address (optional)</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="Dhaka, Bangladesh" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Payment Method</label>
                  <select value={payment} onChange={e => setPayment(e.target.value)}
                    className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none">
                    <option value="cash">Cash</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit / Due</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none">
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none resize-none"
                  placeholder="Special instructions, delivery notes..." />
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">Pricing Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-pos-on-surface-variant">Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-pos-on-surface-variant">Discount</span>
                <div className="flex gap-2 items-center">
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                    className="w-20 bg-pos-surface-high border-none rounded-lg text-sm py-1.5 px-2 outline-none text-right focus:ring-2 focus:ring-pos-secondary" />
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percent')}
                    className="bg-pos-surface-high border-none rounded-lg text-sm py-1.5 px-2 outline-none focus:ring-2 focus:ring-pos-secondary">
                    <option value="flat">৳ Flat</option>
                    <option value="percent">% Percent</option>
                  </select>
                </div>
              </div>
              <div className="h-px bg-pos-surface-container" />
              <div className="flex justify-between text-lg font-black">
                <span>Grand Total</span>
                <span className="text-pos-secondary">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-pos-on-surface-variant">Amount Received</span>
                <input type="number" value={received} onChange={e => setReceived(e.target.value)} placeholder="0"
                  className="w-24 bg-pos-surface-high border-none rounded-lg text-sm py-1.5 px-2 outline-none text-right focus:ring-2 focus:ring-pos-secondary" />
              </div>
              {change > 0 && (
                <div className="flex justify-between text-sm font-bold text-pos-tertiary">
                  <span>Change</span>
                  <span>{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Items + Actions */}
        <div className="space-y-5">
          {/* Barcode / Search input */}
          <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">
              <span className="material-symbols-outlined text-sm align-middle mr-1">qr_code_scanner</span>
              Barcode / Quick Search
            </h3>
            <div className="relative">
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcode}
                className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 pl-10 pr-3 focus:ring-2 focus:ring-pos-secondary outline-none"
                placeholder="Scan barcode or type product name/batch & press Enter"
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">qr_code_scanner</span>
            </div>
            <p className="text-[10px] text-pos-on-surface-variant mt-2">
              Tip: Use a barcode scanner or type batch number (e.g. BT-2501) and press Enter
            </p>
          </div>

          {/* Items */}
          <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-6 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">Sale Items</h3>
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="bg-pos-surface-low rounded-xl p-3 space-y-2" style={{ animation: 'fadeIn .2s ease' }}>
                  <div className="flex gap-2">
                    <select
                      value={row.productId}
                      onChange={e => selectProduct(row.id, e.target.value)}
                      className="flex-1 bg-pos-surface-high border-none rounded-lg text-xs py-2 px-2 outline-none focus:ring-2 focus:ring-pos-secondary"
                    >
                      <option value="">— Select Product —</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} ({p.size}) — ৳{p.pricePerBox}/box {p.stock <= 0 ? '(Out of stock)' : `[${p.stock}]`}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => removeRow(row.id)}
                      className="w-7 h-7 rounded-lg bg-pos-error-container text-pos-on-error-container flex items-center justify-center hover:opacity-80 flex-shrink-0">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Qty (boxes)</label>
                      <input type="number" min={1} value={row.qty || ''} onChange={e => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)}
                        className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-2 outline-none focus:ring-2 focus:ring-pos-secondary" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Rate (৳)</label>
                      <input type="number" value={row.rate || ''} onChange={e => updateRow(row.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-2 outline-none focus:ring-2 focus:ring-pos-secondary" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Subtotal</label>
                      <div className="text-xs font-bold text-pos-secondary py-2 px-2">{formatCurrency(row.qty * row.rate)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addRow}
              className="mt-4 w-full py-2 border-2 border-dashed border-pos-outline-variant rounded-lg text-xs text-pos-on-surface-variant hover:border-pos-secondary hover:text-pos-secondary transition-colors flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">add</span>Add another item
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button onClick={handleSave}
              className="w-full py-3.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
              <span className="material-symbols-outlined">check_circle</span>Save Sale & Generate Invoice
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleSaveAndPrint}
                className="py-3 bg-pos-primary-container text-pos-on-primary-container rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-95 transition-all">
                <span className="material-symbols-outlined text-base">print</span>Save & Print
              </button>
              <button onClick={handleSaveAndPDF}
                className="py-3 bg-pos-tertiary-container text-pos-on-tertiary-container rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>Save & PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {showInvoice && lastSale && (
        <InvoiceModal sale={lastSale} companyName={settings.name} companyPhone={settings.phone} companyAddress={settings.address} onClose={() => setShowInvoice(false)} />
      )}
    </section>
  );
}
