import { useState, useCallback, useRef, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
  const suggestions = useMemo(() =>
    debouncedCustomer.length >= 1
      ? customers.filter(c => c.name.toLowerCase().includes(debouncedCustomer.toLowerCase())).slice(0, 5)
      : [],
    [debouncedCustomer, customers]
  );

  const selectCustomer = (c: Customer) => {
    setCustomerName(c.name); setPhone(c.phone || ''); setAddress(c.address || ''); setShowSuggestions(false);
  };

  const addRow = () => setRows(prev => [...prev, { id: Date.now(), productId: '', qty: 1, rate: 0 }]);
  const removeRow = (id: number) => setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: keyof NewSaleRow, value: string | number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const selectProduct = (rowId: number, productId: string) => {
    const p = products.find(x => x.id === productId);
    if (p) setRows(prev => prev.map(r => r.id === rowId ? { ...r, productId, rate: p.pricePerBox, qty: r.qty || 1 } : r));
  };

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

  // Live preview items
  const previewItems = useMemo(() =>
    rows.filter(r => r.productId && r.qty > 0).map(r => {
      const p = products.find(x => x.id === r.productId);
      return { name: p?.name || '—', detail: p ? `${p.size} · ${p.finish}` : '', qty: r.qty, price: r.rate };
    }),
    [rows, products]
  );

  const collectSaleData = (): { sale: SaleRecord; deductions: { productId: string; qty: number }[] } | null => {
    const items = rows.filter(r => r.productId && r.qty > 0 && r.rate > 0).map(r => {
      const p = products.find(x => x.id === r.productId);
      return { productId: r.productId, name: p?.name || 'Custom Item', detail: p ? `${p.size} · ${p.finish}` : '', qty: r.qty, price: r.rate };
    });
    if (!items.length) { toast.error('Add at least one item!'); return null; }
    const inv = getNextInvoiceNumber(settings.invPrefix);
    const now = new Date();
    const sale: SaleRecord = {
      id: crypto.randomUUID(), invoice: inv, customer: customerName || 'Walk-in Customer',
      phone, address, items, subtotal, discount: discountVal, discountType, total,
      paymentMethod: payment, notes, status: status as SaleRecord['status'],
      date: now.toISOString(), time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
    return { sale, deductions: items.filter(i => i.productId).map(i => ({ productId: i.productId, qty: i.qty })) };
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
    const data = collectSaleData(); if (!data) return;
    commitSale(data.sale, data.deductions);
    setLastSale(data.sale); setShowInvoice(true); resetForm();
  };

  const paymentLabels: Record<string, string> = { cash: t('cash'), bkash: t('bkash'), nagad: t('nagad'), card: t('card'), credit: t('creditDue') };
  const statusLabels: Record<string, string> = { paid: t('paid'), pending: t('pending'), credit: t('credit') };

  return (
    <section className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('createTransaction')}</span>
        <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('newSaleEntry')}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Customer + Pricing */}
        <div className="space-y-5">
          <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-5 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('customerInfo')}</h3>
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('customerNameReq')}</label>
                <input value={customerName}
                  onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none"
                  placeholder="e.g. Rahim Uddin" />
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
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('phone')}</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('address')}</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none" placeholder="Dhaka, Bangladesh" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('paymentMethod')}</label>
                  <select value={payment} onChange={e => setPayment(e.target.value)}
                    className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none">
                    <option value="cash">{t('cash')}</option>
                    <option value="bkash">{t('bkash')}</option>
                    <option value="nagad">{t('nagad')}</option>
                    <option value="card">{t('card')}</option>
                    <option value="credit">{t('creditDue')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('status')}</label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none">
                    <option value="paid">{t('paid')}</option>
                    <option value="pending">{t('pending')}</option>
                    <option value="credit">{t('credit')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-pos-on-surface-variant uppercase mb-1.5">{t('notes')}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 px-3 focus:ring-2 focus:ring-pos-secondary outline-none resize-none" placeholder="..." />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-5 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('pricingSummary')}</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-pos-on-surface-variant">{t('subtotal')}</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-pos-on-surface-variant">{t('discount')}</span>
                <div className="flex gap-2 items-center">
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                    className="w-16 bg-pos-surface-high border-none rounded-lg text-sm py-1.5 px-2 outline-none text-right focus:ring-2 focus:ring-pos-secondary" />
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percent')}
                    className="bg-pos-surface-high border-none rounded-lg text-xs py-1.5 px-2 outline-none focus:ring-2 focus:ring-pos-secondary">
                    <option value="flat">{t('flat')}</option><option value="percent">{t('percent')}</option>
                  </select>
                </div>
              </div>
              <div className="h-px bg-pos-surface-container" />
              <div className="flex justify-between text-lg font-black"><span>{t('grandTotal')}</span><span className="text-pos-secondary">{formatCurrency(total)}</span></div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-pos-on-surface-variant">{t('amountReceived')}</span>
                <input type="number" value={received} onChange={e => setReceived(e.target.value)} placeholder="0"
                  className="w-20 bg-pos-surface-high border-none rounded-lg text-sm py-1.5 px-2 outline-none text-right focus:ring-2 focus:ring-pos-secondary" />
              </div>
              {change > 0 && <div className="flex justify-between text-sm font-bold text-pos-tertiary"><span>{t('change')}</span><span>{formatCurrency(change)}</span></div>}
            </div>
          </div>
        </div>

        {/* Column 2: Items */}
        <div className="space-y-5">
          <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-5 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">
              <span className="material-symbols-outlined text-sm align-middle mr-1">qr_code_scanner</span>{t('barcodeSearch')}
            </h3>
            <div className="relative">
              <input ref={barcodeRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={handleBarcode}
                className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-2.5 pl-10 pr-3 focus:ring-2 focus:ring-pos-secondary outline-none"
                placeholder="Scan barcode or type name & Enter" />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-pos-on-surface-variant text-base">qr_code_scanner</span>
            </div>
          </div>

          <div className="bg-pos-surface-lowest rounded-xl p-4 sm:p-5 border border-pos-surface-container">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-widest mb-4">{t('saleItems')}</h3>
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="bg-pos-surface-low rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <select value={row.productId} onChange={e => selectProduct(row.id, e.target.value)}
                      className="flex-1 bg-pos-surface-high border-none rounded-lg text-xs py-2 px-2 outline-none focus:ring-2 focus:ring-pos-secondary">
                      <option value="">{t('selectProduct')}</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} ({p.size}) — ৳{p.pricePerBox} [{p.stock}]
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
                      <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('qty')}</label>
                      <input type="number" min={1} value={row.qty || ''} onChange={e => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)}
                        className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-2 outline-none focus:ring-2 focus:ring-pos-secondary" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('rate')}</label>
                      <input type="number" value={row.rate || ''} onChange={e => updateRow(row.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 px-2 outline-none focus:ring-2 focus:ring-pos-secondary" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">{t('subtotal')}</label>
                      <div className="text-xs font-bold text-pos-secondary py-2 px-2">{formatCurrency(row.qty * row.rate)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addRow}
              className="mt-4 w-full py-2 border-2 border-dashed border-pos-outline-variant rounded-lg text-xs text-pos-on-surface-variant hover:border-pos-secondary hover:text-pos-secondary transition-colors flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">add</span>{t('addItem')}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={handleSave}
              className="w-full py-3.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
              <span className="material-symbols-outlined">check_circle</span>{t('saveSale')}
            </button>
          </div>
        </div>

        {/* Column 3: LIVE CHALLAN PREVIEW */}
        <div className="hidden lg:block">
          <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container sticky top-24 overflow-hidden">
            <div className="px-4 py-3 bg-pos-surface-low border-b border-pos-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-pos-secondary text-base">receipt_long</span>
              <span className="text-xs font-bold text-pos-on-surface-variant uppercase tracking-widest">{t('challanPreview')}</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-pos-tertiary animate-pulse" title="Live" />
            </div>
            <div className="p-4 text-[11px]" style={{ fontFamily: "'Inter', sans-serif" }}>
              {/* Mini Invoice */}
              <div className="flex justify-between items-start mb-2 pb-2 border-b-2 border-pos-secondary">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-pos-secondary rounded-md flex items-center justify-center text-white font-black text-[9px]">
                    {settings.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-black tracking-tight">{settings.name}</div>
                    {settings.phone && <div className="text-[9px] text-pos-on-surface-variant">{settings.phone}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] font-bold text-pos-on-surface-variant uppercase">CHALLAN</div>
                  <div className="text-[9px] text-pos-on-surface-variant">{new Date().toLocaleDateString('en-GB')}</div>
                </div>
              </div>

              {/* Customer */}
              <div className="bg-pos-surface-high rounded p-2 mb-2">
                <div className="text-[8px] text-pos-on-surface-variant uppercase font-bold">{t('customer')}</div>
                <div className="text-[10px] font-semibold">{customerName || t('walkInCustomer')}</div>
                {phone && <div className="text-[9px] text-pos-on-surface-variant">{phone}</div>}
              </div>

              {/* Items */}
              {previewItems.length > 0 ? (
                <div className="mb-2">
                  <div className="grid grid-cols-12 gap-1 text-[8px] font-bold text-pos-on-surface-variant uppercase mb-1 px-1">
                    <div className="col-span-5">{t('products')}</div>
                    <div className="col-span-2 text-center">{t('qty')}</div>
                    <div className="col-span-2 text-right">{t('rate')}</div>
                    <div className="col-span-3 text-right">{t('total')}</div>
                  </div>
                  {previewItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1 px-1 py-1 border-b border-pos-surface-container">
                      <div className="col-span-5 truncate font-medium">{item.name}</div>
                      <div className="col-span-2 text-center">{item.qty}</div>
                      <div className="col-span-2 text-right text-pos-on-surface-variant">{formatCurrency(item.price)}</div>
                      <div className="col-span-3 text-right font-semibold">{formatCurrency(item.qty * item.price)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-pos-on-surface-variant">
                  <span className="material-symbols-outlined text-2xl mb-1 block">receipt_long</span>
                  <span className="text-[10px]">{t('livePreview')}</span>
                </div>
              )}

              {/* Totals */}
              {previewItems.length > 0 && (
                <div className="border-t border-pos-surface-container pt-2 space-y-1">
                  <div className="flex justify-between"><span className="text-pos-on-surface-variant">{t('subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
                  {discountVal > 0 && <div className="flex justify-between text-pos-error"><span>{t('discount')}</span><span>-{formatCurrency(discountVal)}</span></div>}
                  <div className="flex justify-between font-black text-sm border-t border-pos-on-surface pt-1">
                    <span>{t('total')}</span><span className="text-pos-secondary">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-pos-on-surface-variant">
                    <span>{paymentLabels[payment] || payment}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase ${
                      status === 'paid' ? 'bg-[#86ff90] text-[#006120]' : status === 'pending' ? 'bg-[#fef08a] text-[#854f0b]' : 'bg-[#d8e2ff] text-[#003d85]'
                    }`}>{statusLabels[status] || status}</span>
                  </div>
                </div>
              )}

              {/* Mini terms */}
              {previewItems.length > 0 && (
                <div className="mt-3 pt-2 border-t border-pos-surface-container text-[8px] text-pos-on-surface-variant">
                  <div className="font-bold text-pos-on-surface mb-0.5">{t('termsAndConditions')}</div>
                  • {t('goodsOnceDelivered')}
                </div>
              )}
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
