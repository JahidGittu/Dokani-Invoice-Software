import { useState, useCallback, useRef, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextInvoiceNumber, calcDiscount, type Product, type SaleRecord, type Customer, type CompanySettings } from "@/lib/store";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface NewSaleRow {
  id: number;
  productId: string;
  qty: number;
  rate: number;
  searchQuery: string;
  showDropdown: boolean;
}

interface NewSaleScreenProps {
  products: Product[];
  customers: Customer[];
  settings: CompanySettings;
  onSaleComplete: (sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => void;
  onAutoAddCustomer: (name: string, phone: string, address: string) => void;
}

// Searchable Product Picker component
function ProductPicker({ 
  products, row, onSelect, onUpdateSearch, onToggleDropdown, onRemove, onToggleScan, t 
}: {
  products: Product[];
  row: NewSaleRow;
  onSelect: (productId: string) => void;
  onUpdateSearch: (query: string) => void;
  onToggleDropdown: (show: boolean) => void;
  onRemove: () => void;
  onToggleScan?: () => void;
  t: (key: string) => string;
}) {
  const selectedProduct = products.find(p => p.id === row.productId);
  const debouncedQuery = useDebounce(row.searchQuery, 150);
  
  const filtered = useMemo(() => {
    if (!debouncedQuery) return products;
    const q = debouncedQuery.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.size.toLowerCase().includes(q) ||
      p.batch.toLowerCase().includes(q) ||
      String(p.pricePerBox).includes(q)
    );
  }, [products, debouncedQuery]);

  const handleSelect = (p: Product) => {
    onSelect(p.id);
    onUpdateSearch('');
    onToggleDropdown(false);
  };

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Scan button */}
      <button
        onClick={() => onToggleScan?.()}
        className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
        title={t('scan')}
      >
        <span className="material-symbols-outlined text-base">qr_code_scanner</span>
      </button>

      {selectedProduct ? (
        <div className="flex-1 bg-muted/40 rounded-lg px-3 py-1.5 flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{selectedProduct.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{selectedProduct.size}</span>
          <button onClick={() => { onSelect(''); onUpdateSearch(''); }}
            className="ml-auto text-muted-foreground hover:text-destructive shrink-0">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      ) : (
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">search</span>
          <input
            value={row.searchQuery}
            onChange={e => { onUpdateSearch(e.target.value); onToggleDropdown(true); }}
            onFocus={() => onToggleDropdown(true)}
            onBlur={() => setTimeout(() => onToggleDropdown(false), 200)}
            className="w-full bg-transparent border-b border-border text-sm py-1.5 pl-7 pr-2 outline-none focus:border-primary placeholder:text-muted-foreground/50"
            placeholder={t('searchProductPlaceholder')}
          />
        </div>
      )}
      
      {row.showDropdown && !selectedProduct && (
        <div className="absolute top-full left-10 right-0 bg-card border border-border rounded-lg shadow-xl z-20 mt-1 max-h-[200px] overflow-y-auto">
          {filtered.length > 0 ? filtered.map(p => (
            <button key={p.id} onMouseDown={() => handleSelect(p)}
              disabled={p.stock <= 0}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2 ${p.stock <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">{p.size} · {p.finish} · {p.batch}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-primary text-[11px]">৳{p.pricePerBox}</div>
                <div className={`text-[9px] ${p.stock <= 20 ? 'text-destructive' : 'text-muted-foreground'}`}>{p.stock} {t('boxes')}</div>
              </div>
            </button>
          )) : (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">{t('noProducts')}</div>
          )}
        </div>
      )}
    </div>
  );
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
  const [delivery, setDelivery] = useState('');
  const [labour, setLabour] = useState('');
  const [returnAmt, setReturnAmt] = useState('');
  const [lessAmt, setLessAmt] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [rows, setRows] = useState<NewSaleRow[]>([{ id: Date.now(), productId: '', qty: 1, rate: 0, searchQuery: '', showDropdown: false }]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanStatus, setScanStatus] = useState<'waiting' | 'found' | 'notfound'>('waiting');
  const [scanResult, setScanResult] = useState<Product | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

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

  const addRow = () => setRows(prev => [...prev, { id: Date.now(), productId: '', qty: 1, rate: 0, searchQuery: '', showDropdown: false }]);
  const removeRow = (id: number) => setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: keyof NewSaleRow, value: string | number | boolean) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const selectProduct = (rowId: number, productId: string) => {
    if (!productId) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, productId: '', rate: 0 } : r));
      return;
    }
    const p = products.find(x => x.id === productId);
    if (p) setRows(prev => prev.map(r => r.id === rowId ? { ...r, productId, rate: p.pricePerBox, qty: r.qty || 1 } : r));
  };

  const handleBarcode = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return;
    const q = barcodeInput.trim().toLowerCase();
    const found = products.find(p => p.batch.toLowerCase() === q || p.name.toLowerCase().includes(q) || p.id === q);
    if (found) {
      const existingRow = rows.find(r => r.productId === found.id);
      if (existingRow) {
        updateRow(existingRow.id, 'qty', existingRow.qty + 1);
      } else {
        const emptyRow = rows.find(r => !r.productId);
        if (emptyRow) {
          setRows(prev => prev.map(r => r.id === emptyRow.id ? { ...r, productId: found.id, rate: found.pricePerBox, qty: 1, searchQuery: '' } : r));
        } else {
          setRows(prev => [...prev, { id: Date.now(), productId: found.id, qty: 1, rate: found.pricePerBox, searchQuery: '', showDropdown: false }]);
        }
      }
      toast.success(`${found.name} ${t('addedToCart')}`);
    } else {
      toast.error(t('productNotFound'));
    }
    setBarcodeInput('');
  };

  // Calculations
  const subtotal = rows.reduce((sum, r) => sum + (r.qty * r.rate), 0);
  const discountVal = calcDiscount(subtotal, parseFloat(discount) || 0, discountType);
  const deliveryVal = parseFloat(delivery) || 0;
  const labourVal = parseFloat(labour) || 0;
  const total = Math.max(0, subtotal - discountVal + deliveryVal + labourVal);
  const paidVal = parseFloat(paidAmount) || 0;
  const dueVal = Math.max(0, total - paidVal);
  const receivedNum = parseFloat(received) || 0;
  const change = receivedNum > 0 && receivedNum >= total ? receivedNum - total : 0;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const bizInfoLine = [settings.phone, settings.address].filter(Boolean).join(' · ');

  const collectSaleData = (): { sale: SaleRecord; deductions: { productId: string; qty: number }[] } | null => {
    const items = rows.filter(r => r.productId && r.qty > 0 && r.rate > 0).map(r => {
      const p = products.find(x => x.id === r.productId);
      return { productId: r.productId, name: p?.name || 'Custom Item', detail: p ? `${p.size} · ${p.finish}` : '', qty: r.qty, price: r.rate, stock: p?.stock ?? 999 };
    });
    if (!items.length) { toast.error(t('addAtLeastOneItem')); return null; }
    const overStock = items.find(i => i.qty > i.stock);
    if (overStock) { toast.error(`${overStock.name}: ${t('qty')} ${overStock.qty} > ${t('stock')} ${overStock.stock}`); return null; }
    const inv = getNextInvoiceNumber(settings.invPrefix);
    const now = new Date();
    const autoStatus = paidVal >= total ? 'paid' : paidVal > 0 ? 'pending' : status === 'credit' ? 'credit' : 'pending';
    const sale: SaleRecord = {
      id: crypto.randomUUID(), invoice: inv, customer: customerName || t('walkInCustomer'),
      phone, address, items, subtotal, discount: discountVal, discountType, total,
      paymentMethod: payment, notes, status: autoStatus as SaleRecord['status'],
      date: now.toISOString(), time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      paid: paidVal, due: dueVal, delivery: deliveryVal, labour: labourVal,
    };
    return { sale, deductions: items.filter(i => i.productId).map(i => ({ productId: i.productId, qty: i.qty })) };
  };

  const commitSale = (sale: SaleRecord, deductions: { productId: string; qty: number }[]) => {
    onSaleComplete(sale, deductions);
    if (sale.customer !== t('walkInCustomer') && !customers.find(c => c.name === sale.customer)) {
      onAutoAddCustomer(sale.customer, sale.phone, sale.address || '');
    }
  };

  const resetForm = () => {
    setCustomerName(''); setPhone(''); setAddress(''); setNotes('');
    setDiscount(''); setReceived(''); setPayment('cash'); setStatus('paid');
    setDelivery(''); setLabour(''); setPaidAmount('');
    setRows([{ id: Date.now(), productId: '', qty: 1, rate: 0, searchQuery: '', showDropdown: false }]);
  };

  const handleSaveAndPrint = () => {
    const data = collectSaleData(); if (!data) return;
    commitSale(data.sale, data.deductions);
    handlePrintSale(data.sale);
    resetForm();
    toast.success(t('saleSaved'));
  };

  const handleSaveOnly = () => {
    const data = collectSaleData(); if (!data) return;
    commitSale(data.sale, data.deductions);
    resetForm();
    toast.success(t('saleSaved'));
  };

  const handleSaveAndPDF = () => {
    const data = collectSaleData(); if (!data) return;
    commitSale(data.sale, data.deductions);
    generatePDF(data.sale);
    resetForm();
    toast.success(t('saleSaved'));
  };

  const handleSaveAndThermal = () => {
    const data = collectSaleData(); if (!data) return;
    commitSale(data.sale, data.deductions);
    handleThermalPrint(data.sale);
    resetForm();
    toast.success(t('saleSaved'));
  };

  // ─── Print / PDF / Thermal generators ───
  const generatePrintHTML = (sale: SaleRecord) => {
    const qrSVG = generateQRSVG(`${sale.invoice}-${sale.total}`);
    return `<!DOCTYPE html><html><head><title>${sale.invoice}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Segoe UI',Arial,sans-serif;color:#2d3435;font-size:13px;background:#fff}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:20mm 20mm 15mm;position:relative}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #005cc1;margin-bottom:16px}
.logo-area{display:flex;align-items:center;gap:12px}
.logo-box{width:44px;height:44px;background:#005cc1;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px}
.title{font-size:22px;font-weight:900;letter-spacing:-.5px}
.subtitle{font-size:10px;color:#5a6061;margin-top:2px}
.inv-info{text-align:right}
.inv-num{font-size:14px;font-weight:800;color:#005cc1}
.inv-date{font-size:11px;color:#5a6061;margin-top:2px}
.inv-label{font-size:9px;font-weight:700;color:#5a6061;text-transform:uppercase;letter-spacing:1px}
.customer-block{display:flex;justify-content:space-between;background:#f5f7f8;border-radius:8px;padding:14px 16px;margin-bottom:16px}
.customer-block .label{font-size:9px;font-weight:700;text-transform:uppercase;color:#5a6061;letter-spacing:.5px;margin-bottom:4px}
.customer-block .value{font-size:12px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:#f5f7f8}
th{font-size:10px;font-weight:700;text-transform:uppercase;color:#5a6061;padding:10px 12px;text-align:left}
th:nth-child(2),th:nth-child(3){text-align:center}
th:last-child{text-align:right}
td{padding:10px 12px;font-size:12px;border-bottom:1px solid #f0f2f3}
td:nth-child(2),td:nth-child(3){text-align:center}
td:last-child{text-align:right;font-weight:600}
.detail{font-size:10px;color:#5a6061}
.summary{display:flex;justify-content:flex-end}
.summary-table{width:220px}
.summary-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px}
.summary-row.total{font-size:18px;font-weight:900;padding:10px 0;border-top:2px solid #2d3435;margin-top:6px}
.total-amount{color:#005cc1}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase}
.badge-paid{background:#86ff90;color:#006120}
.badge-pending{background:#fef08a;color:#854f0b}
.badge-credit{background:#d8e2ff;color:#003d85}
.footer-area{display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;border-top:1px solid #f0f2f3;padding-top:16px}
.qr-area{display:flex;align-items:center;gap:8px}
.qr-label{font-size:8px;color:#5a6061}
.terms{font-size:9px;color:#5a6061;max-width:320px;line-height:1.5}
.terms strong{font-size:10px;color:#2d3435}
.thank-you{text-align:center;font-size:10px;color:#5a6061;margin-top:16px;padding-top:12px;border-top:1px solid #f0f2f3}
@media print{@page{size:A4;margin:0} .page{padding:15mm 18mm}}
</style></head><body>
<div class="page">
<div class="header">
  <div class="logo-area">
    <div class="logo-box">${settings.name.slice(0, 2).toUpperCase()}</div>
    <div><div class="title">${settings.name}</div>${bizInfoLine ? `<div class="subtitle">${bizInfoLine}</div>` : ''}</div>
  </div>
  <div class="inv-info">
    <div class="inv-label">INVOICE / CHALLAN</div>
    <div class="inv-num">${sale.invoice}</div>
    <div class="inv-date">${dateStr} · ${sale.time}</div>
  </div>
</div>
<div class="customer-block">
  <div><div class="label">Customer</div><div class="value">${sale.customer}</div></div>
  ${sale.phone ? `<div><div class="label">Phone</div><div class="value">${sale.phone}</div></div>` : ''}
  ${sale.address ? `<div><div class="label">Address</div><div class="value">${sale.address}</div></div>` : ''}
  <div><div class="label">Payment</div><div class="value" style="text-transform:capitalize">${sale.paymentMethod}</div></div>
</div>
${sale.notes ? `<div style="font-size:11px;color:#5a6061;margin-bottom:12px;font-style:italic">Notes: ${sale.notes}</div>` : ''}
<table>
  <thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
  <tbody>${sale.items.map(item => `
    <tr><td>${item.name}<div class="detail">${item.detail}</div></td><td>${item.qty}</td><td>${formatCurrency(item.price)}</td><td>${formatCurrency(item.price * item.qty)}</td></tr>
  `).join('')}</tbody>
</table>
<div class="summary"><div class="summary-table">
  <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
  ${sale.discount > 0 ? `<div class="summary-row" style="color:#9f403d"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>` : ''}
  ${(sale.delivery ?? 0) > 0 ? `<div class="summary-row"><span>Delivery</span><span>+${formatCurrency(sale.delivery!)}</span></div>` : ''}
  ${(sale.labour ?? 0) > 0 ? `<div class="summary-row"><span>Labour</span><span>+${formatCurrency(sale.labour!)}</span></div>` : ''}
  <div class="summary-row total"><span>TOTAL</span><span class="total-amount">${formatCurrency(sale.total)}</span></div>
  <div class="summary-row" style="font-weight:700;color:#006120"><span>Paid</span><span>${formatCurrency(sale.paid ?? sale.total)}</span></div>
  ${(sale.due ?? 0) > 0 ? `<div class="summary-row" style="font-weight:700;color:#9f403d"><span>Due</span><span>${formatCurrency(sale.due!)}</span></div>` : ''}
  <div class="summary-row"><span>Status</span><span class="badge badge-${sale.status}">${sale.status.toUpperCase()}</span></div>
</div></div>
<div class="footer-area">
  <div class="qr-area">${qrSVG}<div class="qr-label">Scan to verify</div></div>
  <div class="terms"><strong>Terms & Conditions</strong><br>• Goods once delivered cannot be returned.<br>• Prices subject to change without notice.<br>• Credit payment due within 30 days.</div>
</div>
<div class="thank-you">${settings.name ? `Thank you for shopping at ${settings.name}!` : 'Thank you!'}</div>
</div>
</body></html>`;
  };

  const handlePrintSale = (sale: SaleRecord) => {
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) { toast.error(t('popupBlocked')); return; }
    w.document.write(generatePrintHTML(sale));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const handleThermalPrint = (sale: SaleRecord) => {
    const w = window.open('', '_blank', 'width=320,height=600');
    if (!w) { toast.error(t('popupBlocked')); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>${sale.invoice}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;width:280px;padding:12px;color:#000;font-size:11px}
.center{text-align:center}.bold{font-weight:700}.line{border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between}.item-name{font-weight:600}
h2{font-size:14px;margin-bottom:2px}
.total-line{font-size:14px;font-weight:900;border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin:4px 0}
</style></head><body>
<div class="center"><h2>${settings.name}</h2>${bizInfoLine ? `<div style="font-size:9px">${bizInfoLine}</div>` : ''}</div>
<div class="line"></div>
<div class="row"><span>${sale.invoice}</span><span>${dateStr}</span></div>
<div style="font-size:10px">Customer: ${sale.customer}</div>
${sale.phone ? `<div style="font-size:10px">Phone: ${sale.phone}</div>` : ''}
<div class="line"></div>
${sale.items.map(item => `<div class="item-name">${item.name}</div><div class="row"><span>${item.qty} x ${formatCurrency(item.price)}</span><span>${formatCurrency(item.price * item.qty)}</span></div>`).join('')}
<div class="line"></div>
<div class="row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
${sale.discount > 0 ? `<div class="row"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>` : ''}
${(sale.delivery ?? 0) > 0 ? `<div class="row"><span>Delivery</span><span>+${formatCurrency(sale.delivery!)}</span></div>` : ''}
${(sale.labour ?? 0) > 0 ? `<div class="row"><span>Labour</span><span>+${formatCurrency(sale.labour!)}</span></div>` : ''}
<div class="row total-line"><span>TOTAL</span><span>${formatCurrency(sale.total)}</span></div>
<div class="row"><span>Paid</span><span>${formatCurrency(sale.paid ?? sale.total)}</span></div>
${(sale.due ?? 0) > 0 ? `<div class="row" style="color:red"><span>Due</span><span>${formatCurrency(sale.due!)}</span></div>` : ''}
<div class="row" style="font-size:10px"><span>Payment: ${sale.paymentMethod.toUpperCase()}</span><span>${sale.status.toUpperCase()}</span></div>
<div class="line"></div>
<div class="center" style="font-size:9px;margin-top:4px">Thank you! Visit again.</div>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const generatePDF = (sale: SaleRecord) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210;
    let y = 20;

    doc.setFillColor(0, 92, 193);
    doc.roundedRect(15, y - 4, 12, 12, 2, 2, 'F');
    doc.setTextColor(255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(settings.name.slice(0, 2).toUpperCase(), 21, y + 3, { align: 'center' });
    doc.setTextColor(45, 52, 53); doc.setFontSize(16); doc.text(settings.name, 30, y + 1);
    if (bizInfoLine) { doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(bizInfoLine, 30, y + 6); }

    doc.setFontSize(8); doc.setTextColor(90, 96, 97);
    doc.text('INVOICE / CHALLAN', pw - 15, y - 2, { align: 'right' });
    doc.setFontSize(12); doc.setTextColor(0, 92, 193); doc.setFont('helvetica', 'bold');
    doc.text(sale.invoice, pw - 15, y + 4, { align: 'right' });
    doc.setFontSize(8); doc.setTextColor(90, 96, 97); doc.setFont('helvetica', 'normal');
    doc.text(`${dateStr} · ${sale.time}`, pw - 15, y + 9, { align: 'right' });

    y += 16;
    doc.setDrawColor(0, 92, 193); doc.setLineWidth(0.8); doc.line(15, y, pw - 15, y);
    y += 8;

    doc.setFillColor(245, 247, 248); doc.roundedRect(15, y - 3, pw - 30, 14, 2, 2, 'F');
    doc.setFontSize(7); doc.setTextColor(90, 96, 97); doc.text('CUSTOMER', 18, y + 1);
    doc.setFontSize(9); doc.setTextColor(45, 52, 53); doc.setFont('helvetica', 'bold');
    doc.text(sale.customer, 18, y + 6);
    if (sale.phone) { doc.setFontSize(7); doc.setTextColor(90, 96, 97); doc.text('PHONE', 80, y + 1); doc.setFontSize(9); doc.setTextColor(45, 52, 53); doc.text(sale.phone, 80, y + 6); }
    doc.setFontSize(7); doc.setTextColor(90, 96, 97); doc.text('PAYMENT', 140, y + 1);
    doc.setFontSize(9); doc.setTextColor(45, 52, 53); doc.text(sale.paymentMethod.toUpperCase(), 140, y + 6);
    doc.setFont('helvetica', 'normal'); y += 16;

    if (sale.notes) { doc.setFontSize(8); doc.setTextColor(90, 96, 97); doc.text(`Notes: ${sale.notes}`, 15, y); y += 6; }

    const tableData = sale.items.map(item => [`${item.name}\n${item.detail}`, String(item.qty), formatCurrency(item.price), formatCurrency(item.price * item.qty)]);
    doc.autoTable({
      startY: y, head: [['Product', 'Qty', 'Rate', 'Total']], body: tableData, theme: 'striped',
      margin: { left: 15, right: 15 }, styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fontStyle: 'bold', fontSize: 8, textColor: [90, 96, 97], fillColor: [245, 247, 248] },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 35, halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    const totalsX = 140;
    doc.setFontSize(9); doc.setTextColor(90, 96, 97); doc.text('Subtotal', totalsX, y);
    doc.setTextColor(45, 52, 53); doc.text(formatCurrency(sale.subtotal), pw - 15, y, { align: 'right' }); y += 5;
    if (sale.discount > 0) { doc.setTextColor(159, 64, 61); doc.text('Discount', totalsX, y); doc.text(`-${formatCurrency(sale.discount)}`, pw - 15, y, { align: 'right' }); y += 5; }
    if ((sale.delivery ?? 0) > 0) { doc.setTextColor(90, 96, 97); doc.text('Delivery', totalsX, y); doc.setTextColor(45, 52, 53); doc.text(`+${formatCurrency(sale.delivery!)}`, pw - 15, y, { align: 'right' }); y += 5; }
    if ((sale.labour ?? 0) > 0) { doc.setTextColor(90, 96, 97); doc.text('Labour', totalsX, y); doc.setTextColor(45, 52, 53); doc.text(`+${formatCurrency(sale.labour!)}`, pw - 15, y, { align: 'right' }); y += 5; }
    doc.setDrawColor(45, 52, 53); doc.setLineWidth(0.5); doc.line(totalsX - 5, y, pw - 15, y); y += 6;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('TOTAL', totalsX, y);
    doc.setTextColor(0, 92, 193); doc.text(formatCurrency(sale.total), pw - 15, y, { align: 'right' }); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 97, 32); doc.text('Paid', totalsX, y);
    doc.text(formatCurrency(sale.paid ?? sale.total), pw - 15, y, { align: 'right' }); y += 5;
    if ((sale.due ?? 0) > 0) { doc.setTextColor(159, 64, 61); doc.text('Due', totalsX, y); doc.text(formatCurrency(sale.due!), pw - 15, y, { align: 'right' }); y += 5; }
    doc.setFontSize(8); doc.setTextColor(45, 52, 53); doc.setFont('helvetica', 'normal');
    doc.text(`Status: ${sale.status.toUpperCase()}`, totalsX, y); y += 12;

    doc.setDrawColor(240, 242, 243); doc.line(15, y, pw - 15, y); y += 6;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text('Terms & Conditions', 15, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 96, 97); y += 4;
    doc.text('• Goods once delivered cannot be returned.', 15, y); y += 3.5;
    doc.text('• Prices subject to change without notice.', 15, y); y += 3.5;
    doc.text('• Credit payment due within 30 days.', 15, y); y += 8;
    doc.setFontSize(8); doc.setTextColor(90, 96, 97);
    doc.text(`Thank you for shopping at ${settings.name}!`, pw / 2, y, { align: 'center' });
    doc.save(`${sale.invoice}.pdf`);
    toast.success(t('pdfDownloaded'));
  };

  const handleWhatsApp = () => {
    const data = collectSaleData(); if (!data) return;
    const sale = data.sale;
    let msg = `*${settings.name}*\n`;
    if (bizInfoLine) msg += `${bizInfoLine}\n`;
    msg += `📋 Invoice: ${sale.invoice}\n📅 Date: ${dateStr}\n👤 Customer: ${sale.customer}\n`;
    if (sale.phone) msg += `📱 Phone: ${sale.phone}\n`;
    msg += `\n*Items:*\n`;
    sale.items.forEach(item => { msg += `• ${item.name} x${item.qty} = ${formatCurrency(item.price * item.qty)}\n`; });
    if (sale.discount > 0) msg += `\n💰 Discount: -${formatCurrency(sale.discount)}`;
    msg += `\n*💵 Total: ${formatCurrency(sale.total)}*`;
    msg += `\n✅ ${sale.paymentMethod.toUpperCase()} · ${sale.status.toUpperCase()}`;
    window.open(`https://wa.me/${sale.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const paymentLabels: Record<string, string> = { cash: t('cash'), bkash: t('bkash'), nagad: t('nagad'), card: t('card'), credit: t('creditDue') };
  const statusLabels: Record<string, string> = { paid: t('paid'), pending: t('pending'), credit: t('credit') };
  const statusBadgeClass = status === 'paid' ? 'bg-[hsl(125,100%,77%)] text-[hsl(144,100%,19%)]' : status === 'pending' ? 'bg-[hsl(54,97%,77%)] text-[hsl(37,82%,29%)]' : 'bg-[hsl(224,100%,92%)] text-[hsl(211,100%,26%)]';

  return (
    <section className="p-4 sm:p-6 max-w-4xl mx-auto">

      {/* ═══════ A4 PAPER INVOICE-FORM ═══════ */}
      <div ref={invoiceRef} className="bg-card rounded-sm border border-border shadow-[0_2px_20px_rgba(0,0,0,0.08)] overflow-hidden mx-auto"
        style={{ maxWidth: '210mm', minHeight: '297mm', aspectRatio: '210/297' }}>

        {/* ── Invoice Header ── */}
        <div className="px-8 sm:px-12 pt-8 sm:pt-10 pb-4 border-b-[3px] border-primary">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-base">
                {settings.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{settings.name}</div>
                {bizInfoLine && <div className="text-[11px] text-muted-foreground">{bizInfoLine}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-[2px]">INVOICE / CHALLAN</div>
              <div className="text-primary font-black text-lg tracking-wide">#NEW</div>
              <div className="text-xs text-muted-foreground">{dateStr} · {timeStr}</div>
            </div>
          </div>
        </div>

        {/* ── Bill To (editable) ── */}
        <div className="px-8 sm:px-12 py-4 bg-muted/30">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{t('billTo')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <input value={customerName}
                onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full bg-transparent border-b border-border text-sm font-semibold py-1.5 focus:border-primary outline-none placeholder:text-muted-foreground/50"
                placeholder={t('customerNameReq')} />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-lg shadow-xl z-10 mt-1 max-h-[160px] overflow-y-auto">
                  {suggestions.map(c => (
                    <button key={c.id} onMouseDown={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex justify-between">
                      <span className="font-medium">{c.name}</span><span className="text-muted-foreground">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="bg-transparent border-b border-border text-sm py-1.5 focus:border-primary outline-none placeholder:text-muted-foreground/50"
              placeholder={t('phone')} />
            <input value={address} onChange={e => setAddress(e.target.value)}
              className="bg-transparent border-b border-border text-sm py-1.5 focus:border-primary outline-none placeholder:text-muted-foreground/50"
              placeholder={t('address')} />
          </div>
        </div>

        {/* ── Items Table (editable with searchable picker) ── */}
        <div className="px-8 sm:px-12 py-5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{t('saleItems')}</div>

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-2 border-b border-border pb-2">
            <div className="col-span-5">{t('products')}</div>
            <div className="col-span-2 text-center">{t('qty')}</div>
            <div className="col-span-2 text-right">{t('rate')}</div>
            <div className="col-span-2 text-right">{t('total')}</div>
            <div className="col-span-1"></div>
          </div>

          {/* Item rows */}
          <div className="space-y-1">
            {rows.map((row) => {
              const rowTotal = row.qty * row.rate;
              const product = products.find(p => p.id === row.productId);
              return (
                <div key={row.id} className="grid grid-cols-12 gap-2 items-center px-1 py-2 border-b border-border/50 hover:bg-muted/20 transition-colors">
                  {/* Product picker */}
                  <div className="col-span-12 sm:col-span-5">
                    <ProductPicker
                      products={products}
                      row={row}
                      onSelect={(pid) => selectProduct(row.id, pid)}
                      onUpdateSearch={(q) => updateRow(row.id, 'searchQuery', q)}
                      onToggleDropdown={(show) => updateRow(row.id, 'showDropdown', show)}
                      onRemove={() => removeRow(row.id)}
                      onToggleScan={() => { setShowScanModal(true); setScanStatus('waiting'); setScanResult(null); setBarcodeInput(''); }}
                      t={t as (key: string) => string}
                    />
                    {product && <div className="text-[10px] text-muted-foreground mt-0.5 pl-1">{product.size} · {product.finish}</div>}
                  </div>
                  {/* Qty */}
                  <div className="col-span-4 sm:col-span-2">
                    <input type="number" min={1} value={row.qty || ''} onChange={e => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)}
                      className="w-full bg-transparent border-b border-border text-sm py-1 text-center outline-none focus:border-primary" />
                  </div>
                  {/* Rate */}
                  <div className="col-span-4 sm:col-span-2">
                    <input type="number" value={row.rate || ''} onChange={e => updateRow(row.id, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent border-b border-border text-sm py-1 text-right outline-none focus:border-primary" />
                  </div>
                  {/* Total */}
                  <div className="col-span-3 sm:col-span-2 text-right">
                    <span className="text-sm font-bold text-foreground">{formatCurrency(rowTotal)}</span>
                  </div>
                  {/* Delete */}
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => removeRow(row.id)} className="w-6 h-6 rounded-md hover:bg-destructive/10 text-destructive flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={addRow}
            className="mt-3 w-full py-2 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">add</span>{t('addItem')}
          </button>
        </div>

        {/* ── Summary & Payment ── */}
        <div className="px-8 sm:px-12 pb-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Left: Payment & Notes */}
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">{t('paymentMethod')}</label>
                  <select value={payment} onChange={e => setPayment(e.target.value)}
                    className="w-full bg-muted/30 border border-border rounded-lg text-sm py-2 px-2 outline-none focus:ring-2 focus:ring-ring">
                    <option value="cash">{t('cash')}</option>
                    <option value="bkash">{t('bkash')}</option>
                    <option value="nagad">{t('nagad')}</option>
                    <option value="card">{t('card')}</option>
                    <option value="credit">{t('creditDue')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">{t('status')}</label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full bg-muted/30 border border-border rounded-lg text-sm py-2 px-2 outline-none focus:ring-2 focus:ring-ring">
                    <option value="paid">{t('paid')}</option>
                    <option value="pending">{t('pending')}</option>
                    <option value="credit">{t('credit')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">{t('notes')}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full bg-muted/30 border border-border rounded-lg text-sm py-2 px-2 outline-none resize-none focus:ring-2 focus:ring-ring" placeholder="..." />
              </div>
            </div>

            {/* Right: Totals */}
            <div className="w-full sm:w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('subtotal')}</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('discount')}</span>
                <div className="flex gap-1 items-center">
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                    className="w-14 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percent')}
                    className="bg-muted/30 border border-border rounded text-[10px] py-1 px-1 outline-none">
                    <option value="flat">৳</option><option value="percent">%</option>
                  </select>
                </div>
              </div>
              {discountVal > 0 && <div className="flex justify-between text-destructive text-xs"><span>{t('discount')}</span><span>-{formatCurrency(discountVal)}</span></div>}
              
              {/* Return */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Return</span>
                <input type="number" value={returnAmt} onChange={e => setReturnAmt(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>
              {/* Less */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Less</span>
                <input type="number" value={lessAmt} onChange={e => setLessAmt(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>

              {/* Delivery */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{t('delivery')}</span>
                <input type="number" value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>
              {/* Labour */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{t('labour')}</span>
                <input type="number" value={labour} onChange={e => setLabour(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>

              <div className="h-[2px] bg-foreground" />
              <div className="flex justify-between text-xl font-black">
                <span>{t('total')}</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>

              {/* Paid */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-bold">{t('paid')}</span>
                <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0"
                  className="w-20 bg-[hsl(125,100%,95%)] border border-[hsl(125,60%,70%)] rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-[hsl(125,60%,50%)] font-bold" />
              </div>
              {/* Due */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-destructive font-bold">{t('due')}</span>
                <span className={`font-bold text-sm ${dueVal > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(dueVal)}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{t('amountReceived')}</span>
                <input type="number" value={received} onChange={e => setReceived(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>
              {change > 0 && <div className="flex justify-between text-xs font-bold text-[hsl(var(--pos-tertiary))]"><span>{t('change')}</span><span>{formatCurrency(change)}</span></div>}
              <div className="flex justify-end">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeClass}`}>
                  {statusLabels[status] || status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer: Terms ── */}
        <div className="px-8 sm:px-12 py-3 bg-muted/20 border-t border-border text-[9px] text-muted-foreground mt-auto">
          <span className="font-bold text-foreground text-[10px]">{t('termsAndConditions')}</span>
          <span className="ml-2">• {t('goodsOnceDelivered')} • {t('priceSubjectToChange')} • {t('paymentDueWithin')}</span>
        </div>
      </div>

      {/* ── Action Buttons (below the paper) ── */}
      <div className="max-w-[210mm] mx-auto mt-4 no-print">
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSaveAndPrint}
            className="flex-1 min-w-[140px] py-3 bg-gradient-to-b from-primary to-primary/90 text-primary-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
            <span className="material-symbols-outlined text-lg">print</span>
            {t('saveSale')} & {t('print')}
          </button>
          <button onClick={handleSaveAndPDF}
            className="py-3 px-4 bg-destructive/10 text-destructive rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors">
            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>PDF
          </button>
          <button onClick={handleSaveAndThermal}
            className="py-3 px-4 bg-accent text-accent-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-accent/80 transition-colors">
            <span className="material-symbols-outlined text-lg">receipt</span>80mm
          </button>
          <button onClick={handleWhatsApp}
            className="py-3 px-4 bg-[hsl(142,70%,45%)]/10 text-[hsl(142,70%,35%)] rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(142,70%,45%)]/20 transition-colors">
            <span className="material-symbols-outlined text-lg">send</span>WhatsApp
          </button>
          <button onClick={handleSaveOnly}
            className="py-3 px-4 bg-muted text-foreground rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors">
            <span className="material-symbols-outlined text-lg">save</span>{t('saveSale')}
          </button>
        </div>
      </div>

      {/* ── Scan Modal ── */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowScanModal(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                scanStatus === 'waiting' ? 'bg-primary/10' : scanStatus === 'found' ? 'bg-[hsl(142,70%,90%)]' : 'bg-destructive/10'
              }`}>
                <span className={`material-symbols-outlined text-4xl ${
                  scanStatus === 'waiting' ? 'text-primary animate-pulse' : scanStatus === 'found' ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'
                }`}>
                  {scanStatus === 'waiting' ? 'qr_code_scanner' : scanStatus === 'found' ? 'check_circle' : 'error'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {scanStatus === 'waiting' ? t('scanOrType') : scanStatus === 'found' ? t('addedToCart') : t('productNotFound')}
              </h3>
              {scanStatus === 'waiting' && (
                <p className="text-xs text-muted-foreground mt-1">{t('scanBarcodeHint')}</p>
              )}
            </div>

            {scanStatus === 'waiting' && (
              <div className="px-6 pb-4">
                <div className="flex items-center gap-2 bg-muted/40 border-2 border-primary/30 rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
                  <span className="material-symbols-outlined text-primary text-lg">qr_code_scanner</span>
                  <input
                    ref={barcodeRef}
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key !== 'Enter' || !barcodeInput.trim()) return;
                      const q = barcodeInput.trim().toLowerCase();
                      const found = products.find(p => p.batch.toLowerCase() === q || p.name.toLowerCase().includes(q) || p.id === q);
                      if (found) {
                        setScanStatus('found');
                        setScanResult(found);
                        const existingRow = rows.find(r => r.productId === found.id);
                        if (existingRow) {
                          updateRow(existingRow.id, 'qty', existingRow.qty + 1);
                        } else {
                          const emptyRow = rows.find(r => !r.productId);
                          if (emptyRow) {
                            setRows(prev => prev.map(r => r.id === emptyRow.id ? { ...r, productId: found.id, rate: found.pricePerBox, qty: 1, searchQuery: '' } : r));
                          } else {
                            setRows(prev => [...prev, { id: Date.now(), productId: found.id, qty: 1, rate: found.pricePerBox, searchQuery: '', showDropdown: false }]);
                          }
                        }
                        setTimeout(() => { setShowScanModal(false); toast.success(`${found.name} ${t('addedToCart')}`); }, 1200);
                      } else {
                        setScanStatus('notfound');
                        setTimeout(() => { setScanStatus('waiting'); setBarcodeInput(''); }, 1500);
                      }
                    }}
                    autoFocus
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                    placeholder={t('scanOrType')}
                  />
                </div>
              </div>
            )}

            {scanStatus === 'found' && scanResult && (
              <div className="px-6 pb-4">
                <div className="bg-muted/30 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm">
                    {scanResult.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{scanResult.name}</div>
                    <div className="text-[10px] text-muted-foreground">{scanResult.size} · {scanResult.finish}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">৳{scanResult.pricePerBox}</div>
                    <div className="text-[10px] text-muted-foreground">{scanResult.stock} {t('boxes')}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 pb-6">
              <button onClick={() => setShowScanModal(false)}
                className="w-full py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function generateQRSVG(data: string, size = 80): string {
  const hash = data.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  const grid = 11; const cellSize = size / grid;
  let rects = '';
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const isCornerPattern = (i < 3 && j < 3) || (i < 3 && j >= grid - 3) || (i >= grid - 3 && j < 3);
      const isCornerBorder = (i < 3 && j < 3) ? (i === 0 || i === 2 || j === 0 || j === 2 || (i === 1 && j === 1)) :
        (i < 3 && j >= grid - 3) ? (i === 0 || i === 2 || j === grid - 1 || j === grid - 3 || (i === 1 && j === grid - 2)) :
        (i >= grid - 3 && j < 3) ? (i === grid - 1 || i === grid - 3 || j === 0 || j === 2 || (i === grid - 2 && j === 1)) : false;
      const bit = isCornerPattern ? isCornerBorder : ((hash * (i * grid + j + 1) * 7919) % 100) > 45;
      if (bit) rects += `<rect x="${j * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="#2d3435"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/>${rects}</svg>`;
}
