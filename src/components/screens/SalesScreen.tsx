import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextInvoiceNumber, downloadCSV, calcDiscount, numberToWords, type CartItem, type Product, type SaleRecord, type Customer, type CompanySettings } from "@/lib/store";
import { toast } from "sonner";
import InvoiceModal from "@/components/InvoiceModal";
import ComboInput from "@/components/ComboInput";
import jsPDF from "jspdf";
import "jspdf-autotable";
import QRCode from "qrcode";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface SalesScreenProps {
  products: Product[];
  customers: Customer[];
  sales: SaleRecord[];
  settings: CompanySettings;
  onSaleComplete: (sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => void;
  onDeleteSale: (id: string) => void;
  onAutoAddCustomer: (name: string, phone: string, address: string) => void;
  companyName: string;
  companyPhone?: string;
  companyAddress?: string;
  onNavigate: (screen: string) => void;
}

// ── Add Sale Item Row ──
interface SaleItemRow {
  id: number;
  productId: string;
  barcode: string;
  name: string;
  stock: number;
  itemType: string;
  carton: number;
  piece: number;
  sqftQty: number;
  salesRate: number;
  subTotal: number;
}

const PAGE_SIZES = [10, 25, 50, 100];
type SortField = 'invoice' | 'date' | 'customer' | 'total' | 'paid' | 'due';

export default function SalesScreen({ products, customers, sales, settings, onSaleComplete, onDeleteSale, onAutoAddCustomer, companyName, companyPhone, companyAddress, onNavigate }: SalesScreenProps) {
  const { t } = useI18n();

  // ── View toggle ──
  const [view, setView] = useState<'history' | 'add'>('history');

  // ══════ HISTORY VIEW STATE ══════
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [viewSale, setViewSale] = useState<SaleRecord | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ══════ ADD SALE STATE ══════
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [manualCarton, setManualCarton] = useState(0);
  const [manualPiece, setManualPiece] = useState(0);
  const [manualSqft, setManualSqft] = useState(0);
  const [manualRate, setManualRate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('percent');
  const [delivery, setDelivery] = useState('');
  const [labourCost, setLabourCost] = useState('');
  const [returnAmt, setReturnAmt] = useState('');
  const [lessAmt, setLessAmt] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [saleStatus, setSaleStatus] = useState('Complete');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Sort helpers ──
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };
  const sortIcon = (field: SortField) => sortField === field ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';

  // ── History data ──
  const debouncedSearch = useDebounce(search, 250);
  const filtered = useMemo(() => {
    const list = sales.filter(s =>
      s.invoice.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      s.customer.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (s.phone || '').includes(debouncedSearch)
    );
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'invoice') cmp = a.invoice.localeCompare(b.invoice);
      else if (sortField === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === 'customer') cmp = a.customer.localeCompare(b.customer);
      else if (sortField === 'total') cmp = a.total - b.total;
      else if (sortField === 'paid') cmp = (a.paid ?? a.total) - (b.paid ?? b.total);
      else if (sortField === 'due') cmp = (a.due ?? 0) - (b.due ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [sales, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => filtered.slice(page * pageSize, (page + 1) * pageSize), [filtered, page, pageSize]);

  // ── Add Sale: product search (show all, filter on search) ──
  const debouncedProductSearch = useDebounce(productSearch, 200);
  const displayProducts = useMemo(() => {
    if (!debouncedProductSearch) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
      p.batch.toLowerCase().includes(debouncedProductSearch.toLowerCase())
    );
  }, [products, debouncedProductSearch]);

  const addProductToItems = (product: Product, carton?: number, piece?: number, sqft?: number, rate?: number) => {
    if (items.find(i => i.productId === product.id)) {
      toast.error('Already added');
      return;
    }
    const c = carton ?? 1;
    const pc = piece ?? 0;
    const sr = rate ?? product.pricePerBox;
    const piecesPerBox = product.piecesPerBox || 4;
    const sqftPerBox = product.sqftPerBox || 0;
    const pricePerPiece = piecesPerBox > 0 ? sr / piecesPerBox : 0;
    // Auto-calculate sqft from carton + piece
    let autoSqft = sqft ?? 0;
    if (sqftPerBox > 0 && piecesPerBox > 0 && autoSqft === 0) {
      const sqftPerPiece = sqftPerBox / piecesPerBox;
      autoSqft = (c * sqftPerBox) + (pc * sqftPerPiece);
    }
    const sub = (c * sr) + (pc * pricePerPiece);
    setItems(prev => [...prev, {
      id: Date.now(), productId: product.id, barcode: product.barcode || product.batch || '',
      name: product.name, stock: product.stock, itemType: 'Sale',
      carton: c, piece: pc, sqftQty: autoSqft, salesRate: sr, subTotal: sub,
    }]);
  };

  const manualAddProduct = () => {
    if (!selectedProductId) { toast.error('Search & select a product first'); return; }
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    addProductToItems(product, manualCarton, manualPiece, manualSqft, parseFloat(manualRate) || product.pricePerBox);
    setSelectedProductId(null);
    setProductSearch('');
    setManualCarton(0); setManualPiece(0); setManualSqft(0); setManualRate('');
  };

  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id: number, field: keyof SaleItemRow, value: number | string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      const product = products.find(p => p.id === item.productId);
      const piecesPerBox = product?.piecesPerBox || 4;
      const sqftPerBox = product?.sqftPerBox || 0;
      const pricePerPiece = piecesPerBox > 0 ? updated.salesRate / piecesPerBox : 0;
      // Auto-calculate sqft from carton + piece
      if (sqftPerBox > 0 && piecesPerBox > 0) {
        const sqftPerPiece = sqftPerBox / piecesPerBox;
        updated.sqftQty = (updated.carton * sqftPerBox) + (updated.piece * sqftPerPiece);
      }
      updated.subTotal = (updated.carton * updated.salesRate) + (updated.piece * pricePerPiece);
      return updated;
    }));
  };

  // ── Calculations ──
  const total = items.reduce((s, i) => s + i.subTotal, 0);
  const returnVal = parseFloat(returnAmt) || 0;
  const discountVal = discountType === 'percent' ? Math.round(total * (parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
  const lessVal = parseFloat(lessAmt) || 0;
  const deliveryVal = parseFloat(delivery) || 0;
  const labourVal = parseFloat(labourCost) || 0;
  const payable = Math.max(0, total - returnVal - discountVal - lessVal + deliveryVal + labourVal);
  const paidVal = parseFloat(paidAmount) || 0;
  const dueVal = Math.max(0, payable - paidVal);
  // Previous dues from customer
  const selectedCustomer = customers.find(c => c.name === customerName);
  const prevDues = selectedCustomer?.totalDue || 0;
  const balanceVal = dueVal + prevDues;

  const openAddSale = () => {
    setView('add');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setCustomerName(''); setPhone(''); setAddress('');
    setItems([]); setDiscount(''); setDelivery(''); setPaidAmount('');
    setRemark(''); setSaleStatus('Complete'); setPaymentMode('Cash');
    setReturnAmt(''); setLessAmt(''); setLabourCost('');
  };

  const handleSave = () => {
    if (!items.length) { toast.error('কমপক্ষে একটি প্রোডাক্ট যোগ করুন'); return; }
    if (!paidAmount && saleStatus !== 'Credit') { toast.error('Paid amount দিন!'); return; }

    const inv = getNextInvoiceNumber(settings.invPrefix);
    const now = new Date(saleDate);
    const autoStatus = paidVal >= payable ? 'paid' : paidVal > 0 ? 'pending' : 'credit';

    const saleItems = items.map(i => {
      const p = products.find(x => x.id === i.productId);
      return {
        productId: i.productId, name: i.name, detail: p ? `${p.size} · ${p.finish}` : '',
        qty: i.carton, price: i.salesRate, carton: i.carton, piece: i.piece,
        sqftQty: i.sqftQty, category: p?.category || '', itemType: 'Sale' as const,
      };
    });

    const sale: SaleRecord = {
      id: crypto.randomUUID(), invoice: inv, customer: customerName || t('walkInCustomer'),
      phone, address, items: saleItems, subtotal: total, discount: discountVal,
      discountType, total: payable, paymentMethod: paymentMode.toLowerCase(),
      notes: remark, status: autoStatus as SaleRecord['status'],
      date: now.toISOString(), time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      paid: paidVal, due: dueVal, delivery: deliveryVal, returnAmount: returnVal,
      lessAmount: lessVal, balance: balanceVal, labour: labourVal,
      previousDues: prevDues, soldBy: settings.userName || '',
    };

    onSaleComplete(sale, items.map(i => ({ productId: i.productId, qty: i.carton })));
    if (customerName && !customers.find(c => c.name === customerName)) {
      onAutoAddCustomer(customerName, phone, address);
    }
    toast.success(`Sale saved: ${inv}`);
    setView('history');
  };

  const reopenInvoice = (s: SaleRecord) => { setViewSale(s); setShowInvoice(true); };
  const confirmDelete = () => {
    if (showDeleteConfirm) { onDeleteSale(showDeleteConfirm); toast.success('Sale deleted'); }
    setShowDeleteConfirm(null);
  };

  const exportCSV = () => {
    const rows = [['Invoice', 'Date', 'Type', 'Customer', 'Mobile', 'Total', 'Return', 'Discount', 'Less', 'Paid', 'Due'],
      ...sales.map(s => [s.invoice, s.date, s.customerType || 'Listed', s.customer, s.phone || '', String(s.total), String(s.returnAmount ?? 0), String(s.discount), String(s.lessAmount ?? 0), String(s.paid ?? s.total), String(s.due ?? 0)])
    ];
    downloadCSV(rows, 'sales_export.csv');
    toast.success('CSV exported');
  };

  // Print sale
  const handlePrintSale = async (sale: SaleRecord) => {
    const bizInfoLine = [settings.phone, settings.address].filter(Boolean).join(' · ');
    const qrDataURL = await generateQRDataURL(`${sale.invoice}-${sale.total}`);
    const qrImg = qrDataURL ? `<img src="${qrDataURL}" width="80" height="80" style="image-rendering:pixelated"/>` : '';
    const printDateStr = (() => { try { const d = new Date(sale.date); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; } catch { return sale.date; } })();
    const totalQty = sale.items.reduce((s, i) => s + (i.sqftQty ?? i.qty), 0);
    const dueInBill = sale.due ?? 0;
    const bal = sale.balance ?? dueInBill;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sale.invoice}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;font-size:12px;background:#fff}.page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm 16mm 10mm}.header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:8px;border-bottom:2px solid #222;margin-bottom:6px}.header-left .logo-box{width:70px;height:70px;background:#005cc1;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:28px}.header-center{flex:1;text-align:center}.header-center .cn{font-size:28px;font-weight:900;line-height:1.1}.header-center .sub{font-size:11px;color:#555;margin-top:3px}.bill-title{text-align:center;font-size:20px;font-weight:900;margin:8px 0;letter-spacing:2px;text-decoration:underline;text-underline-offset:4px}.info-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;line-height:1.6}.info-row .field{display:flex;gap:4px}.info-row .lbl{min-width:70px}.info-row .val{font-weight:700}table{width:100%;border-collapse:collapse;margin-bottom:8px}thead tr{background:#c0392b;color:#fff}th{font-size:10.5px;font-weight:700;text-transform:uppercase;padding:8px 6px;text-align:left;white-space:nowrap}th.r{text-align:right}td{padding:6px;font-size:11px;border-bottom:1px solid #ddd}td.r{text-align:right}td.b{font-weight:700}tbody tr:nth-child(even){background:#fafafa}.bottom{display:flex;justify-content:space-between;margin-top:6px;gap:20px}.sb{min-width:220px}.sr{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}.sr .sv{font-weight:700;min-width:80px;text-align:right}.sr.pay{font-size:20px;font-weight:900;border-top:2px solid #222;border-bottom:2px solid #222;padding:6px 0;margin-top:4px}.sig-row{display:flex;justify-content:space-between;margin-top:55px;font-size:13px;font-weight:700}.sig-row .sig{border-top:1px solid #999;padding-top:6px;text-align:center;min-width:180px;color:#005cc1}.disclaimer{text-align:center;margin-top:18px;font-size:12px;color:#c0392b;font-weight:700;border-top:1px solid #eee;padding-top:6px}@media print{@page{size:A4;margin:0}.page{padding:10mm 14mm}}</style></head><body>
<div class="page">
<div class="header"><div class="header-left"><div class="logo-box">${settings.name.slice(0,3).toUpperCase()}</div></div><div class="header-center"><div class="cn">${settings.name.toUpperCase()}</div>${settings.address ? `<div class="sub">${settings.address}</div>` : ''}${settings.phone ? `<div class="sub">Phone# ${settings.phone}</div>` : ''}</div><div>${qrImg}</div></div>
<div class="bill-title">BILL-INVOICE</div>
<div class="info-row"><div><div class="field"><span class="lbl">Name</span><span>:</span><span class="val">${sale.customer}</span></div>${sale.address ? `<div class="field"><span class="lbl">Address</span><span>:</span><span class="val">${sale.address}</span></div>` : ''}${sale.phone ? `<div class="field"><span class="lbl">Mobile</span><span>:</span><span class="val">${sale.phone}</span></div>` : ''}</div><div style="text-align:right"><div class="field" style="justify-content:flex-end"><span class="lbl">Invoice#</span><span>:</span><span class="val">${sale.invoice}</span></div><div class="field" style="justify-content:flex-end"><span class="lbl">Date</span><span>:</span><span class="val">${printDateStr}</span></div>${sale.soldBy ? `<div class="field" style="justify-content:flex-end"><span class="lbl">Sold By</span><span>:</span><span class="val">${sale.soldBy}</span></div>` : ''}</div></div>
<table><thead><tr><th>SN</th><th>TYPE</th><th>CARTON/PIECE</th><th>CATEGORY</th><th>PRODUCT NAME</th><th class="r">SQFT/QTY</th><th class="r">PRICE</th><th class="r">SUB TOTAL</th></tr></thead><tbody>${sale.items.map((item, idx) => {
  const p = products.find(x => x.id === item.productId);
  const cartonPiece = (item.carton ?? item.qty) + ' Carton ' + (item.piece ?? 0) + ' Piece';
  return '<tr><td>' + (idx+1) + '</td><td>' + (item.itemType || 'Sale') + '</td><td>' + cartonPiece + '</td><td>' + (item.category || p?.category || '') + '</td><td class="b">' + item.name + (p?.size ? ' (Size: ' + p.size + ')' : '') + '</td><td class="r">' + Number(item.sqftQty ?? 0).toFixed(2) + '</td><td class="r">' + item.price + '</td><td class="r b">' + Math.round((item.carton ?? item.qty) * item.price) + '</td></tr>';
}).join('')}</tbody></table>
<div class="bottom"><div><div style="font-size:11px;border:1px solid #999;padding:6px;margin-top:4px"><div>Due In This Bill: <strong>${sale.due ?? 0}/-</strong></div><div>Previous Dues: <strong>${sale.previousDues ?? 0}/-</strong></div><div>Balance: <strong>${(sale.due ?? 0) + (sale.previousDues ?? 0)}/-</strong></div></div><div style="font-size:11px;margin-top:6px"><strong>Remark:</strong> ${sale.notes || ''}</div><div style="font-size:11px"><strong>Total Quantity:</strong> ${totalQty}</div><div style="font-size:11px">In Word: <span style="color:#005cc1;font-weight:700">${numberToWords(sale.total)}</span></div></div><div class="sb"><div class="sr"><span>Total:</span><span class="sv">${sale.subtotal}</span></div>${(sale.labour ?? 0) > 0 ? `<div class="sr"><span>Labour:</span><span class="sv">${sale.labour}</span></div>` : ''}${sale.discount > 0 ? `<div class="sr"><span>Discount:</span><span class="sv">-${sale.discount}</span></div>` : ''}${(sale.delivery ?? 0) > 0 ? `<div class="sr"><span>Delivery:</span><span class="sv">+${sale.delivery}</span></div>` : ''}<div class="sr pay"><span>PAYABLE:</span><span class="sv">${sale.total}</span></div><div class="sr"><span>Paid:</span><span class="sv">${sale.paid ?? sale.total}</span></div>${(sale.due ?? 0) > 0 ? `<div class="sr" style="color:red"><span>Due:</span><span class="sv">${sale.due}</span></div>` : ''}</div></div>
<div class="sig-row"><div class="sig">Customer Signature</div><div class="sig">Authorized Signature</div></div>
<div class="disclaimer">বিক্রিত মাল ১ মাসের মধ্যে ফেরত নেওয়া হয়।চায়না/ইন্ডিয়ান মাল ফেরত নেওয়া হয় না।</div>
</div></body></html>`;
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) { toast.error('Popup blocked'); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 500);
  };

  const generatePDF = async (sale: SaleRecord) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210; let y = 18;
    // Logo
    doc.setFillColor(0, 92, 193); doc.roundedRect(15, y - 2, 16, 16, 2, 2, 'F');
    doc.setTextColor(255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(settings.name.slice(0, 3).toUpperCase(), 23, y + 8, { align: 'center' });
    // Company
    doc.setTextColor(34); doc.setFontSize(18); doc.text(settings.name.toUpperCase(), pw / 2, y + 4, { align: 'center' });
    if (settings.address) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(settings.address, pw / 2, y + 10, { align: 'center' }); }
    if (settings.phone) { doc.setFontSize(8); doc.text(`Phone# ${settings.phone}`, pw / 2, y + 14, { align: 'center' }); }
    try { const qrUrl = await QRCode.toDataURL(`${sale.invoice}-${sale.total}`, { width: 80, margin: 1 }); doc.addImage(qrUrl, 'PNG', pw - 33, y - 2, 18, 18); } catch {}
    y += 20; doc.setDrawColor(34); doc.setLineWidth(0.6); doc.line(15, y, pw - 15, y); y += 8;
    // BILL-INVOICE
    doc.setTextColor(34); doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('BILL-INVOICE', pw / 2, y, { align: 'center' }); y += 8;
    // Customer info
    const dateStr = (() => { try { const d = new Date(sale.date); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; } catch { return sale.date; } })();
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Name      :  ${sale.customer}`, 15, y); doc.text(`Invoice#  :  ${sale.invoice}`, pw - 15, y, { align: 'right' }); y += 5;
    if (sale.address) doc.text(`Address   :  ${sale.address}`, 15, y);
    doc.text(`Date      :  ${dateStr}`, pw - 15, y, { align: 'right' }); y += 5;
    if (sale.phone) doc.text(`Mobile    :  ${sale.phone}`, 15, y);
    if (sale.soldBy) doc.text(`Sold By   :  ${sale.soldBy}`, pw - 15, y, { align: 'right' }); y += 7;
    // Items table
    const tableData = sale.items.map((item, idx) => [
      String(idx + 1), item.itemType || 'Sale',
      `${item.carton ?? item.qty} Carton ${item.piece ?? 0} Piece`,
      item.category || '-', `${item.name}${item.detail ? ` (${item.detail})` : ''}`,
      String(Number(item.sqftQty ?? item.qty).toFixed(2)), String(item.price),
      String(Math.round((item.carton ?? item.qty) * item.price)),
    ]);
    doc.autoTable({ startY: y, head: [['SN', 'TYPE', 'CARTON/PIECE', 'CATEGORY', 'PRODUCT NAME', 'SQFT./QTY.', 'PRICE', 'SUB TOTAL']], body: tableData, theme: 'grid', margin: { left: 15, right: 15 }, styles: { fontSize: 8, cellPadding: 2.5, textColor: [34, 34, 34] }, headStyles: { fillColor: [192, 57, 43], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 }, columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 14 }, 2: { cellWidth: 30 }, 3: { cellWidth: 20 }, 4: { cellWidth: 42 }, 5: { cellWidth: 22, halign: 'right' }, 6: { cellWidth: 18, halign: 'right' }, 7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' } } });
    y = doc.lastAutoTable.finalY + 6;
    const dueInBill = sale.due ?? 0; const prevDues = sale.previousDues ?? 0; const balance = sale.balance ?? dueInBill;
    // Due box
    doc.setDrawColor(51); doc.setLineWidth(0.5); doc.rect(15, y, 60, 22);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(34);
    doc.text('Due In This Bill:', 17, y + 5); doc.setFont('helvetica', 'bold'); doc.text(`${dueInBill}/-`, 73, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.text('Previous Dues:', 17, y + 11); doc.setFont('helvetica', 'bold'); doc.text(`${prevDues}/-`, 73, y + 11, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.text('Balance:', 17, y + 17); doc.setFont('helvetica', 'bold'); doc.text(`${balance}/-`, 73, y + 17, { align: 'right' });
    // Summary right
    const sx = 140; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Total:', sx, y + 5); doc.setFont('helvetica', 'bold'); doc.text(String(sale.subtotal), pw - 15, y + 5, { align: 'right' });
    let sy = y + 11;
    if ((sale.labour ?? 0) > 0) { doc.setFont('helvetica', 'normal'); doc.text('Labour:', sx, sy); doc.setFont('helvetica', 'bold'); doc.text(String(sale.labour), pw - 15, sy, { align: 'right' }); sy += 6; }
    doc.setDrawColor(34); doc.setLineWidth(0.8); doc.line(sx - 2, sy, pw - 15, sy); sy += 2;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('PAYABLE:', sx, sy + 5); doc.text(String(sale.total), pw - 15, sy + 5, { align: 'right' }); sy += 10;
    doc.setFontSize(10); doc.text('Paid:', sx, sy); doc.text(String(sale.paid ?? sale.total), pw - 15, sy, { align: 'right' });
    // Remark
    const totalQty = sale.items.reduce((s, i) => s + (i.sqftQty ?? i.qty), 0);
    const ry = y + 26; doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text('Remark:', 15, ry); doc.setFont('helvetica', 'normal'); doc.text(sale.notes || '', 35, ry);
    doc.setFont('helvetica', 'bold'); doc.text(`Total Quantity: ${totalQty}`, 15, ry + 5);
    doc.text('In Word: ', 15, ry + 10); doc.setTextColor(0, 92, 193); doc.text(numberToWords(sale.total), 33, ry + 10); doc.setTextColor(34);
    // Signatures
    const sigY = ry + 30; doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(20, sigY, 75, sigY); doc.line(pw - 75, sigY, pw - 20, sigY);
    doc.setFontSize(10); doc.setTextColor(0, 92, 193); doc.setFont('helvetica', 'bold');
    doc.text('Customer Signature', 47, sigY + 5, { align: 'center' }); doc.text('Authorized Signature', pw - 47, sigY + 5, { align: 'center' });
    // Disclaimer
    doc.setTextColor(192, 57, 43); doc.setFontSize(9);
    doc.text('Goods once sold are not returnable. Chinese/Indian products are non-refundable.', pw / 2, sigY + 16, { align: 'center' });
    doc.save(`${sale.invoice}.pdf`);
    toast.success('PDF Downloaded');
  };

  const SortHeader = ({ field, children, align }: { field: SortField; children: React.ReactNode; align?: string }) => (
    <th className={`px-4 py-3 cursor-pointer select-none hover:bg-pos-surface-container transition-colors ${align || ''}`} onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="material-symbols-outlined text-[11px] opacity-60">{sortIcon(field)}</span>
      </span>
    </th>
  );

  // ══════════════════════════════════════
  // ══════ ADD SALE VIEW ══════
  // ══════════════════════════════════════
  if (view === 'add') {
    return (
      <section className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-1">Sales</span>
            <h2 className="text-2xl font-bold text-pos-on-surface tracking-tight">
              <span className="text-pos-secondary cursor-pointer hover:underline" onClick={() => setView('history')}>Sales</span>
              <span className="mx-2 text-pos-on-surface-variant">›</span>Add Sales
            </h2>
          </div>
          <button onClick={() => setView('history')} className="px-5 py-2.5 bg-pos-secondary text-white rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
            <span className="material-symbols-outlined text-lg">folder</span>Sales History
          </button>
        </div>

        <div className="flex gap-4 flex-col lg:flex-row">
          {/* ── LEFT: Main form ── */}
          <div className="flex-1 space-y-4">
            {/* Top fields: Date + Customer */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Date</label>
                  <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Customer</label>
                  <ComboInput value={customerName} onChange={val => {
                    setCustomerName(val);
                    const c = customers.find(x => x.name === val);
                    if (c) { setPhone(c.phone || ''); setAddress(c.address || ''); }
                  }} options={customers.map(c => `${c.name} //// ${c.phone || ''} //// ${c.address || ''}`)} placeholder="Select Customer..."
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
              </div>
            </div>

            {/* Product search with dropdown */}
            <div className="relative">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input ref={searchRef} value={productSearch} onChange={e => {
                    setProductSearch(e.target.value);
                    setSelectedProductId(null);
                  }}
                    className="w-full bg-pos-surface-lowest border-2 border-pos-secondary/30 rounded-xl text-sm py-3 pl-11 pr-4 outline-none focus:border-pos-secondary transition-colors"
                    placeholder="Search the Product..." />
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant">search</span>
                  {/* Search dropdown */}
                  {productSearch && !selectedProductId && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-xl z-50 max-h-[200px] overflow-y-auto">
                      {displayProducts.length > 0 ? displayProducts.slice(0, 15).map(p => (
                        <button key={p.id} type="button" onClick={() => {
                          setSelectedProductId(p.id);
                          setProductSearch(p.name);
                          setManualRate(String(p.pricePerBox));
                        }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex justify-between items-center">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-[10px]">{p.barcode || p.batch || ''} · Stock: {p.stock}</span>
                        </button>
                      )) : (
                        <div className="px-3 py-3 text-xs text-muted-foreground text-center">No products found</div>
                      )}
                    </div>
                  )}
                </div>
                <input type="number" value={pageSize} onChange={e => setPageSize(Number(e.target.value) || 10)}
                  className="w-16 bg-pos-surface-lowest border border-pos-surface-container rounded-lg text-sm py-3 px-2 text-center outline-none" title="Entries" />
              </div>
            </div>

            {/* Manual entry row: Carton, Piece, Sqft/Qty, Sales Rate, Add */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-pos-surface-lowest border border-pos-surface-container rounded-lg px-2 py-2">
                <span className="text-[10px] font-bold text-pos-on-surface-variant uppercase">Carton</span>
                <input type="number" min={0} value={manualCarton} onChange={e => setManualCarton(parseInt(e.target.value) || 0)}
                  className="w-14 bg-transparent text-sm text-center outline-none" />
              </div>
              <div className="flex items-center gap-1 bg-pos-surface-lowest border border-pos-surface-container rounded-lg px-2 py-2">
                <span className="text-[10px] font-bold text-pos-on-surface-variant uppercase">Piece</span>
                <input type="number" min={0} value={manualPiece} onChange={e => setManualPiece(parseInt(e.target.value) || 0)}
                  className="w-14 bg-transparent text-sm text-center outline-none" />
              </div>
              <div className="flex items-center gap-1 bg-pos-surface-lowest border border-pos-surface-container rounded-lg px-2 py-2 flex-1 min-w-[120px]">
                <span className="text-[10px] font-bold text-pos-on-surface-variant uppercase">Sqft./Qty.</span>
                <input type="number" min={0} value={manualSqft} onChange={e => setManualSqft(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent text-sm text-center outline-none" />
              </div>
              <div className="flex items-center gap-1 bg-pos-surface-lowest border border-pos-surface-container rounded-lg px-2 py-2">
                <span className="text-[10px] font-bold text-pos-on-surface-variant uppercase">Sales Rate</span>
                <input type="number" value={manualRate} onChange={e => setManualRate(e.target.value)} placeholder="0"
                  className="w-20 bg-transparent text-sm text-center outline-none" />
              </div>
              <button onClick={manualAddProduct}
                className="px-6 py-2.5 bg-pos-error text-white rounded-lg font-bold text-sm hover:bg-pos-error/90 transition-colors">
                Add
              </button>
            </div>

            {/* All products table with checkbox */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-[10px] font-bold text-white uppercase tracking-wider bg-[hsl(230,45%,35%)]">
                      <th className="px-2 py-2.5 w-8"><span className="material-symbols-outlined text-sm">check_box</span></th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Barcode</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5 text-center">Carton</th>
                      <th className="px-3 py-2.5 text-center">Piece</th>
                      <th className="px-3 py-2.5 text-center">Sqft./Qty.</th>
                      <th className="px-3 py-2.5 text-right">Sales Rate</th>
                      <th className="px-3 py-2.5 text-right">Sub Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {displayProducts.map(p => {
                      const item = items.find(i => i.productId === p.id);
                      const isSelected = !!item;
                      return (
                        <tr key={p.id} className={`transition-colors ${isSelected ? 'bg-[hsl(45,100%,96%)] dark:bg-[hsl(45,20%,12%)]' : 'hover:bg-muted/30'}`}>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked={isSelected}
                              onChange={() => isSelected ? removeItem(item!.id) : addProductToItems(p)}
                              className="w-4 h-4 rounded border-pos-surface-container accent-pos-secondary cursor-pointer" />
                          </td>
                          {isSelected ? (
                            <>
                              <td className="px-1 py-1">
                                <select value={item!.itemType} onChange={e => updateItem(item!.id, 'itemType', e.target.value)}
                                  className="bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-xs py-1.5 px-1 outline-none">
                                  <option>Sale</option><option>Return</option>
                                </select>
                              </td>
                              <td className="px-3 py-2 text-sm font-mono">{item!.barcode || '—'}</td>
                              <td className="px-3 py-2 text-sm font-medium">{item!.name}</td>
                              <td className="px-1 py-1">
                                <input type="number" min={0} value={item!.carton} onChange={e => updateItem(item!.id, 'carton', parseInt(e.target.value) || 0)}
                                  className="w-16 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                              </td>
                              <td className="px-1 py-1">
                                <input type="number" min={0} value={item!.piece} onChange={e => updateItem(item!.id, 'piece', parseInt(e.target.value) || 0)}
                                  className="w-14 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                              </td>
                              <td className="px-3 py-2 text-center text-sm">{item!.sqftQty > 0 ? item!.sqftQty.toFixed(3) : '0'}</td>
                              <td className="px-1 py-1">
                                <input type="number" value={item!.salesRate} onChange={e => updateItem(item!.id, 'salesRate', parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-right outline-none focus:border-pos-secondary ml-auto block" />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-sm">{formatCurrency(item!.subTotal)}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-sm text-muted-foreground">Sale</td>
                              <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{p.barcode || p.batch || '—'}</td>
                              <td className="px-3 py-2 text-sm text-muted-foreground">{p.name}</td>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">0</td>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">0</td>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">0</td>
                              <td className="px-3 py-2 text-right text-sm text-muted-foreground">{p.pricePerBox}</td>
                              <td className="px-3 py-2 text-right text-sm text-muted-foreground">0.00</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {displayProducts.length === 0 && (
                      <tr><td colSpan={9} className="px-8 py-8 text-center text-sm text-pos-on-surface-variant">No products found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom: Remark + Status + Send SMS */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="text-xs font-bold text-pos-on-surface-variant uppercase shrink-0">Remark</span>
                  <input value={remark} onChange={e => setRemark(e.target.value)}
                    className="flex-1 bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" placeholder="Optional note..." />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-pos-on-surface-variant uppercase">Status</span>
                  <select value={saleStatus} onChange={e => setSaleStatus(e.target.value)}
                    className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none">
                    <option>Complete</option><option>Pending</option><option>Credit</option>
                  </select>
                </div>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-pos-secondary" />
                  Send SMS
                </label>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Summary sidebar ── */}
          <div className="w-full lg:w-[280px] shrink-0">
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4 space-y-2.5 sticky top-4">
              {/* Total */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2.5">
                <span className="text-sm font-medium text-pos-on-surface-variant">Total</span>
                <span className="text-lg font-black text-pos-secondary">{formatCurrency(total)}</span>
              </div>
              {/* Return */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2">
                <span className="text-sm text-pos-on-surface-variant">Return</span>
                <input type="number" value={returnAmt} onChange={e => setReturnAmt(e.target.value)} placeholder="0"
                  className="w-20 bg-transparent text-sm text-right outline-none font-bold text-pos-error" />
              </div>
              {/* Discount */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-pos-on-surface-variant">Discount</span>
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percent')}
                    className="bg-transparent text-[10px] outline-none">
                    <option value="percent">%</option><option value="flat">৳</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                    className="w-14 bg-transparent text-sm text-right outline-none" />
                  <span className="text-xs font-bold text-pos-on-surface-variant">Less</span>
                  <input type="number" value={lessAmt} onChange={e => setLessAmt(e.target.value)} placeholder="0"
                    className="w-14 bg-transparent text-sm text-right outline-none" />
                </div>
              </div>
              {/* Delivery */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2">
                <span className="text-sm text-pos-on-surface-variant">Delivery</span>
                <input type="number" value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="0"
                  className="w-20 bg-transparent text-sm text-right outline-none font-bold text-pos-secondary" />
              </div>
              {/* Labour */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2">
                <span className="text-sm text-pos-on-surface-variant">Labour</span>
                <input type="number" value={labourCost} onChange={e => setLabourCost(e.target.value)} placeholder="0"
                  className="w-20 bg-transparent text-sm text-right outline-none font-bold text-pos-secondary" />
              </div>
              {/* Payable */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2.5 bg-pos-surface-high">
                <span className="text-sm font-bold text-pos-on-surface">Payable</span>
                <span className="text-lg font-black text-pos-secondary">{formatCurrency(payable)}</span>
              </div>
              {/* Paid */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2">
                <span className="text-sm font-bold text-pos-on-surface-variant">Paid</span>
                <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0"
                  className="w-20 bg-transparent text-sm text-right outline-none font-bold" />
              </div>
              {/* Due */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2.5">
                <span className="text-sm font-bold text-pos-error">Due</span>
                <span className={`text-lg font-black ${dueVal > 0 ? 'text-pos-error' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(dueVal)}</span>
              </div>
              {/* Balance */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2.5">
                <span className="text-sm font-bold text-pos-secondary">Balance</span>
                <span className={`text-lg font-black ${balanceVal > 0 ? 'text-pos-error' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(balanceVal)}</span>
              </div>
              {/* Mode */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2">
                <span className="text-sm text-pos-on-surface-variant">Mode</span>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
                  className="bg-transparent text-sm outline-none text-right">
                  <option>Cash</option><option>bKash</option><option>Nagad</option><option>Card</option><option>Credit</option>
                </select>
              </div>
              {/* Save */}
              <button onClick={handleSave}
                className="w-full py-3 bg-pos-error text-white rounded-lg font-bold text-base hover:bg-pos-error/90 transition-colors mt-2">
                Save
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ══════════════════════════════════════
  // ══════ HISTORY VIEW ══════
  // ══════════════════════════════════════
  return (
    <section className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-1">Sales</span>
          <h2 className="text-2xl font-bold text-pos-on-surface tracking-tight">
            <span className="text-pos-secondary">Sales</span>
            <span className="mx-2 text-pos-on-surface-variant">›</span>Sales History
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2.5 bg-pos-surface-container text-pos-on-surface rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-pos-surface-high transition-colors">
            <span className="material-symbols-outlined text-lg">download</span>Export
          </button>
          <button onClick={openAddSale} className="px-5 py-2.5 bg-pos-secondary text-white rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
            <span className="material-symbols-outlined text-lg">add</span>Add Sales
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-pos-on-surface-variant">Show</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-1.5 px-2 outline-none">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-xs text-pos-on-surface-variant">entries</span>
        </div>
        <div className="relative">
          <span className="text-xs text-pos-on-surface-variant mr-2">Search:</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-1.5 px-3 outline-none w-48" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-[10px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-low border-b-2 border-pos-secondary">
                <SortHeader field="invoice">INV. #</SortHeader>
                <SortHeader field="date">Date</SortHeader>
                <th className="px-4 py-3">Type</th>
                <SortHeader field="customer">Customer Name</SortHeader>
                <th className="px-4 py-3">Mobile</th>
                <SortHeader field="total" align="text-right">Total</SortHeader>
                <th className="px-4 py-3 text-right">Return</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Less</th>
                <SortHeader field="paid" align="text-right">Paid</SortHeader>
                <SortHeader field="due" align="text-right">Due</SortHeader>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginated.length > 0 ? paginated.map(s => {
                const saledue = s.due ?? (s.total - (s.paid ?? s.total));
                const custType = s.customerType || (s.customer === t('walkInCustomer') ? 'Walking' : 'Listed');
                return (
                  <tr key={s.id} className="hover:bg-pos-surface-low transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-pos-secondary">{s.invoice}</td>
                    <td className="px-4 py-3 text-sm">{(() => { try { return new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return s.date; } })()}</td>
                    <td className="px-4 py-3 text-sm">{custType}</td>
                    <td className="px-4 py-3 text-sm font-medium">{s.customer}</td>
                    <td className="px-4 py-3 text-sm">{s.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(s.total)}</td>
                    <td className="px-4 py-3 text-sm text-right">{s.returnAmount ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-right">{s.discount}</td>
                    <td className="px-4 py-3 text-sm text-right">{s.lessAmount ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(s.paid ?? s.total)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${saledue > 0 ? 'text-pos-error' : ''}`}>{formatCurrency(saledue)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button data-sale-id={s.id} className="px-3 py-1.5 bg-pos-error text-white rounded text-xs font-semibold flex items-center gap-1"
                          onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}>
                          Options <span className="material-symbols-outlined text-xs">arrow_drop_down</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={12} className="px-8 py-8 text-center text-sm text-pos-on-surface-variant">No sales found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Floating dropdown menu */}
        {openMenuId && (() => {
          const sale = sales.find(s => s.id === openMenuId);
          if (!sale) return null;
          return (
            <div className="fixed inset-0 z-[999]" onClick={() => setOpenMenuId(null)}>
              <div className="fixed z-[1000]" style={(() => {
                const btn = document.querySelector(`[data-sale-id="${openMenuId}"]`) as HTMLElement;
                if (!btn) return { top: '50%', right: '2rem' };
                const rect = btn.getBoundingClientRect();
                const menuHeight = 180;
                const spaceBelow = window.innerHeight - rect.bottom;
                const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
                return { top: `${top}px`, right: `${window.innerWidth - rect.right}px` };
              })()}
                onClick={e => e.stopPropagation()}>
                <div className="bg-card border border-border rounded-lg shadow-xl min-w-[140px] py-1">
                  <button onClick={() => { reopenInvoice(sale); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-accent flex items-center gap-2"><span className="material-symbols-outlined text-sm text-pos-secondary">visibility</span>View</button>
                  <button onClick={() => { handlePrintSale(sale); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-accent flex items-center gap-2"><span className="material-symbols-outlined text-sm text-pos-secondary">print</span>Print</button>
                  <button onClick={() => { generatePDF(sale); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-accent flex items-center gap-2"><span className="material-symbols-outlined text-sm text-destructive">picture_as_pdf</span>PDF</button>
                  <button onClick={() => { setShowDeleteConfirm(sale.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-accent flex items-center gap-2 text-destructive"><span className="material-symbols-outlined text-sm">delete</span>Delete</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pagination */}
        <div className="px-6 py-3 bg-pos-surface-low border-t border-pos-surface-container flex justify-between items-center">
          <span className="text-xs text-pos-on-surface-variant">
            Showing {filtered.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} entries
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoice && viewSale && (
        <InvoiceModal sale={viewSale} companyName={companyName} companyPhone={companyPhone} companyAddress={companyAddress} companyEmail={settings.email} soldBy={viewSale.soldBy || settings.userName} onClose={() => setShowInvoice(false)} />
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pos-error/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-pos-error">delete</span>
              </div>
              <h3 className="text-lg font-bold">Delete Sale?</h3>
            </div>
            <p className="text-sm text-pos-on-surface-variant mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

async function generateQRDataURL(data: string, size = 80): Promise<string> {
  try { return await QRCode.toDataURL(data || 'N/A', { width: size, margin: 1, errorCorrectionLevel: 'M' }); } catch { return ''; }
}
