import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextInvoiceNumber, downloadCSV, calcDiscount, numberToWords, type CartItem, type Product, type SaleRecord, type Customer, type CompanySettings } from "@/lib/store";
import { calcSqftQty, calcCartonPieceFromSqft, calcSubTotal, isSqftUnit, getDisplaySqftQty, cartonPieceToTotalPieces, totalPiecesToCartonPiece, formatStockDisplay } from "@/lib/calc-utils";
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
  const [view, setView] = useState<'history' | 'add'>('add');

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
  const [isWalkingCustomer, setIsWalkingCustomer] = useState(false);
  const [walkingName, setWalkingName] = useState('');
  const [walkingPhone, setWalkingPhone] = useState('');
  const [walkingAddress, setWalkingAddress] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [items, setItems] = useState<SaleItemRow[]>([]);
  const [manualCarton, setManualCarton] = useState(0);
  const [manualPiece, setManualPiece] = useState(0);
  const [manualSqft, setManualSqft] = useState(0);
  const [manualRate, setManualRate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [delivery, setDelivery] = useState('');
  const [labourCost, setLabourCost] = useState('');
  const [returnAmt, setReturnAmt] = useState('');
  const [lessAmt, setLessAmt] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [saleStatus, setSaleStatus] = useState('Complete');
  const [deliveryStatus, setDeliveryStatus] = useState('Complete');
  const [salesMan, setSalesMan] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustType, setNewCustType] = useState('General Customer');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

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

  // ── Add Sale: product search ──
  const debouncedProductSearch = useDebounce(productSearch, 200);
  const displayProducts = useMemo(() => {
    if (!debouncedProductSearch) return [];
    return products.filter(p =>
      p.name.toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
      p.batch.toLowerCase().includes(debouncedProductSearch.toLowerCase())
    );
  }, [products, debouncedProductSearch]);

  const selectedProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null;

  const isSelectedSqft = selectedProduct ? isSqftUnit(selectedProduct.unit) : true;

  // Bi-directional calc for manual entry (SQFT only)
  const handleManualCartonChange = (val: number) => {
    setManualCarton(val);
    if (selectedProduct && isSqftUnit(selectedProduct.unit)) {
      setManualSqft(parseFloat(calcSqftQty(selectedProduct, val, manualPiece).toFixed(3)));
    }
  };
  const handleManualPieceChange = (val: number) => {
    setManualPiece(val);
    if (selectedProduct && isSqftUnit(selectedProduct.unit)) {
      // Calculate sqft from total pieces (carton + this piece value)
      const piecesPerBox = selectedProduct.piecesPerBox || 4;
      const totalPieces = (manualCarton * piecesPerBox) + val;
      const sqftPerPiece = (selectedProduct.sqftPerBox || 0) / piecesPerBox;
      setManualSqft(parseFloat((totalPieces * sqftPerPiece).toFixed(3)));
    }
  };
  // Auto-split piece into carton+piece on blur
  const handlePieceBlur = () => {
    if (selectedProduct && isSqftUnit(selectedProduct.unit) && manualCarton === 0 && manualPiece > 0) {
      const piecesPerBox = selectedProduct.piecesPerBox || 4;
      if (manualPiece >= piecesPerBox) {
        const autoCarton = Math.floor(manualPiece / piecesPerBox);
        const remainingPiece = manualPiece % piecesPerBox;
        setManualCarton(autoCarton);
        setManualPiece(remainingPiece);
        setManualSqft(parseFloat(calcSqftQty(selectedProduct, autoCarton, remainingPiece).toFixed(3)));
      }
    }
  };
  const handleManualSqftChange = (val: number) => {
    setManualSqft(val);
    if (selectedProduct && isSqftUnit(selectedProduct.unit)) {
      const { carton, piece } = calcCartonPieceFromSqft(selectedProduct, val);
      setManualCarton(carton);
      setManualPiece(piece);
    }
  };
  // For non-SQFT: manual qty
  const handleManualQtyChange = (val: number) => {
    setManualPiece(val); // store qty in piece field for non-SQFT
    setManualCarton(0);
    setManualSqft(val);
  };

  // Recent customers (last 5 by created_at)
  const recentCustomers = useMemo(() => {
    return [...customers].slice(0, 5);
  }, [customers]);

  const handleSelectCustomer = (name: string) => {
    if (name === 'Walking Customer' || name === 'ওয়াকিং কাস্টমার') {
      setIsWalkingCustomer(true);
      setCustomerName(name);
      setPhone(''); setAddress('');
      setWalkingName(''); setWalkingPhone(''); setWalkingAddress('');
    } else {
      setIsWalkingCustomer(false);
      setCustomerName(name);
      const c = customers.find(x => x.name === name);
      if (c) { setPhone(c.phone || ''); setAddress(c.address || ''); }
    }
    setShowCustomerDropdown(false);
  };

  const handleSaveNewCustomer = () => {
    if (!newCustName.trim()) { toast.error('Customer name required'); return; }
    onAutoAddCustomer(newCustName.trim(), newCustPhone, newCustAddress);
    setCustomerName(newCustName.trim());
    setPhone(newCustPhone); setAddress(newCustAddress);
    setIsWalkingCustomer(false);
    setShowAddCustomerModal(false);
    setNewCustName(''); setNewCustPhone(''); setNewCustType('General Customer'); setNewCustAddress('');
    toast.success('Customer added');
  };

  const addProductToItems = (product: Product, carton?: number, piece?: number, sqft?: number, rate?: number) => {
    if (items.find(i => i.productId === product.id)) {
      toast.error('Already added');
      return;
    }
    const sr = rate ?? product.pricePerBox;
    if (isSqftUnit(product.unit)) {
      const c = carton ?? 1;
      const pc = piece ?? 0;
      const autoSqft = sqft || calcSqftQty(product, c, pc);
      const sub = calcSubTotal(product, c, pc, sr);
      setItems(prev => [...prev, {
        id: Date.now(), productId: product.id, barcode: product.barcode || product.batch || '',
        name: product.name, stock: product.stock, itemType: 'Sale',
        carton: c, piece: pc, sqftQty: autoSqft, salesRate: sr, subTotal: sub,
      }]);
    } else {
      // Non-SQFT: qty-based
      const qty = piece ?? 1;
      const sub = qty * sr;
      setItems(prev => [...prev, {
        id: Date.now(), productId: product.id, barcode: product.barcode || product.batch || '',
        name: product.name, stock: product.stock, itemType: 'Sale',
        carton: 0, piece: qty, sqftQty: qty, salesRate: sr, subTotal: sub,
      }]);
    }
  };

  const manualAddProduct = () => {
    if (!selectedProductId) { toast.error('Search & select a product first'); return; }
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    if (isSqftUnit(product.unit)) {
      addProductToItems(product, manualCarton, manualPiece, manualSqft, parseFloat(manualRate) || product.pricePerBox);
    } else {
      addProductToItems(product, 0, manualPiece || 1, 0, parseFloat(manualRate) || product.pricePerBox);
    }
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
      if (!product) return updated;

      if (isSqftUnit(product.unit)) {
        if (field === 'sqftQty') {
          const { carton, piece } = calcCartonPieceFromSqft(product, Number(value));
          updated.carton = carton;
          updated.piece = piece;
        } else if (field === 'carton' || field === 'piece') {
          updated.sqftQty = calcSqftQty(product, updated.carton, updated.piece);
        }
        updated.subTotal = calcSubTotal(product, updated.carton, updated.piece, updated.salesRate);
      } else {
        // Non-SQFT: piece = qty, simple calc
        if (field === 'piece') {
          updated.sqftQty = Number(value); // keep in sync for data consistency
          updated.carton = 0;
        }
        updated.subTotal = updated.piece * updated.salesRate;
      }
      return updated;
    }));
  };

  // ── Calculations (Sale/Return from cart items) ──
  const total = items.filter(i => i.itemType === 'Sale').reduce((s, i) => s + i.subTotal, 0);
  const returnVal = items.filter(i => i.itemType === 'Return').reduce((s, i) => s + i.subTotal, 0);
  const discountVal = discountType === 'percent' ? Math.round(total * (parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
  const lessVal = parseFloat(lessAmt) || 0;
  const deliveryVal = parseFloat(delivery) || 0;
  const labourVal = parseFloat(labourCost) || 0;
  const payable = total - returnVal - discountVal - lessVal + deliveryVal + labourVal;
  const paidVal = parseFloat(paidAmount) || 0;
  const dueVal = payable - paidVal;
  const selectedCustomerObj = customers.find(c => c.name === customerName);
  const prevDues = selectedCustomerObj?.totalDue || 0;
  const balanceVal = dueVal + prevDues;

  const openAddSale = () => {
    setView('add');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setCustomerName(''); setPhone(''); setAddress('');
    setIsWalkingCustomer(false); setWalkingName(''); setWalkingPhone(''); setWalkingAddress('');
    setItems([]); setDiscount(''); setDelivery(''); setPaidAmount('');
    setRemark(''); setSaleStatus('Complete'); setDeliveryStatus('Complete');
    setPaymentMode('Cash'); setReturnAmt(''); setLessAmt(''); setLabourCost('');
    setSalesMan('');
  };

  const handleSave = () => {
    // ── Required field validations ──
    if (!customerName && !isWalkingCustomer) { toast.error('কাস্টমার সিলেক্ট করুন'); return; }
    if (isWalkingCustomer && !walkingName.trim()) { toast.error('Walking Customer এর নাম দিন'); return; }
    if (!items.length) { toast.error('কমপক্ষে একটি প্রোডাক্ট যোগ করুন'); return; }
    if (!salesMan) { toast.error('Sales Man সিলেক্ট করুন'); return; }
    if (!paymentMode) { toast.error('Payment Mode সিলেক্ট করুন'); return; }
    if (!paidAmount && saleStatus !== 'Credit' && payable > 0) { toast.error('Paid amount দিন!'); return; }

    const inv = getNextInvoiceNumber(settings.invPrefix);
    const now = new Date(saleDate);
    const autoStatus = payable <= 0 ? 'paid' : paidVal >= payable ? 'paid' : paidVal > 0 ? 'pending' : 'credit';

    const finalCustomer = isWalkingCustomer ? (walkingName || t('walkInCustomer')) : (customerName || t('walkInCustomer'));
    const finalPhone = isWalkingCustomer ? walkingPhone : phone;
    const finalAddress = isWalkingCustomer ? walkingAddress : address;

    const saleItems = items.map(i => {
      const p = products.find(x => x.id === i.productId);
      return {
        productId: i.productId, name: i.name, detail: p ? `${p.size} · ${p.finish}` : '',
        qty: i.carton, price: i.salesRate, carton: i.carton, piece: i.piece,
        sqftQty: i.sqftQty, category: p?.category || '', itemType: i.itemType as 'Sale' | 'Return',
      };
    });

    const sale: SaleRecord = {
      id: crypto.randomUUID(), invoice: inv, customer: finalCustomer,
      customerType: isWalkingCustomer ? 'Walking' : 'Listed',
      phone: finalPhone, address: finalAddress, items: saleItems, subtotal: total, discount: discountVal,
      discountType, total: payable, paymentMethod: paymentMode.toLowerCase(),
      notes: remark, status: autoStatus as SaleRecord['status'],
      date: now.toISOString(), time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      paid: paidVal, due: dueVal, delivery: deliveryVal, returnAmount: returnVal,
      lessAmount: lessVal, balance: balanceVal, labour: labourVal,
      previousDues: prevDues, soldBy: salesMan || settings.userName || '',
    };

    // Stock: Sale items DEDUCT, Return items ADD BACK
    const stockChanges = items.map(i => {
      const p = products.find(x => x.id === i.productId);
      let totalPieces: number;
      if (p && !isSqftUnit(p.unit)) {
        totalPieces = Math.max(1, i.piece);
      } else {
        const piecesPerBox = p?.piecesPerBox || 4;
        totalPieces = Math.max(1, cartonPieceToTotalPieces(i.carton, i.piece, piecesPerBox));
      }
      // Return items: negative qty means stock is ADDED back
      return { productId: i.productId, qty: i.itemType === 'Return' ? -totalPieces : totalPieces };
    });
    onSaleComplete(sale, stockChanges);
    if (!isWalkingCustomer && finalCustomer !== t('walkInCustomer') && !customers.find(c => c.name === finalCustomer)) {
      onAutoAddCustomer(finalCustomer, finalPhone, finalAddress);
    }

    // WhatsApp notification
    if (sendWhatsApp && finalPhone) {
      const whatsAppPhone = finalPhone.replace(/[^0-9]/g, '');
      const fullPhone = whatsAppPhone.startsWith('880') ? whatsAppPhone : '88' + whatsAppPhone;
      const saleItemsSummary = items.map(i => `- ${i.name} (${i.itemType}) - Tk.${i.subTotal.toFixed(0)}`).join('\n');
      const msg = `*${companyName || 'Invoice'}*\n` +
        `Invoice: ${inv}\n` +
        `Date: ${saleDate}\n\n` +
        `${saleItemsSummary}\n\n` +
        `Total: Tk.${total.toFixed(2)}\n` +
        (returnVal > 0 ? `Return: Tk.${returnVal.toFixed(2)}\n` : '') +
        (discountVal > 0 ? `Discount: Tk.${discountVal.toFixed(2)}\n` : '') +
        `Payable: Tk.${payable.toFixed(2)}\n` +
        `Paid: Tk.${paidVal.toFixed(2)}\n` +
        (dueVal > 0 ? `Due: Tk.${dueVal.toFixed(2)}\n` : '') +
        `\nDhonnobad!`;
      const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
      // Use location.href as fallback for iframe-blocked contexts
      try {
        const win = window.open(waUrl, '_blank');
        if (!win) window.location.href = waUrl;
      } catch {
        window.location.href = waUrl;
      }
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

  // Print sale — uses exact same template as New Sale Entry
  const handlePrintSale = async (sale: SaleRecord) => {
    const qrDataURL = await generateQRDataURL(`${sale.invoice}-${sale.total}`);
    const qrImg = qrDataURL ? `<img src="${qrDataURL}" width="80" height="80" style="image-rendering:pixelated"/>` : '';
    const printDateStr = (() => { try { const d = new Date(sale.date); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; } catch { return sale.date; } })();
    const totalQty = sale.items.reduce((s, i) => s + (i.sqftQty ?? i.qty), 0);
    const dueInBill = sale.due ?? 0;
    const prevDues = sale.previousDues ?? 0;
    const bal = sale.balance ?? dueInBill;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sale.invoice}</title>
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
    <div class="field" style="justify-content:flex-end"><span class="lbl">Sold By</span><span>:</span><span class="val">${sale.soldBy || settings.userName || settings.name}</span></div>
  </div>
</div>
<table>
<thead><tr><th>SN</th><th>TYPE</th><th>CARTON/PIECE</th><th>CATEGORY</th><th>PRODUCT NAME</th><th class="r">SQFT./QTY.</th><th class="r">PRICE</th><th class="r">SUB TOTAL</th></tr></thead>
<tbody>${sale.items.map((item, idx) => {
  const p = products.find(x => x.id === item.productId);
  return `<tr><td>${idx+1}</td><td>Sale</td><td>${item.carton ?? item.qty} Carton ${item.piece ?? 0} Piece</td><td>${item.category || p?.category || '-'}</td><td class="b">${item.name}${p ? ` (Size: ${p.size})` : ''}</td><td class="r">${Number(item.sqftQty ?? (item.qty * (p?.sqftPerBox || 1))).toFixed(2)}</td><td class="r">${item.price}</td><td class="r b">${Math.round((item.sqftQty && item.sqftQty > 0 ? item.sqftQty : item.qty) * item.price)}</td></tr>`;
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
</div></body></html>`;
    // Print using hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) { toast.error('Print failed'); document.body.removeChild(iframe); return; }
    iframeDoc.open(); iframeDoc.write(html); iframeDoc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  const generatePDF = async (sale: SaleRecord) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210;
    let y = 20;
    const bizInfoLine = [settings.phone, settings.address].filter(Boolean).join(' · ');
    const dateStr = (() => { try { const d = new Date(sale.date); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return sale.date; } })();
    const timeStr = sale.time || '';

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
    doc.text(`${dateStr} · ${timeStr}`, pw - 15, y + 27, { align: 'right' });

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

    const tableData = sale.items.map(item => [`${item.name}\n${item.detail || ''}`, String(item.qty), formatCurrency(item.price), formatCurrency(item.price * item.qty)]);
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
        {/* Header with toggle buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm mb-1">
              <span className="text-pos-secondary font-semibold">Sales</span>
              <span className="text-pos-on-surface-variant">›</span>
              <span className="text-pos-secondary font-medium">Add Sales</span>
            </div>
            <h2 className="text-2xl font-bold text-pos-on-surface tracking-tight">Sales</h2>
          </div>
          <div className="flex gap-1 bg-pos-surface-container rounded-lg p-1">
            <button onClick={() => {}} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 bg-pos-secondary text-white shadow">
              <span className="material-symbols-outlined text-base">add</span>Add Sales
            </button>
            <button onClick={() => setView('history')} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 text-pos-on-surface-variant hover:bg-pos-surface-high transition-colors">
              <span className="material-symbols-outlined text-base">folder_open</span>Sales History
            </button>
          </div>
        </div>

        <div className="flex gap-4 flex-col lg:flex-row">
          {/* ── LEFT: Main form ── */}
          <div className="flex-1 space-y-4">
            {/* Row 1: Date + Customer Select + Add Customer btn */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4">
              <div className="flex items-end gap-3">
                <div className="shrink-0">
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Date</label>
                  <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
                    className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
                <div className="flex-1 relative" ref={customerDropdownRef}>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Customer</label>
                  <div className="relative">
                    <select
                      value={customerName}
                      onChange={e => handleSelectCustomer(e.target.value)}
                      className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none appearance-none cursor-pointer"
                    >
                      <option value="">Select Customer</option>
                      <option value="Walking Customer">Walking Customer</option>
                      {recentCustomers.map(c => (
                        <option key={c.id} value={c.name}>{c.name} — {c.phone || 'No phone'}</option>
                      ))}
                      {customers.filter(c => !recentCustomers.find(r => r.id === c.id)).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant pointer-events-none text-sm">expand_more</span>
                  </div>
                </div>
                <button onClick={() => setShowAddCustomerModal(true)}
                  className="shrink-0 w-10 h-10 bg-pos-secondary text-white rounded-lg flex items-center justify-center hover:bg-pos-secondary/90 transition-colors" title="Add Customer">
                  <span className="material-symbols-outlined">person_add</span>
                </button>
              </div>
            </div>

            {/* Walking Customer inline fields */}
            {isWalkingCustomer && (
              <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={walkingName} onChange={e => setWalkingName(e.target.value)}
                    className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" placeholder="Customer Name" />
                  <input value={walkingPhone} onChange={e => setWalkingPhone(e.target.value)}
                    className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" placeholder="Mobile" />
                  <input value={walkingAddress} onChange={e => setWalkingAddress(e.target.value)}
                    className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" placeholder="Address" />
                </div>
              </div>
            )}

            {/* Product search + Stock */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant">search</span>
                <input ref={searchRef} value={productSearch} onChange={e => {
                  setProductSearch(e.target.value);
                  setSelectedProductId(null);
                }}
                  className="w-full bg-[hsl(0,80%,92%)] border-2 border-pos-secondary/30 rounded-xl text-sm py-3 pl-11 pr-4 outline-none focus:border-pos-secondary transition-colors placeholder:text-pos-on-surface-variant/70"
                  placeholder="Search the Product..." />
                {/* Search dropdown */}
                {productSearch && !selectedProductId && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-xl z-50 max-h-[200px] overflow-y-auto">
                    {displayProducts.length > 0 ? displayProducts.slice(0, 15).map(p => (
                      <button key={p.id} type="button" onClick={() => {
                        setSelectedProductId(p.id);
                        setProductSearch(p.name);
                        setManualRate(String(p.pricePerBox));
                        setManualCarton(0); setManualPiece(0); setManualSqft(0);
                      }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex justify-between items-center">
                        <span className="font-medium">{p.name} {p.size && <span className="text-muted-foreground">({p.size})</span>}</span>
                        <span className="text-muted-foreground text-[10px]">Stock: {isSqftUnit(p.unit) ? formatStockDisplay(p.stock, p.piecesPerBox || 4) : `${p.stock} ${p.unit || 'Pcs'}`}</span>
                      </button>
                    )) : (
                      <div className="px-3 py-3 text-xs text-muted-foreground text-center">No products found</div>
                    )}
                  </div>
                )}
              </div>
              <div className="w-28 bg-pos-surface-high border border-pos-surface-container rounded-xl py-3 px-2 text-center font-bold text-xs text-pos-on-surface">
                {selectedProduct ? (isSqftUnit(selectedProduct.unit) ? formatStockDisplay(selectedProduct.stock, selectedProduct.piecesPerBox || 4) : `${selectedProduct.stock} ${selectedProduct.unit || 'Pcs'}`) : 'Stock'}
              </div>
            </div>

            {/* Manual entry: conditional by unit type */}
            <div className="flex flex-wrap items-center gap-3">
              {isSelectedSqft ? (
                <>
                  <div className="flex items-center border-2 border-pos-surface-container rounded-lg overflow-hidden">
                    <span className="text-xs font-bold text-pos-on-surface-variant uppercase bg-pos-surface-high px-4 py-3.5 shrink-0 tracking-wide">Carton</span>
                    <input type="number" min={0} value={manualCarton} onChange={e => handleManualCartonChange(parseInt(e.target.value) || 0)}
                      className="w-20 bg-pos-surface-lowest text-base text-center outline-none py-3.5 px-2 font-semibold" />
                  </div>
                  <div className="flex items-center border-2 border-pos-surface-container rounded-lg overflow-hidden">
                    <span className="text-xs font-bold text-pos-on-surface-variant uppercase bg-pos-surface-high px-4 py-3.5 shrink-0 tracking-wide">Piece</span>
                    <input type="number" min={0} value={manualPiece} onChange={e => handleManualPieceChange(parseInt(e.target.value) || 0)}
                      onBlur={handlePieceBlur}
                      className="w-20 bg-pos-surface-lowest text-base text-center outline-none py-3.5 px-2 font-semibold" />
                  </div>
                  <div className="flex items-center border-2 border-pos-surface-container rounded-lg overflow-hidden flex-1 min-w-[160px]">
                    <span className="text-xs font-bold text-pos-on-surface-variant uppercase bg-pos-surface-high px-4 py-3.5 shrink-0 tracking-wide">Sqft.</span>
                    <input type="number" min={0} value={manualSqft} onChange={e => handleManualSqftChange(parseFloat(e.target.value) || 0)}
                      className="w-full bg-pos-surface-lowest text-base text-center outline-none py-3.5 px-2 font-semibold" />
                  </div>
                </>
              ) : (
                <div className="flex items-center border-2 border-pos-surface-container rounded-lg overflow-hidden">
                  <span className="text-xs font-bold text-pos-on-surface-variant uppercase bg-pos-surface-high px-4 py-3.5 shrink-0 tracking-wide">Qty</span>
                  <input type="number" min={1} value={manualPiece || ''} onChange={e => handleManualQtyChange(parseInt(e.target.value) || 0)}
                    className="w-24 bg-pos-surface-lowest text-base text-center outline-none py-3.5 px-2 font-semibold" placeholder="0" />
                  <span className="text-xs text-muted-foreground px-3 bg-pos-surface-high py-3.5">{selectedProduct?.unit || 'Pcs'}</span>
                </div>
              )}
              <div className="flex items-center border-2 border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-xs font-bold text-pos-on-surface-variant uppercase bg-pos-surface-high px-4 py-3.5 shrink-0 tracking-wide">Rate</span>
                <input type="number" value={manualRate} onChange={e => setManualRate(e.target.value)} placeholder="৳"
                  className="w-28 bg-pos-surface-lowest text-base text-center outline-none py-3.5 px-2 font-semibold" />
              </div>
              <button onClick={manualAddProduct}
                className="px-8 py-3.5 bg-pos-error text-white rounded-lg font-bold text-base hover:bg-pos-error/90 transition-colors tracking-wide">
                Add
              </button>
            </div>

            {/* Cart table — only added items */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-[10px] font-bold text-white uppercase tracking-wider bg-[hsl(230,45%,35%)]">
                      <th className="px-2 py-2.5 w-8"><span className="material-symbols-outlined text-sm">delete</span></th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5 text-center">Qty / Carton</th>
                      <th className="px-3 py-2.5 text-center">Piece</th>
                      <th className="px-3 py-2.5 text-center">Sqft./Qty.</th>
                      <th className="px-3 py-2.5 text-right">Rate</th>
                      <th className="px-3 py-2.5 text-right">Sub Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {items.map(item => {
                      const itemProduct = products.find(p => p.id === item.productId);
                      const itemIsSqft = itemProduct ? isSqftUnit(itemProduct.unit) : true;
                      return (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked onChange={() => removeItem(item.id)}
                            className="w-4 h-4 rounded border-pos-surface-container accent-pos-secondary cursor-pointer" />
                        </td>
                        <td className="px-1 py-1">
                          <select value={item.itemType} onChange={e => updateItem(item.id, 'itemType', e.target.value)}
                            className="bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-xs py-1.5 px-1 outline-none">
                            <option>Sale</option><option>Return</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-sm font-medium">
                          {item.name}
                          {!itemIsSqft && <span className="text-[10px] ml-1 text-muted-foreground">({itemProduct?.unit})</span>}
                        </td>
                        {itemIsSqft ? (
                          <>
                            <td className="px-1 py-1">
                              <input type="number" min={0} value={item.carton} onChange={e => updateItem(item.id, 'carton', parseInt(e.target.value) || 0)}
                                className="w-16 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                            </td>
                            <td className="px-1 py-1">
                              <input type="number" min={0} value={item.piece} onChange={e => updateItem(item.id, 'piece', parseInt(e.target.value) || 0)}
                                className="w-14 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                            </td>
                            <td className="px-3 py-2 text-center text-sm">{item.sqftQty > 0 ? item.sqftQty.toFixed(3) : '0'}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-1 py-1">
                              <input type="number" min={1} value={item.piece} onChange={e => updateItem(item.id, 'piece', parseInt(e.target.value) || 0)}
                                className="w-16 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                            </td>
                            <td className="px-3 py-2 text-center text-sm text-muted-foreground">—</td>
                            <td className="px-3 py-2 text-center text-sm text-muted-foreground">—</td>
                          </>
                        )}
                        <td className="px-1 py-1">
                          <input type="number" value={item.salesRate} onChange={e => updateItem(item.id, 'salesRate', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-right outline-none focus:border-pos-secondary ml-auto block" />
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-sm">{formatCurrency(item.subTotal)}</td>
                      </tr>
                      );
                    })}
                    {items.length === 0 && (
                      <tr><td colSpan={9} className="px-8 py-12 text-center text-sm text-pos-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl mb-2 block opacity-30">search</span>
                        সার্চ করে প্রোডাক্ট যোগ করুন
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom: Remark, Status, Delivery, Sales Man, Send SMS */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
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
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-pos-on-surface-variant uppercase">Delivery</span>
                  <select value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)}
                    className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none">
                    <option>Complete</option><option>Partial</option><option>Pending</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-pos-on-surface-variant uppercase">Sales Man</span>
                  <select value={salesMan} onChange={e => setSalesMan(e.target.value)}
                    className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none">
                    <option value="">Select</option>
                    <option>{settings.userName || 'Owner'}</option>
                  </select>
                </div>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-pos-secondary" checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)} />
                  <span className="material-symbols-outlined text-[16px] text-green-600">chat</span>
                  WhatsApp
                </label>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Summary sidebar (matching Purchase page style) ── */}
          <div className="w-full lg:w-[300px] shrink-0">
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4 space-y-3 sticky top-4">
              {/* TOTAL */}
              <div className="flex items-center border border-pos-surface-container rounded-lg">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Total</span>
                <span className="flex-1 text-right text-lg font-black text-pos-on-surface px-3">{formatCurrency(total)}</span>
              </div>
              {/* RETURN (auto from cart Return items) */}
              <div className="flex items-center border border-pos-surface-container rounded-lg">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase flex items-center gap-1">Return <InfoTooltip text="রিটার্ন আইটেমের মোট মূল্য। কার্টে Return টাইপ সিলেক্ট করলে এখানে অটো যোগ হয়।" /></span>
                <span className={`flex-1 text-right text-lg font-black px-3 ${returnVal > 0 ? 'text-pos-error' : 'text-pos-on-surface'}`}>{formatCurrency(returnVal)}</span>
              </div>
              {/* DISCOUNT with ৳/% toggle */}
              <div className="flex items-center border border-pos-surface-container rounded-lg">
                <button onClick={() => setDiscountType(discountType === 'flat' ? 'percent' : 'flat')}
                  className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase cursor-pointer hover:bg-pos-surface-high transition-colors rounded-l-lg select-none">
                  {discountType === 'flat' ? 'Dis. ৳' : 'Dis. %'}
                </button>
                <input type="number" min={0} step="any" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                  className="flex-1 min-w-0 text-sm py-3 px-3 outline-none bg-pos-surface-lowest rounded-r-lg text-right" />
              </div>
              {/* LABOUR */}
              <div className="flex items-center border border-pos-surface-container rounded-lg">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase flex items-center gap-1">Labour <InfoTooltip text="রাজমিস্ত্রি বা শ্রমিকের খরচ। এটি Payable এর সাথে যোগ হবে।" /></span>
                <input type="number" min={0} step="any" value={labourCost} onChange={e => setLabourCost(e.target.value)} placeholder="0"
                  className="flex-1 min-w-0 text-sm py-3 px-3 outline-none bg-pos-surface-lowest rounded-r-lg text-right" />
              </div>
              {/* PAYABLE */}
              <div className="flex items-center border-2 border-pos-secondary rounded-lg bg-pos-secondary/5">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase flex items-center gap-1">Payable <InfoTooltip text="Total − Return − Discount − Less + Delivery + Labour = কাস্টমারকে যত টাকা দিতে হবে।" /></span>
                <span className={`flex-1 text-right text-lg font-black px-3 ${payable < 0 ? 'text-destructive' : 'text-pos-secondary'}`}>{formatCurrency(payable)}</span>
              </div>
              {/* PAID */}
              <div className="flex items-center border border-pos-surface-container rounded-lg">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Paid</span>
                <input type="number" step="any" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0"
                  className="flex-1 min-w-0 text-sm py-3 px-3 outline-none bg-pos-surface-lowest rounded-r-lg text-right font-bold" />
              </div>
              {/* DUE */}
              <div className="flex items-center border border-pos-surface-container rounded-lg">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase flex items-center gap-1">Due <InfoTooltip text="Payable − Paid = এই বিলে যত টাকা বাকি।" /></span>
                <span className={`flex-1 text-right text-lg font-black px-3 ${dueVal > 0 ? 'text-destructive' : dueVal < 0 ? 'text-[hsl(125,60%,35%)]' : 'text-pos-on-surface'}`}>{formatCurrency(dueVal)}</span>
              </div>
              {/* TOTAL DUE (Due + Previous Dues) */}
              <div className="flex items-center border border-pos-surface-container rounded-lg">
                <span className="text-[11px] font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase leading-tight flex items-center gap-1">Total Due <InfoTooltip text="এই বিলের Due + আগের বাকি (Previous Dues) = কাস্টমারের কাছে সর্বমোট পাওনা।" /></span>
                <span className={`flex-1 text-right text-lg font-black px-3 ${balanceVal < 0 ? 'text-[hsl(125,60%,35%)]' : balanceVal > 0 ? 'text-destructive' : 'text-pos-on-surface'}`}>{formatCurrency(balanceVal)}</span>
              </div>
              {/* MODE */}
              <div className="flex items-center border border-pos-surface-container rounded-lg">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Mode</span>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
                  className="flex-1 text-sm py-3 px-3 outline-none bg-pos-surface-lowest rounded-r-lg">
                  <option>Cash</option><option>bKash</option><option>Nagad</option><option>Card</option><option>Credit</option>
                </select>
              </div>
              {/* Send SMS */}
              <label className="flex items-center gap-2 text-sm cursor-pointer px-1 py-1">
                <input type="checkbox" className="w-4 h-4 accent-pos-secondary" defaultChecked />
                <span className="font-medium">Send SMS</span>
              </label>
              {/* Save */}
              <button onClick={handleSave}
                className="w-full py-3 bg-pos-secondary hover:bg-pos-secondary/90 text-white rounded-xl font-bold text-base transition-colors mt-2 shadow-lg">
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Add Customer Modal */}
        {showAddCustomerModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]" onClick={() => setShowAddCustomerModal(false)}>
            <div className="bg-pos-surface-lowest rounded-xl w-[420px] shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-pos-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-pos-secondary">person_add</span>
                </div>
                <h3 className="text-lg font-bold">Add New Customer</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-pos-on-surface-variant mb-1">Full Name *</label>
                  <input value={newCustName} onChange={e => setNewCustName(e.target.value)}
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" placeholder="Customer Name" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-pos-on-surface-variant mb-1">Mobile</label>
                  <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" placeholder="01XXXXXXXXX" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-pos-on-surface-variant mb-1">Customer Type</label>
                  <select value={newCustType} onChange={e => setNewCustType(e.target.value)}
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none">
                    <option>General Customer</option><option>Retailer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-pos-on-surface-variant mb-1">Address</label>
                  <input value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)}
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" placeholder="Address" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowAddCustomerModal(false)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">Cancel</button>
                <button onClick={handleSaveNewCustomer} className="flex-1 py-2.5 bg-pos-secondary text-white rounded-lg font-semibold text-sm">Save</button>
              </div>
            </div>
          </div>
        )}
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
          <h2 className="text-2xl font-bold text-pos-on-surface tracking-tight">
            <span className="text-pos-secondary">Sales</span>
            <span className="mx-2 text-pos-on-surface-variant">›</span>Sales History
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="px-4 py-2.5 bg-pos-surface-container text-pos-on-surface rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-pos-surface-high transition-colors">
            <span className="material-symbols-outlined text-lg">download</span>Export
          </button>
          <div className="flex gap-1 bg-pos-surface-container rounded-lg p-1">
            <button onClick={openAddSale} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 text-pos-on-surface-variant hover:bg-pos-surface-high transition-colors">
              <span className="material-symbols-outlined text-base">add</span>Add Sales
            </button>
            <button className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 bg-pos-secondary text-white shadow">
              <span className="material-symbols-outlined text-base">folder_open</span>Sales History
            </button>
          </div>
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
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pos-error/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-pos-error">delete</span>
              </div>
              <h3 className="text-lg font-bold">Delete Sale?</h3>
            </div>
            <p className="text-sm text-pos-on-surface-variant mb-4">This action cannot be undone.</p>
            
            {/* Return All Stock - mandatory, non-interactive */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-pos-tertiary-container/30 border border-pos-tertiary-container mb-6 animate-[pulse_1.5s_ease-in-out_2]">
              <Checkbox checked disabled className="h-5 w-5 border-2 border-pos-tertiary data-[state=checked]:bg-pos-tertiary data-[state=checked]:border-pos-tertiary opacity-100" />
              <div>
                <span className="text-sm font-semibold text-pos-on-tertiary-container">Return All Stock</span>
                <p className="text-xs text-pos-on-surface-variant mt-0.5">ডিলিট করলে সব প্রোডাক্ট স্টকে ফেরত যাবে</p>
              </div>
              <span className="material-symbols-outlined text-pos-tertiary ml-auto animate-bounce text-lg">inventory</span>
            </div>

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
