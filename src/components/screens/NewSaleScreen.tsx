import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextInvoiceNumber, calcDiscount, numberToWords, type Product, type SaleRecord, type Customer, type CompanySettings } from "@/lib/store";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";
import QRCode from "qrcode";

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
  carton: number;
  piece: number;
  sqftInput: string; // user-entered sqft for auto-calc
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
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      String(p.pricePerBox).includes(q)
    );
  }, [products, debouncedQuery]);

  const handleSelect = (p: Product) => {
    onSelect(p.id);
    onUpdateSearch('');
    onToggleDropdown(false);
  };

  return (
    <div className="relative">
      {selectedProduct ? (
        <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-2 py-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{selectedProduct.name} <span className="text-muted-foreground font-normal">({selectedProduct.size})</span></div>
            <div className="text-[9px] text-muted-foreground">{selectedProduct.category || ''} · {selectedProduct.brand || ''} · ৳{selectedProduct.pricePerBox}</div>
          </div>
          <button onClick={() => { onSelect(''); onUpdateSearch(''); }}
            className="text-muted-foreground hover:text-destructive shrink-0">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button onClick={() => onToggleScan?.()} className="shrink-0 w-7 h-7 rounded bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20" title={t('scan')}>
            <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
          </button>
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">search</span>
            <input
              value={row.searchQuery}
              onChange={e => { onUpdateSearch(e.target.value); onToggleDropdown(true); }}
              onFocus={() => onToggleDropdown(true)}
              onBlur={() => setTimeout(() => onToggleDropdown(false), 200)}
              className="w-full bg-transparent border-b border-border text-xs py-1 pl-6 pr-1 outline-none focus:border-primary placeholder:text-muted-foreground/50"
              placeholder={t('searchProductPlaceholder')}
            />
          </div>
        </div>
      )}
      
      {row.showDropdown && !selectedProduct && (
        <div className="absolute top-full left-0 bg-card border border-border rounded-lg shadow-2xl mt-1 max-h-[260px] overflow-y-auto w-[350px]" style={{ zIndex: 9999 }}>
          {filtered.length > 0 ? filtered.map(p => (
            <button key={p.id} onMouseDown={() => handleSelect(p)}
              disabled={p.stock <= 0}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border/30 ${p.stock <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="w-7 text-[10px] text-muted-foreground font-mono shrink-0">{p.barcode || '—'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name} <span className="text-muted-foreground font-normal">({p.size})</span></div>
                  <div className="text-[10px] text-muted-foreground">{p.category || ''} · {p.brand || ''} · {p.finish}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-primary text-[11px]">৳{p.pricePerBox}</div>
                  <div className={`text-[9px] ${p.stock <= 20 ? 'text-destructive' : 'text-muted-foreground'}`}>{p.stock} {t('boxes')}</div>
                </div>
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
  const [rows, setRows] = useState<NewSaleRow[]>([{ id: Date.now(), productId: '', qty: 1, rate: 0, searchQuery: '', showDropdown: false, carton: 0, piece: 0, sqftInput: '' }]);
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

  const addRow = () => setRows(prev => [...prev, { id: Date.now(), productId: '', qty: 1, rate: 0, searchQuery: '', showDropdown: false, carton: 0, piece: 0, sqftInput: '' }]);
  const removeRow = (id: number) => setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: keyof NewSaleRow, value: string | number | boolean) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      const product = products.find(p => p.id === updated.productId);
      const piecesPerBox = product?.piecesPerBox || 4;
      const sqftPerBox = product?.sqftPerBox || 0;
      const sqftPerPiece = piecesPerBox > 0 ? sqftPerBox / piecesPerBox : 0;

      if (field === 'sqftInput') {
        // User entered sqft → auto-calculate cartons and pieces
        const totalSqft = parseFloat(String(value)) || 0;
        if (sqftPerBox > 0 && totalSqft > 0) {
          const totalBoxes = totalSqft / sqftPerBox;
          updated.carton = Math.floor(totalBoxes);
          const remainingSqft = totalSqft - (updated.carton * sqftPerBox);
          updated.piece = sqftPerPiece > 0 ? Math.round(remainingSqft / sqftPerPiece) : 0;
          // If pieces equal a full box, convert
          if (updated.piece >= piecesPerBox) {
            updated.carton += 1;
            updated.piece = 0;
          }
        } else {
          updated.carton = 0;
          updated.piece = 0;
        }
        updated.qty = updated.carton;
      } else if (field === 'carton' || field === 'piece') {
        // User changed carton/piece → update sqft display
        const ctn = field === 'carton' ? (Number(value) || 0) : updated.carton;
        const pc = field === 'piece' ? (Number(value) || 0) : updated.piece;
        const totalSqft = (ctn * sqftPerBox) + (pc * sqftPerPiece);
        updated.sqftInput = totalSqft > 0 ? totalSqft.toFixed(1) : '';
        updated.qty = ctn;
      }
      return updated;
    }));
  };
  const selectProduct = (rowId: number, productId: string) => {
    if (!productId) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, productId: '', rate: 0, carton: 0, piece: 0, sqftInput: '', qty: 0 } : r));
      return;
    }
    const p = products.find(x => x.id === productId);
    if (p) setRows(prev => prev.map(r => r.id === rowId ? { ...r, productId, rate: p.pricePerBox, qty: 1, carton: 1, piece: 0, sqftInput: '' } : r));
  };

  const handleBarcode = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return;
    const q = barcodeInput.trim().toLowerCase();
    const found = products.find(p => (p.barcode || '').toLowerCase() === q || p.batch.toLowerCase() === q || p.name.toLowerCase().includes(q) || p.id === q);
    if (found) {
      const existingRow = rows.find(r => r.productId === found.id);
      if (existingRow) {
        updateRow(existingRow.id, 'carton', existingRow.carton + 1);
      } else {
        const emptyRow = rows.find(r => !r.productId);
        if (emptyRow) {
          setRows(prev => prev.map(r => r.id === emptyRow.id ? { ...r, productId: found.id, rate: found.pricePerBox, qty: 1, carton: 1, piece: 0, sqftInput: '', searchQuery: '' } : r));
        } else {
          setRows(prev => [...prev, { id: Date.now(), productId: found.id, qty: 1, rate: found.pricePerBox, searchQuery: '', showDropdown: false, carton: 1, piece: 0, sqftInput: '' }]);
        }
      }
      toast.success(`${found.name} ${t('addedToCart')}`);
    } else {
      toast.error(t('productNotFound'));
    }
    setBarcodeInput('');
  };

  const subtotal = rows.reduce((sum, r) => {
    const product = products.find(p => p.id === r.productId);
    const piecesPerBox = product?.piecesPerBox || 4;
    const pricePerPiece = piecesPerBox > 0 ? r.rate / piecesPerBox : 0;
    return sum + (r.carton * r.rate) + (r.piece * pricePerPiece);
  }, 0);
  const discountVal = calcDiscount(subtotal, parseFloat(discount) || 0, discountType);
  const returnVal = parseFloat(returnAmt) || 0;
  const lessVal = parseFloat(lessAmt) || 0;
  const deliveryVal = parseFloat(delivery) || 0;
  const labourVal = parseFloat(labour) || 0;
  const total = Math.max(0, subtotal - discountVal - returnVal - lessVal + deliveryVal + labourVal);
  const paidVal = parseFloat(paidAmount) || 0;
  const dueVal = Math.max(0, total - paidVal);
  const balanceVal = dueVal; // balance = previous dues + current due (simplified)
  const receivedNum = parseFloat(received) || 0;
  const change = receivedNum > 0 && receivedNum >= total ? receivedNum - total : 0;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const bizInfoLine = [settings.phone, settings.address].filter(Boolean).join(' · ');

  const collectSaleData = (): { sale: SaleRecord; deductions: { productId: string; qty: number }[] } | null => {
    const items = rows.filter(r => r.productId && (r.carton > 0 || r.piece > 0) && r.rate > 0).map(r => {
      const p = products.find(x => x.id === r.productId);
      const ctn = r.carton;
      const piecesPerBox = p?.piecesPerBox || 4;
      const sqftPerPiece = piecesPerBox > 0 ? (p?.sqftPerBox || 0) / piecesPerBox : 0;
      const sqftQty = (ctn * (p?.sqftPerBox || 0)) + (r.piece * sqftPerPiece);
      const pricePerPiece = piecesPerBox > 0 ? r.rate / piecesPerBox : 0;
      const itemTotal = (ctn * r.rate) + (r.piece * pricePerPiece);
      return { productId: r.productId, name: p?.name || 'Custom Item', detail: p ? `${p.size} · ${p.finish}` : '', qty: ctn, price: r.rate, stock: p?.stock ?? 999, carton: ctn, piece: r.piece, sqftQty, category: p?.category || '', itemType: 'Sale' as const };
    });
    if (!items.length) { toast.error(t('addAtLeastOneItem')); return null; }
    const overStock = items.find(i => i.qty > i.stock);
    if (overStock) { toast.error(`${overStock.name}: ${t('qty')} ${overStock.qty} > ${t('stock')} ${overStock.stock}`); return null; }
    
    // Validate required fields
    if (!paidAmount && status !== 'credit') {
      toast.error('Paid amount is required! / পেইড এমাউন্ট দিন!');
      return null;
    }

    const inv = getNextInvoiceNumber(settings.invPrefix);
    const now = new Date();
    const autoStatus = paidVal >= total ? 'paid' : paidVal > 0 ? 'pending' : status === 'credit' ? 'credit' : 'pending';
    const sale: SaleRecord = {
      id: crypto.randomUUID(), invoice: inv, customer: customerName || t('walkInCustomer'),
      phone, address, items, subtotal, discount: discountVal, discountType, total,
      paymentMethod: payment, notes, status: autoStatus as SaleRecord['status'],
      date: now.toISOString(), time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      paid: paidVal, due: dueVal, delivery: deliveryVal, labour: labourVal, returnAmount: returnVal, lessAmount: lessVal, balance: balanceVal,
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
    setDelivery(''); setLabour(''); setPaidAmount(''); setReturnAmt(''); setLessAmt('');
    setRows([{ id: Date.now(), productId: '', qty: 1, rate: 0, searchQuery: '', showDropdown: false, carton: 0, piece: 0, sqftInput: '' }]);
    setRows([{ id: Date.now(), productId: '', qty: 1, rate: 0, searchQuery: '', showDropdown: false, carton: 0, piece: 0, sqftInput: '' }]);
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

  const handleSaveAndPDF = async () => {
    const data = collectSaleData(); if (!data) return;
    commitSale(data.sale, data.deductions);
    await generatePDF(data.sale);
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
  const generatePrintHTML = async (sale: SaleRecord) => {
    const qrDataURL = await generateQRDataURL(`${sale.invoice}-${sale.total}`);
    const qrImg = qrDataURL ? `<img src="${qrDataURL}" width="80" height="80" style="image-rendering:pixelated"/>` : '';
    const printDateStr = (() => { try { const d = new Date(sale.date); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; } catch { return sale.date; } })();
    const totalQty = sale.items.reduce((s, i) => s + (i.sqftQty ?? i.qty), 0);
    const dueInBill = sale.due ?? 0;
    const prevDues = sale.previousDues ?? 0;
    const bal = sale.balance ?? dueInBill;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sale.invoice}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI','Noto Sans Bengali',Arial,sans-serif;color:#222;font-size:12px;background:#fff}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm 16mm 10mm}
.header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:8px;border-bottom:2px solid #222;margin-bottom:6px}
.header-left .logo-box{width:70px;height:70px;background:#005cc1;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:28px}
.header-center{flex:1;text-align:center}
.header-center .cn{font-size:28px;font-weight:900;line-height:1.1}
.header-center .sub{font-size:11px;color:#555;margin-top:3px}
.bill-title{text-align:center;font-size:20px;font-weight:900;margin:8px 0;letter-spacing:2px;text-decoration:underline;text-underline-offset:4px}
.info-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;line-height:1.6}
.info-row .field{display:flex;gap:4px}
.info-row .lbl{min-width:70px}
.info-row .val{font-weight:700}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
thead tr{background:#c0392b;color:#fff}
th{font-size:10.5px;font-weight:700;text-transform:uppercase;padding:8px 6px;text-align:left;white-space:nowrap}
th.r{text-align:right}
td{padding:6px;font-size:11px;border-bottom:1px solid #ddd}
td.r{text-align:right}td.b{font-weight:700}
tbody tr:nth-child(even){background:#fafafa}
.bottom{display:flex;justify-content:space-between;margin-top:6px;gap:20px}
.due-box{border:2px solid #333;border-radius:4px;padding:8px 14px;font-size:11.5px;min-width:210px}
.due-box .dr{display:flex;justify-content:space-between;margin-bottom:3px}
.due-box .dv{font-weight:900;min-width:80px;text-align:right}
.sb{min-width:220px}
.sr{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
.sr .sv{font-weight:700;min-width:80px;text-align:right}
.sr.pay{font-size:20px;font-weight:900;border-top:2px solid #222;border-bottom:2px solid #222;padding:6px 0;margin-top:4px}
.remark{font-size:11px;margin-top:8px;line-height:1.5}
.remark .iw{color:#005cc1;font-weight:700}
.sig-row{display:flex;justify-content:space-between;margin-top:55px;font-size:13px;font-weight:700}
.sig-row .sig{border-top:1px solid #999;padding-top:6px;text-align:center;min-width:180px;color:#005cc1}
.disclaimer{text-align:center;margin-top:18px;font-size:12px;color:#c0392b;font-weight:700;border-top:1px solid #eee;padding-top:6px}
.fl{text-align:center;font-size:9px;color:#999;margin-top:6px}
@media print{@page{size:A4;margin:0}.page{padding:10mm 14mm}}
</style></head><body>
<div class="page">
<div class="header">
  <div class="header-left"><div class="logo-box">${settings.name.slice(0,3).toUpperCase()}</div></div>
  <div class="header-center">
    <div class="cn">${settings.name.toUpperCase()}</div>
    ${settings.address ? `<div class="sub">${settings.address}</div>` : ''}
    ${settings.phone ? `<div class="sub">Phone# ${settings.phone}</div>` : ''}
    ${settings.email ? `<div class="sub">${settings.email}</div>` : ''}
  </div>
  <div>${qrImg}</div>
</div>
<div class="bill-title">BILL-INVOICE</div>
<div class="info-row">
  <div>
    <div class="field"><span class="lbl">Name</span><span>:</span><span class="val">${sale.customer}</span></div>
    ${sale.address ? `<div class="field"><span class="lbl">Address</span><span>:</span><span class="val">${sale.address}</span></div>` : ''}
    ${sale.phone ? `<div class="field"><span class="lbl">Mobile</span><span>:</span><span class="val">${sale.phone}</span></div>` : ''}
  </div>
  <div style="text-align:right">
    <div class="field" style="justify-content:flex-end"><span class="lbl">Invoice#</span><span>:</span><span class="val">${sale.invoice}</span></div>
    <div class="field" style="justify-content:flex-end"><span class="lbl">Date</span><span>:</span><span class="val">${printDateStr}</span></div>
    <div class="field" style="justify-content:flex-end"><span class="lbl">Sold By</span><span>:</span><span class="val">${settings.userName || settings.name}</span></div>
  </div>
</div>
<table>
<thead><tr><th>SN</th><th>TYPE</th><th>CARTON/PIECE</th><th>CATEGORY</th><th>PRODUCT NAME</th><th class="r">SQFT./QTY.</th><th class="r">PRICE</th><th class="r">SUB TOTAL</th></tr></thead>
<tbody>${sale.items.map((item, idx) => {
  const p = products.find(x => x.id === item.productId);
  return `<tr><td>${idx+1}</td><td>Sale</td><td>${item.carton ?? item.qty} Carton ${item.piece ?? 0} Piece</td><td>${item.category || p?.category || '-'}</td><td class="b">${item.name}${p ? ` (Size: ${p.size})` : ''}</td><td class="r">${Number(item.sqftQty ?? (item.qty * (p?.sqftPerBox || 1))).toFixed(2)}</td><td class="r">${item.price}</td><td class="r b">${item.price * item.qty}</td></tr>`;
}).join('')}</tbody>
</table>
<div class="bottom">
  <div>
    <div class="due-box">
      <div class="dr"><span>Due In This Bill:</span><span class="dv">${dueInBill}/-</span></div>
      <div class="dr"><span>Previous Dues:</span><span class="dv">${prevDues}/-</span></div>
      <div class="dr"><span>Balance:</span><span class="dv">${bal}/-</span></div>
    </div>
    <div class="remark">
      <div><strong>Remark:</strong> ${sale.notes || ''}</div>
      <div><strong>Total Quantity:</strong> ${totalQty}</div>
      <div>In Word: <span class="iw">${numberToWords(sale.total)}</span></div>
    </div>
  </div>
  <div class="sb">
    <div class="sr"><span>Total:</span><span class="sv">${sale.subtotal}</span></div>
    ${(sale.returnAmount ?? 0) > 0 ? `<div class="sr"><span>Return:</span><span class="sv">-${sale.returnAmount}</span></div>` : ''}
    ${sale.discount > 0 ? `<div class="sr"><span>Discount:</span><span class="sv">-${sale.discount}</span></div>` : ''}
    ${(sale.lessAmount ?? 0) > 0 ? `<div class="sr"><span>Less:</span><span class="sv">-${sale.lessAmount}</span></div>` : ''}
    ${(sale.labour ?? 0) > 0 ? `<div class="sr"><span>Labour:</span><span class="sv">${sale.labour}</span></div>` : ''}
    <div class="sr pay"><span>PAYABLE:</span><span class="sv">${sale.total}</span></div>
    <div class="sr"><span>Paid:</span><span class="sv">${sale.paid ?? sale.total}</span></div>
  </div>
</div>
<div class="sig-row"><div class="sig">Customer Signature</div><div class="sig">Authorized Signature</div></div>
<div class="disclaimer">বিক্রিত মাল ১ মাসের মধ্যে ফেরত নেওয়া হয়।চায়না/ইন্ডিয়ান মাল ফেরত নেওয়া হয় না।</div>
<div class="fl">SOFTWARE: ${settings.name} | Printing @: ${new Date().toLocaleString()}</div>
</div>
</body></html>`;
  };

  const handlePrintSale = async (sale: SaleRecord) => {
    const html = await generatePrintHTML(sale);
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) { toast.error(t('popupBlocked')); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
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

  const generatePDF = async (sale: SaleRecord) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210;
    let y = 20;

    doc.setFillColor(0, 92, 193);
    doc.roundedRect(15, y - 4, 12, 12, 2, 2, 'F');
    doc.setTextColor(255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(settings.name.slice(0, 2).toUpperCase(), 21, y + 3, { align: 'center' });
    doc.setTextColor(45, 52, 53); doc.setFontSize(16); doc.text(settings.name, 30, y + 1);
    if (bizInfoLine) { doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(bizInfoLine, 30, y + 6); }

    // QR Code
    try {
      const qrUrl = await QRCode.toDataURL(`${sale.invoice}-${sale.total}`, { width: 80, margin: 1 });
      doc.addImage(qrUrl, 'PNG', pw - 33, y - 4, 16, 16);
    } catch {}

    doc.setFontSize(8); doc.setTextColor(90, 96, 97);
    doc.text('INVOICE / CHALLAN', pw - 15, y + 16, { align: 'right' });
    doc.setFontSize(12); doc.setTextColor(0, 92, 193); doc.setFont('helvetica', 'bold');
    doc.text(sale.invoice, pw - 15, y + 22, { align: 'right' });
    doc.setFontSize(8); doc.setTextColor(90, 96, 97); doc.setFont('helvetica', 'normal');
    doc.text(`${dateStr} · ${sale.time}`, pw - 15, y + 27, { align: 'right' });

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

        {/* ── Invoice Header: Logo | Company Info | QR Code ── */}
        <div className="px-6 sm:px-10 pt-6 sm:pt-8 pb-3 border-b-2 border-foreground">
          <div className="flex items-start justify-between">
            {/* Left: Logo */}
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-black text-xl shrink-0">
              {settings.name.slice(0, 3).toUpperCase()}
            </div>
            {/* Center: Company Info */}
            <div className="flex-1 text-center px-3">
              <div className="text-2xl sm:text-3xl font-black tracking-wide leading-tight text-foreground">{settings.name.toUpperCase()}</div>
              {settings.address && <div className="text-[11px] text-muted-foreground mt-0.5">{settings.address}</div>}
              {settings.phone && <div className="text-[11px] text-muted-foreground">Phone# {settings.phone}</div>}
              {settings.email && <div className="text-[10px] text-muted-foreground">{settings.email}</div>}
            </div>
            {/* Right: QR Code */}
            <div className="shrink-0">
              <QRCodeSVG data={`${settings.name}-${settings.phone || ''}-${dateStr}`} size={64} />
            </div>
          </div>
        </div>

        {/* ── BILL-INVOICE Title ── */}
        <div className="text-center font-black text-lg tracking-[3px] py-2 underline underline-offset-4">BILL-INVOICE</div>

        {/* ── Editable Customer Fields (hidden inputs inside info area) ── */}
        <div className="px-6 sm:px-10 pb-3">
          <div className="flex justify-between text-xs">
            <div className="space-y-1 flex-1 max-w-[55%]">
              <div className="flex items-center gap-1">
                <span className="w-16 text-muted-foreground shrink-0">Name</span><span>:</span>
                <div className="relative flex-1">
                  <input value={customerName}
                    onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="w-full bg-transparent border-b border-border text-sm font-bold py-0.5 focus:border-primary outline-none placeholder:text-muted-foreground/40"
                    placeholder={t('customerNameReq')} />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-lg shadow-xl z-[100] mt-1 max-h-[160px] overflow-y-auto">
                      {suggestions.map(c => (
                        <button key={c.id} onMouseDown={() => selectCustomer(c)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex justify-between">
                          <span className="font-medium">{c.name}</span><span className="text-muted-foreground">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-16 text-muted-foreground shrink-0">Address</span><span>:</span>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="flex-1 bg-transparent border-b border-border text-sm font-bold py-0.5 focus:border-primary outline-none placeholder:text-muted-foreground/40"
                  placeholder="Address (optional)" />
              </div>
              <div className="flex items-center gap-1">
                <span className="w-16 text-muted-foreground shrink-0">Mobile</span><span>:</span>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  className="flex-1 bg-transparent border-b border-border text-sm font-bold py-0.5 focus:border-primary outline-none placeholder:text-muted-foreground/40"
                  placeholder="Phone (optional)" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="flex gap-1 justify-end"><span className="text-muted-foreground">Invoice#</span><span>:</span><strong className="text-primary">#NEW</strong></div>
              <div className="flex gap-1 justify-end"><span className="text-muted-foreground">Date</span><span>:</span><strong>{dateStr}</strong></div>
              <div className="flex gap-1 justify-end"><span className="text-muted-foreground">Sold By</span><span>:</span><strong>{settings.userName || settings.name}</strong></div>
            </div>
          </div>
        </div>

        {/* ── Items Table (editable with searchable picker) ── */}
        <div className="px-4 sm:px-8 py-5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{t('saleItems')}</div>

          {/* Scrollable table */}
          <div className="overflow-visible">
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">shopping_cart</span>
              {t('saleItems')} ({rows.filter(r => r.productId).length} items)
            </div>
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-[9px] font-bold text-white uppercase tracking-wider" style={{ background: 'hsl(var(--destructive))' }}>
                  <th className="py-2 px-2 text-left w-8">SN</th>
                  <th className="py-2 px-2 text-left w-10">Type</th>
                  <th className="py-2 px-2 text-left w-28">Carton/Piece</th>
                  <th className="py-2 px-2 text-left w-16">Category</th>
                  <th className="py-2 px-2 text-left">Product Name</th>
                  <th className="py-2 px-2 text-right w-20">Sqft/Qty</th>
                  <th className="py-2 px-2 text-right w-16">Price</th>
                  <th className="py-2 px-2 text-right w-20">Sub Total</th>
                  <th className="py-2 px-1 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const product = products.find(p => p.id === row.productId);
                  const piecesPerBox = product?.piecesPerBox || 4;
                  const sqftPerPiece = piecesPerBox > 0 ? (product?.sqftPerBox || 0) / piecesPerBox : 0;
                  const sqftQty = (row.carton * (product?.sqftPerBox || 0)) + (row.piece * sqftPerPiece);
                  const pricePerPiece = piecesPerBox > 0 ? row.rate / piecesPerBox : 0;
                  const rowTotal = (row.carton * row.rate) + (row.piece * pricePerPiece);
                  return (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors align-top">
                      <td className="py-2 px-2 text-xs font-semibold text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-2 text-[10px] text-muted-foreground">Sale</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-0.5">
                          <input type="number" min={0} value={row.carton || ''} onChange={e => updateRow(row.id, 'carton', parseInt(e.target.value) || 0)}
                            className="w-10 bg-muted/30 border border-border rounded text-xs py-1 text-center outline-none focus:border-primary" placeholder="0" />
                          <span className="text-[8px] text-muted-foreground">Ctn</span>
                          <input type="number" min={0} value={row.piece || ''} onChange={e => updateRow(row.id, 'piece', parseInt(e.target.value) || 0)}
                            className="w-10 bg-muted/30 border border-border rounded text-xs py-1 text-center outline-none focus:border-primary" placeholder="0" />
                          <span className="text-[8px] text-muted-foreground">Pc</span>
                        </div>
                        {product && <div className="text-[8px] text-muted-foreground mt-0.5">{piecesPerBox} pcs/box</div>}
                      </td>
                      <td className="py-2 px-2 text-[10px] text-muted-foreground">{product?.category || '-'}</td>
                      <td className="py-2 px-2 relative">
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
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min={0} step="0.1" value={row.sqftInput} onChange={e => updateRow(row.id, 'sqftInput', e.target.value)}
                          className="w-16 bg-[hsl(200,100%,96%)] border border-[hsl(200,60%,70%)] rounded text-xs py-1 text-center outline-none focus:border-primary" placeholder="sqft" />
                        {sqftQty > 0 && <div className="text-[8px] text-muted-foreground text-center mt-0.5">{sqftQty.toFixed(1)} sqft</div>}
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={row.rate || ''} onChange={e => updateRow(row.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-muted/30 border border-border rounded text-xs py-1 text-right outline-none focus:border-primary px-1" />
                        {product && piecesPerBox > 0 && <div className="text-[8px] text-muted-foreground text-right mt-0.5">৳{Math.round(row.rate / piecesPerBox)}/pc</div>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="text-xs font-bold text-foreground">{formatCurrency(Math.round(rowTotal))}</span>
                      </td>
                      <td className="py-2 px-1">
                        <button onClick={() => removeRow(row.id)} className="w-5 h-5 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button onClick={addRow}
            className="mt-3 w-full py-2 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">add</span>{t('addItem')}
          </button>
        </div>

        {/* ── Payment & Status Row ── */}
        <div className="px-8 sm:px-12 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">{t('paymentMethod')}</label>
              <select value={payment} onChange={e => setPayment(e.target.value)}
                className="w-full bg-muted/30 border border-border rounded text-xs py-1.5 px-2 outline-none focus:ring-1 focus:ring-ring">
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
                className="w-full bg-muted/30 border border-border rounded text-xs py-1.5 px-2 outline-none focus:ring-1 focus:ring-ring">
                <option value="paid">{t('paid')}</option>
                <option value="pending">{t('pending')}</option>
                <option value="credit">{t('credit')}</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">{t('discount')}</label>
              <div className="flex gap-1">
                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                  className="w-full bg-muted/30 border border-border rounded text-xs py-1.5 px-2 text-right outline-none focus:ring-1 focus:ring-ring" />
                <select value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percent')}
                  className="bg-muted/30 border border-border rounded text-[10px] py-1 px-1 outline-none">
                  <option value="flat">৳</option><option value="percent">%</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">{t('notes')}</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full bg-muted/30 border border-border rounded text-xs py-1.5 px-2 outline-none focus:ring-1 focus:ring-ring" placeholder="..." />
            </div>
          </div>
        </div>

        {/* ── Bottom 2-Column: Due Box (Left) + Totals (Right) ── */}
        <div className="px-8 sm:px-12 pb-4">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* LEFT COLUMN: Due Box + Remark + Quantity + In Word */}
            <div className="flex-1 space-y-3">
              {/* Due Box */}
              <div className="border-2 border-foreground rounded p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold">Due In This Bill:</span>
                  <span className="font-black min-w-[80px] text-right">{Math.round(dueVal)}/-</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Previous Dues:</span>
                  <span className="font-black min-w-[80px] text-right">0/-</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Balance:</span>
                  <span className="font-black min-w-[80px] text-right">{Math.round(balanceVal)}/-</span>
                </div>
              </div>

              {/* Remark */}
              <div className="text-xs">
                <span className="font-bold">Remark:</span> <span className="text-muted-foreground">{notes || ''}</span>
              </div>

              {/* Total Quantity */}
              <div className="text-xs">
                <span className="font-bold">Total Quantity:</span>{' '}
                <span>{rows.reduce((sum, r) => {
                  const product = products.find(p => p.id === r.productId);
                  const sqftPerBox = product?.sqftPerBox || 0;
                  const piecesPerBox = product?.piecesPerBox || 4;
                  const sqftPerPiece = piecesPerBox > 0 ? sqftPerBox / piecesPerBox : 0;
                  return sum + (r.carton * sqftPerBox) + (r.piece * sqftPerPiece);
                }, 0).toFixed(1)}</span>
              </div>

              {/* In Word */}
              <div className="text-xs">
                <span className="font-bold">In Word:</span>{' '}
                <span className="text-primary font-bold">{numberToWords(total)}</span>
              </div>
            </div>

            {/* RIGHT COLUMN: Total, Labour, PAYABLE, Paid */}
            <div className="w-full sm:w-56 space-y-1.5 text-xs">
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">{t('subtotal')}</span>
                <span className="font-semibold">{Math.round(subtotal)}</span>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between py-0.5 text-destructive">
                  <span>{t('discount')}</span>
                  <span>-{Math.round(discountVal)}</span>
                </div>
              )}
              {returnVal > 0 && (
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Return</span>
                  <span>-{Math.round(returnVal)}</span>
                </div>
              )}
              {lessVal > 0 && (
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Less</span>
                  <span>-{Math.round(lessVal)}</span>
                </div>
              )}
              {deliveryVal > 0 && (
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">{t('delivery')}</span>
                  <span>+{Math.round(deliveryVal)}</span>
                </div>
              )}

              {/* Labour input */}
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">{t('labour')}</span>
                <input type="number" value={labour} onChange={e => setLabour(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>

              {/* PAYABLE - prominent */}
              <div className="flex justify-between items-center py-2 border-t-2 border-b-2 border-foreground my-1">
                <span className="text-lg font-black">PAYABLE:</span>
                <span className="text-lg font-black text-primary">{Math.round(total)}</span>
              </div>

              {/* Paid input */}
              <div className="flex justify-between items-center py-0.5">
                <span className="font-bold">{t('paid')}</span>
                <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0"
                  className="w-20 bg-[hsl(125,100%,95%)] border border-[hsl(125,60%,70%)] rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-[hsl(125,60%,50%)] font-bold" />
              </div>

              {/* Return / Less / Delivery / Received inputs */}
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">Return</span>
                <input type="number" value={returnAmt} onChange={e => setReturnAmt(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">Less</span>
                <input type="number" value={lessAmt} onChange={e => setLessAmt(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">{t('delivery')}</span>
                <input type="number" value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-muted-foreground">{t('amountReceived')}</span>
                <input type="number" value={received} onChange={e => setReceived(e.target.value)} placeholder="0"
                  className="w-20 bg-muted/30 border border-border rounded text-xs py-1 px-1.5 text-right outline-none focus:ring-1 focus:ring-ring" />
              </div>
              {change > 0 && <div className="flex justify-between text-xs font-bold text-[hsl(142,70%,35%)]"><span>{t('change')}</span><span>{formatCurrency(change)}</span></div>}
              <div className="flex justify-end">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeClass}`}>
                  {statusLabels[status] || status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Signatures ── */}
        <div className="px-8 sm:px-12 pb-2">
          <div className="flex justify-between mt-12 pt-2">
            <div className="text-center min-w-[150px]">
              <div className="border-t border-muted-foreground pt-1.5 text-xs font-bold text-primary">Customer Signature</div>
            </div>
            <div className="text-center min-w-[150px]">
              <div className="border-t border-muted-foreground pt-1.5 text-xs font-bold text-primary">Authorized Signature</div>
            </div>
          </div>
        </div>

        {/* ── Disclaimer & Footer ── */}
        <div className="px-8 sm:px-12 py-3 border-t border-border mt-auto">
          <div className="text-center text-[11px] font-bold text-destructive mb-1">
            বিক্রিত মাল ১ মাসের মধ্যে ফেরত নেওয়া হয়। চায়না/ইন্ডিয়ান মাল ফেরত নেওয়া হয় না।
          </div>
          <div className="text-center text-[9px] text-muted-foreground">
            SOFTWARE: {settings.name} | Printing @: {new Date().toLocaleString()}
          </div>
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
                            setRows(prev => [...prev, { id: Date.now(), productId: found.id, qty: 1, rate: found.pricePerBox, searchQuery: '', showDropdown: false, carton: 0, piece: 0, sqftInput: '' }]);
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

// Real QR Code component using qrcode library
function QRCodeSVG({ data, size = 80 }: { data: string; size?: number }) {
  const [svgUrl, setSvgUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(data || 'N/A', { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => setSvgUrl(url))
      .catch(() => setSvgUrl(''));
  }, [data, size]);
  if (!svgUrl) return <div style={{ width: size, height: size, background: '#f0f0f0', borderRadius: 4 }} />;
  return <img src={svgUrl} alt="QR Code" width={size} height={size} style={{ imageRendering: 'pixelated' }} />;
}

// Generate QR code data URL synchronously-ish for print HTML
async function generateQRDataURL(data: string, size = 80): Promise<string> {
  try {
    return await QRCode.toDataURL(data || 'N/A', { width: size, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    return '';
  }
}
