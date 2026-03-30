import { useState, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextPurchaseNumber, type Product, type Supplier, type PurchaseRecord, type PurchaseItem, type CompanySettings } from "@/lib/store";
import { calcSqftQty, calcCartonPieceFromSqft, calcSubTotal, isSqftUnit, cartonPieceToTotalPieces, formatStockDisplay } from "@/lib/calc-utils";
import ComboInput from "@/components/ComboInput";
import { toast } from "sonner";

interface PurchaseScreenProps {
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  onAddPurchase: (p: PurchaseRecord) => void;
  onDeletePurchase: (id: string) => void;
  onUpdatePurchase: (p: PurchaseRecord) => void;
  onAddStock: (items: { productId: string; qty: number }[]) => void;
  onUpdateSupplierDue: (name: string, dueAmount: number) => void;
  settings?: CompanySettings;
}

const PAGE_SIZES = [10, 25, 50, 100];
type SortField = 'invoice' | 'date' | 'supplierName' | 'qty' | 'sqft' | 'payable' | 'paid' | 'due';

// ── Item row for Add Purchase ──
interface PurchaseItemRow {
  id: number;
  productId: string;
  barcode: string;
  name: string;
  stock: number;
  carton: number;
  piece: number;
  sqftQty: number;
  buyRate: number;
  subTotal: number;
}

export default function PurchaseScreen({ products, suppliers, purchases, onAddPurchase, onDeletePurchase, onUpdatePurchase, onAddStock, onUpdateSupplierDue, settings }: PurchaseScreenProps) {
  const { t } = useI18n();

  // ── View toggle ──
  const [view, setView] = useState<'history' | 'add'>('add');

  // ══════ HISTORY VIEW STATE ══════
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ══════ EDIT MODAL STATE ══════
  const [editPurchase, setEditPurchase] = useState<PurchaseRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editInvoice, setEditInvoice] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editItems, setEditItems] = useState<PurchaseItemRow[]>([]);
  const [editDiscount, setEditDiscount] = useState('');
  const [editDelivery, setEditDelivery] = useState('');
  const [editPaid, setEditPaid] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [editProductSearch, setEditProductSearch] = useState('');
  const debouncedEditSearch = useDebounce(editProductSearch, 200);

  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [items, setItems] = useState<PurchaseItemRow[]>([]);
  const [discount, setDiscount] = useState('');
  const [delivery, setDelivery] = useState('');
  const [paid, setPaid] = useState('');
  const [remark, setRemark] = useState('');
  const [account, setAccount] = useState('Cash');
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
    const list = purchases.filter(p =>
      p.invoice.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'invoice') cmp = a.invoice.localeCompare(b.invoice);
      else if (sortField === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === 'supplierName') cmp = a.supplierName.localeCompare(b.supplierName);
      else if (sortField === 'qty') cmp = a.items.reduce((s, i) => s + i.carton + i.piece, 0) - b.items.reduce((s, i) => s + i.carton + i.piece, 0);
      else if (sortField === 'sqft') cmp = a.items.reduce((s, i) => s + (i.sqftQty || 0), 0) - b.items.reduce((s, i) => s + (i.sqftQty || 0), 0);
      else if (sortField === 'payable') cmp = a.payable - b.payable;
      else if (sortField === 'paid') cmp = a.paid - b.paid;
      else if (sortField === 'due') cmp = a.due - b.due;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [purchases, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => filtered.slice(page * pageSize, (page + 1) * pageSize), [filtered, page, pageSize]);

  // ── Add Purchase helpers ──
  const debouncedProductSearch = useDebounce(productSearch, 200);
  const [showRecent, setShowRecent] = useState(false);

  // Search results (dropdown-like) — only when actively searching
  const searchResults = useMemo(() => {
    if (!debouncedProductSearch) return [];
    return products.filter(p =>
      !items.find(i => i.productId === p.id) && (
        p.name.toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
        (p.barcode || '').toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
        p.batch.toLowerCase().includes(debouncedProductSearch.toLowerCase())
      )
    );
  }, [products, debouncedProductSearch, items]);

  // Recent products for quick-add modal
  const recentProducts = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return products.filter(p =>
      !items.find(i => i.productId === p.id) &&
      new Date(p.createdAt || 0).getTime() >= sevenDaysAgo
    );
  }, [products, items]);

  // Table only shows items already added to cart
  const displayProducts = useMemo(() => {
    return items.map(i => products.find(p => p.id === i.productId)).filter(Boolean) as Product[];
  }, [items, products]);

  const addProductToItems = (product: Product) => {
    if (items.find(i => i.productId === product.id)) {
      toast.error('Already added');
      return;
    }
    const rate = product.buyRate || 0;
    if (isSqftUnit(product.unit)) {
      const initSqft = calcSqftQty(product, 1, 0);
      const initSubTotal = calcSubTotal(product, 1, 0, rate);
      setItems(prev => [...prev, {
        id: Date.now(), productId: product.id, barcode: product.barcode || product.batch || '',
        name: product.name, stock: product.stock, carton: 1, piece: 0,
        sqftQty: initSqft, buyRate: rate, subTotal: initSubTotal,
      }]);
    } else {
      // Non-SQFT: simple qty × rate
      setItems(prev => [...prev, {
        id: Date.now(), productId: product.id, barcode: product.barcode || product.batch || '',
        name: product.name, stock: product.stock, carton: 0, piece: 1,
        sqftQty: 1, buyRate: rate, subTotal: rate,
      }]);
    }
    setProductSearch('');
    searchRef.current?.focus();
  };

  const updateItem = (id: number, field: keyof PurchaseItemRow, value: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      const product = products.find(p => p.id === item.productId);
      if (!product) return updated;

      if (isSqftUnit(product.unit)) {
        if (field === 'sqftQty') {
          const { carton, piece } = calcCartonPieceFromSqft(product, value);
          updated.carton = carton;
          updated.piece = piece;
          updated.sqftQty = value;
        } else {
          updated.sqftQty = calcSqftQty(product, updated.carton, updated.piece);
        }
        updated.subTotal = calcSubTotal(product, updated.carton, updated.piece, updated.buyRate);
      } else {
        // Non-SQFT: piece = qty
        if (field === 'piece') {
          updated.sqftQty = value;
          updated.carton = 0;
        }
        updated.subTotal = updated.piece * updated.buyRate;
      }
      return updated;
    }));
  };

  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  const total = items.reduce((s, i) => s + i.subTotal, 0);
  const discountVal = parseFloat(discount) || 0;
  const deliveryVal = parseFloat(delivery) || 0;
  const payable = Math.max(0, total - discountVal + deliveryVal);
  const paidVal = parseFloat(paid) || 0;
  const dueVal = Math.max(0, payable - paidVal);

  const openAddPurchase = () => {
    setView('add');
    setInvoiceNo(getNextPurchaseNumber());
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSupplierName('');
    setItems([]);
    setDiscount(''); setDelivery(''); setPaid(''); setRemark(''); setAccount('Cash');
  };

  const handleSave = () => {
    if (!supplierName.trim()) { toast.error('Supplier সিলেক্ট করুন'); return; }
    if (!items.length) { toast.error('কমপক্ষে একটি প্রোডাক্ট যোগ করুন'); return; }

    const purchaseItems: PurchaseItem[] = items.map(i => ({
      productId: i.productId, name: i.name, barcode: i.barcode,
      carton: i.carton, piece: i.piece, sqftQty: i.sqftQty,
      buyRate: i.buyRate, subTotal: i.subTotal,
    }));

    const purchase: PurchaseRecord = {
      id: crypto.randomUUID(), invoice: invoiceNo, supplierName,
      date: new Date(purchaseDate).toISOString(), items: purchaseItems,
      total, discount: discountVal, delivery: deliveryVal,
      payable, paid: paidVal, due: dueVal, remark,
    };

    onAddPurchase(purchase);
    // Stock addition: total pieces
    onAddStock(items.map(i => {
      const p = products.find(x => x.id === i.productId);
      if (p && !isSqftUnit(p.unit)) {
        // Non-SQFT: qty = piece directly
        return { productId: i.productId, qty: Math.max(1, i.piece) };
      }
      const piecesPerBox = p?.piecesPerBox || 4;
      const totalPieces = cartonPieceToTotalPieces(i.carton, i.piece, piecesPerBox);
      return { productId: i.productId, qty: Math.max(1, totalPieces) };
    }));
    if (dueVal > 0) onUpdateSupplierDue(supplierName, dueVal);
    toast.success('Purchase saved successfully');
    setView('history');
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) { onDeletePurchase(showDeleteConfirm); toast.success('Purchase deleted'); }
    setShowDeleteConfirm(null);
  };

  const viewPurchase = purchases.find(p => p.id === viewId);

  // ══════ DIRECT PRINT (no modal) ══════
  const handlePrintInvoice = (p: PurchaseRecord) => {
    const sup = suppliers.find(s => s.name === p.supplierName);
    const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };
    const fc = (n: number) => `৳${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

    // Number to words (Taka)
    const numToWords = (num: number): string => {
      if (num === 0) return 'Zero Taka Only';
      const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      const scales = ['','Thousand','Lakh','Crore'];
      const n = Math.round(Math.abs(num));
      if (n === 0) return 'Zero Taka Only';
      const convert = (n: number): string => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      };
      // Indian numbering: last 3, then groups of 2
      const parts: number[] = [];
      let rem = n;
      parts.push(rem % 1000); rem = Math.floor(rem / 1000);
      while (rem > 0) { parts.push(rem % 100); rem = Math.floor(rem / 100); }
      const words = parts.map((p, i) => p > 0 ? convert(p) + (scales[i] ? ' ' + scales[i] : '') : '').reverse().filter(Boolean).join(' ');
      return words + ' Taka Only';
    };

    const productMap = new Map(products.map(pr => [pr.id, pr]));
    const itemRows = p.items.map((item, i) => {
      const prod = productMap.get(item.productId);
      return `
      <tr style="${i % 2 === 0 ? '' : 'background:#fafafa;'}">
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${item.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${prod?.category || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${prod?.size || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.carton}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.piece}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.sqftQty ? item.sqftQty.toFixed(2) : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${fc(item.buyRate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${fc(item.subTotal)}</td>
      </tr>`;
    }).join('');

    const totalDueToSupplier = sup?.totalDue ?? 0;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
       body { font-family:'Inter',sans-serif; color:#1a1a1a; padding:8mm 10mm; background:white; }
       @page { size:A4; margin:8mm 10mm; }
      .header { text-align:center; border-bottom:3px solid #1a1a1a; padding-bottom:12px; margin-bottom:16px; }
      .header h1 { font-size:20px; font-weight:900; text-transform:uppercase; letter-spacing:1px; }
      .header .sub { font-size:11px; color:#555; margin-top:2px; }
      .badge { display:inline-block; background:#1a1a1a; color:white; font-size:11px; font-weight:700; padding:3px 16px; margin-top:8px; letter-spacing:1px; }
      .info-grid { display:flex; justify-content:space-between; font-size:11px; margin-bottom:14px; }
      .info-grid .label { font-weight:700; color:#6b7280; text-transform:uppercase; font-size:10px; }
      .info-grid .val { font-weight:600; color:#1a1a1a; }
      table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px; }
      thead tr { background:#1a1a1a; color:white; }
      thead th { padding:7px 8px; font-weight:700; font-size:10px; text-transform:uppercase; }
      .summary-row { display:flex; justify-content:space-between; margin-bottom:20px; }
       .summary-left { font-size:11px; flex:1; max-width:240px; }
       .due-box { border:1.5px solid #d1d5db; padding:8px 12px; margin-bottom:10px; }
       .due-box .due-row { display:flex; justify-content:space-between; padding:3px 0; font-weight:600; }
       .due-box .due-row .lbl { color:#1a1a1a; font-weight:600; }
       .due-box .due-row .val { font-weight:700; }
       .extra-info { font-size:11px; margin-top:6px; }
       .extra-info .info-line { margin-bottom:3px; }
       .extra-info .info-label { color:#dc2626; font-weight:700; }
       .extra-info .info-val { font-weight:900; }
       .summary-right { width:240px; font-size:11px; }
      .summary-right .item { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #e5e7eb; }
      .summary-right .payable { display:flex; justify-content:space-between; padding:8px 0; border-top:2px solid #1a1a1a; border-bottom:2px solid #1a1a1a; font-size:13px; font-weight:900; margin:4px 0; }
      .green { color:#15803d; font-weight:700; }
      .red { color:#dc2626; font-weight:700; }
      .remark { font-size:11px; border-top:1px solid #ddd; padding-top:8px; margin-top:8px; }
      .footer { display:flex; justify-content:space-between; font-size:9px; color:#9ca3af; margin-top:24px; border-top:1px solid #e5e7eb; padding-top:8px; }
    </style></head><body>
      <div class="header">
        <h1>${settings?.name || 'Shop Name'}</h1>
        ${settings?.address ? `<div class="sub">${settings.address}</div>` : ''}
        <div class="sub">${[settings?.phone ? '📞 ' + settings.phone : '', settings?.email ? '✉ ' + settings.email : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>
        <div class="badge">PURCHASE INVOICE</div>
      </div>

      <div class="info-grid">
        <div>
          <div><span class="label">Invoice #: </span><span class="val">${p.invoice}</span></div>
          <div><span class="label">Date: </span><span>${fmtDate(p.date)}</span></div>
        </div>
        <div style="text-align:right;">
          <div><span class="label">Supplier: </span><span class="val">${p.supplierName}</span></div>
          ${sup?.phone ? `<div><span class="label">Phone: </span><span>${sup.phone}</span></div>` : ''}
          ${sup?.address ? `<div><span class="label">Address: </span><span>${sup.address}</span></div>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
             <th style="text-align:left;">#</th>
             <th style="text-align:left;">Product</th>
             <th style="text-align:left;">Category</th>
             <th style="text-align:left;">Size</th>
             <th style="text-align:center;">Carton</th>
             <th style="text-align:center;">Piece</th>
             <th style="text-align:center;">Sqft/Qty</th>
             <th style="text-align:right;">Rate</th>
             <th style="text-align:right;">Sub Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="summary-row">
        <div class="summary-left">
          <div class="due-box">
            <div class="due-row"><span class="lbl">Due In This Bill:</span><span class="val ${p.due > 0 ? 'red' : ''}">${p.due > 0 ? fc(p.due) : '0/-'}</span></div>
            <div class="due-row"><span class="lbl">Previous Dues:</span><span class="val ${(totalDueToSupplier - p.due) > 0 ? 'red' : ''}">${(totalDueToSupplier - p.due) > 0 ? fc(totalDueToSupplier - p.due) : '0/-'}</span></div>
            <div class="due-row"><span class="lbl">Balance:</span><span class="val ${totalDueToSupplier > 0 ? 'red' : ''}">${totalDueToSupplier > 0 ? fc(totalDueToSupplier) : '0/-'}</span></div>
          </div>
          <div class="extra-info">
            ${p.remark ? `<div class="info-line"><span class="info-label">Remark:</span></div><div class="info-line">${p.remark}</div>` : `<div class="info-line"><span class="info-label">Remark:</span></div>`}
            <div class="info-line" style="margin-top:4px;"><span class="info-label">Total Quantity:</span> <span class="info-val">${p.items.reduce((s, it) => s + it.carton + it.piece, 0)}</span></div>
            <div class="info-line" style="margin-top:4px;"><span class="info-label">In Word:</span> <span class="info-val">${numToWords(p.payable)}</span></div>
          </div>
        </div>
        <div class="summary-right">
          <div class="item"><span style="color:#6b7280;">Sub Total</span><span style="font-weight:700;">${fc(p.total)}</span></div>
          ${p.discount > 0 ? `<div class="item"><span style="color:#6b7280;">Discount (−)</span><span class="red">−${fc(p.discount)}</span></div>` : ''}
          ${p.delivery > 0 ? `<div class="item"><span style="color:#6b7280;">Labour/Delivery (+)</span><span style="font-weight:700;">+${fc(p.delivery)}</span></div>` : ''}
          <div class="payable"><span>PAYABLE</span><span>${fc(p.payable)}</span></div>
          <div class="item"><span class="green">Paid</span><span class="green">${fc(p.paid)}</span></div>
          <div class="item"><span class="${p.due > 0 ? 'red' : 'green'}">Due</span><span class="${p.due > 0 ? 'red' : 'green'}">${fc(p.due)}</span></div>
        </div>
      </div>

      <div class="footer">
        <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
        <span>Powered by Dokani</span>
      </div>
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;left:-9999px;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 300);
      };
    }
  };

  // ══════ EDIT HELPERS ══════
  const openEditModal = (p: PurchaseRecord) => {
    setEditPurchase(p);
    setEditDate(new Date(p.date).toISOString().split('T')[0]);
    setEditInvoice(p.invoice);
    setEditSupplier(p.supplierName);
    setEditDiscount(p.discount > 0 ? String(p.discount) : '');
    setEditDelivery(p.delivery > 0 ? String(p.delivery) : '');
    setEditPaid(p.paid > 0 ? String(p.paid) : '');
    setEditRemark(p.remark || '');
    setEditProductSearch('');
    setEditItems(p.items.map((item, idx) => ({
      id: Date.now() + idx,
      productId: item.productId,
      barcode: item.barcode,
      name: item.name,
      stock: products.find(pr => pr.id === item.productId)?.stock || 0,
      carton: item.carton,
      piece: item.piece,
      sqftQty: item.sqftQty,
      buyRate: item.buyRate,
      subTotal: item.subTotal,
    })));
  };

  const editSearchResults = useMemo(() => {
    if (!debouncedEditSearch) return [];
    return products.filter(p =>
      !editItems.find(i => i.productId === p.id) && (
        p.name.toLowerCase().includes(debouncedEditSearch.toLowerCase()) ||
        (p.barcode || '').toLowerCase().includes(debouncedEditSearch.toLowerCase())
      )
    );
  }, [products, debouncedEditSearch, editItems]);

  const addEditProduct = (product: Product) => {
    if (editItems.find(i => i.productId === product.id)) return;
    const rate = product.buyRate || 0;
    const initSqft = isSqftUnit(product.unit) ? calcSqftQty(product, 1, 0) : 0;
    const initSubTotal = calcSubTotal(product, 1, 0, rate);
    setEditItems(prev => [...prev, {
      id: Date.now(), productId: product.id, barcode: product.barcode || product.batch || '',
      name: product.name, stock: product.stock, carton: 1, piece: 0,
      sqftQty: initSqft, buyRate: rate, subTotal: initSubTotal,
    }]);
    setEditProductSearch('');
  };

  const updateEditItem = (id: number, field: keyof PurchaseItemRow, value: number) => {
    setEditItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      const product = products.find(p => p.id === item.productId);
      if (!product) return updated;
      if (isSqftUnit(product.unit)) {
        if (field === 'sqftQty') {
          const { carton, piece } = calcCartonPieceFromSqft(product, value);
          updated.carton = carton; updated.piece = piece; updated.sqftQty = value;
        } else {
          updated.sqftQty = calcSqftQty(product, updated.carton, updated.piece);
        }
      }
      updated.subTotal = calcSubTotal(product, updated.carton, updated.piece, updated.buyRate);
      return updated;
    }));
  };

  const editTotal = editItems.reduce((s, i) => s + i.subTotal, 0);
  const editDiscountVal = parseFloat(editDiscount) || 0;
  const editDeliveryVal = parseFloat(editDelivery) || 0;
  const editPayable = Math.max(0, editTotal - editDiscountVal + editDeliveryVal);
  const editPaidVal = parseFloat(editPaid) || 0;
  const editDueVal = Math.max(0, editPayable - editPaidVal);

  const handleEditSave = () => {
    if (!editPurchase) return;
    if (!editSupplier.trim()) { toast.error('Supplier সিলেক্ট করুন'); return; }
    if (!editItems.length) { toast.error('কমপক্ষে একটি প্রোডাক্ট যোগ করুন'); return; }

    const updated: PurchaseRecord = {
      ...editPurchase,
      invoice: editInvoice,
      supplierName: editSupplier,
      date: new Date(editDate).toISOString(),
      items: editItems.map(i => ({
        productId: i.productId, name: i.name, barcode: i.barcode,
        carton: i.carton, piece: i.piece, sqftQty: i.sqftQty,
        buyRate: i.buyRate, subTotal: i.subTotal,
      })),
      total: editTotal, discount: editDiscountVal, delivery: editDeliveryVal,
      payable: editPayable, paid: editPaidVal, due: editDueVal, remark: editRemark,
    };
    onUpdatePurchase(updated);
    toast.success('Purchase updated');
    setEditPurchase(null);
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
  // ══════ ADD PURCHASE VIEW ══════
  // ══════════════════════════════════════
  if (view === 'add') {
    return (
      <section className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm mb-1">
              <span className="text-pos-secondary font-semibold">Purchase</span>
              <span className="text-pos-on-surface-variant">›</span>
              <span className="text-pos-secondary font-medium">Add Purchase</span>
            </div>
            <h2 className="text-2xl font-bold text-pos-on-surface tracking-tight">Purchase</h2>
          </div>
          <div className="flex gap-1 bg-pos-surface-container rounded-lg p-1">
            <button onClick={openAddPurchase} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 transition-colors bg-pos-secondary text-white shadow">
              <span className="material-symbols-outlined text-base">add</span>Add Purchase
            </button>
            <button onClick={() => setView('history')} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 transition-colors text-pos-on-surface-variant hover:bg-pos-surface-high">
              <span className="material-symbols-outlined text-base">folder_open</span>Purchase History
            </button>
          </div>
        </div>

        <div className="flex gap-4 flex-col lg:flex-row">
          {/* ── LEFT: Main form ── */}
          <div className="flex-1 space-y-4">
            {/* Top fields: Date, Invoice, Supplier */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Date</label>
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Invoice #</label>
                  <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-pos-on-surface-variant uppercase mb-1">Supplier *</label>
                  <ComboInput value={supplierName} onChange={setSupplierName} options={suppliers.map(s => s.name)} placeholder="Select Supplier..."
                    className="w-full bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
              </div>
            </div>

            {/* Product search + Recent button */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant">search</span>
                <input ref={searchRef} value={productSearch} onChange={e => { setProductSearch(e.target.value); setShowRecent(false); }}
                  className="w-full bg-[hsl(0,80%,92%)] border-2 border-pos-secondary/30 rounded-xl text-sm py-3 pl-11 pr-4 outline-none focus:border-pos-secondary transition-colors placeholder:text-pos-on-surface-variant/70"
                  placeholder="Search product by name or barcode..." />
                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-popover border border-border rounded-lg shadow-xl max-h-[220px] overflow-y-auto">
                    {searchResults.map(p => (
                      <button key={p.id} type="button" onClick={() => { addProductToItems(p); setProductSearch(''); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2 border-b border-border/50 last:border-0">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{p.barcode || p.batch || ''} | Stock: {formatStockDisplay(p.stock, p.piecesPerBox || 4)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setShowRecent(!showRecent)}
                className={`shrink-0 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-1.5 border-2 transition-colors ${showRecent ? 'bg-pos-secondary text-white border-pos-secondary' : 'bg-pos-surface-low text-pos-on-surface-variant border-pos-surface-container hover:border-pos-secondary'}`}>
                <span className="material-symbols-outlined text-base">schedule</span>
                Recent
              </button>
            </div>

            {/* Recent products popup */}
            {showRecent && (
              <div className="bg-pos-surface-lowest rounded-xl border-2 border-pos-secondary/30 p-3 max-h-[220px] overflow-y-auto">
                <div className="text-xs font-bold text-pos-on-surface-variant uppercase mb-2">সাম্প্রতিক প্রোডাক্ট (৭ দিন)</div>
                {recentProducts.length > 0 ? (
                  <div className="space-y-1">
                    {recentProducts.map(p => (
                      <button key={p.id} type="button" onClick={() => { addProductToItems(p); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-lg transition-colors flex items-center justify-between gap-2">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.barcode || ''} | Stock: {formatStockDisplay(p.stock, p.piecesPerBox || 4)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">সাম্প্রতিক কোনো প্রোডাক্ট নেই</p>
                )}
              </div>
            )}

            {/* All products table with checkbox */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-[10px] font-bold text-white uppercase tracking-wider bg-[hsl(230,45%,35%)]">
                      <th className="px-2 py-2.5 w-8 text-center"><span className="material-symbols-outlined text-sm">check_box</span></th>
                      <th className="px-3 py-2.5 text-left">Barcode</th>
                      <th className="px-3 py-2.5 text-center">Product Name</th>
                      <th className="px-3 py-2.5 text-center">Stock</th>
                      <th className="px-3 py-2.5 text-center">Qty / Carton</th>
                      <th className="px-3 py-2.5 text-center">Piece</th>
                      <th className="px-3 py-2.5 text-center">Sqft/Qty</th>
                      <th className="px-3 py-2.5 text-center">Buy Rate</th>
                      <th className="px-3 py-2.5 text-right">Sub Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {displayProducts.map(p => {
                      const item = items.find(i => i.productId === p.id);
                      const isSelected = !!item;
                      const pIsSqft = isSqftUnit(p.unit);
                      return (
                        <tr key={p.id} className={`transition-colors ${isSelected ? 'bg-[hsl(45,100%,96%)] dark:bg-[hsl(45,20%,12%)]' : 'hover:bg-muted/30'}`}>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked={isSelected}
                              onChange={() => isSelected ? removeItem(item!.id) : addProductToItems(p)}
                              className="w-4 h-4 rounded border-pos-surface-container accent-pos-secondary cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{p.barcode || p.batch || '—'}</td>
                          <td className="px-3 py-2 text-sm font-medium">
                            {p.name}
                            {!pIsSqft && <span className="text-[10px] ml-1 text-muted-foreground">({p.unit})</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-sm ${p.stock <= 0 ? 'text-pos-error font-bold' : ''}`}>
                              {pIsSqft ? formatStockDisplay(p.stock, p.piecesPerBox || 4) : `${p.stock} ${p.unit || 'Pcs'}`}
                            </span>
                          </td>
                          {isSelected ? (
                            pIsSqft ? (
                              <>
                                <td className="px-1 py-1">
                                  <input type="number" min={0} value={item!.carton} onChange={e => updateItem(item!.id, 'carton', parseInt(e.target.value) || 0)}
                                    className="w-16 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                                </td>
                                <td className="px-1 py-1">
                                  <input type="number" min={0} value={item!.piece} onChange={e => updateItem(item!.id, 'piece', parseInt(e.target.value) || 0)}
                                    className="w-14 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                                </td>
                                <td className="px-1 py-1">
                                  <input type="number" min={0} value={item!.sqftQty} onChange={e => updateItem(item!.id, 'sqftQty', parseFloat(e.target.value) || 0)}
                                    className="w-16 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-1 py-1">
                                  <input type="number" min={1} value={item!.piece} onChange={e => updateItem(item!.id, 'piece', parseInt(e.target.value) || 0)}
                                    className="w-16 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
                                </td>
                                <td className="px-3 py-2 text-center text-sm text-muted-foreground">—</td>
                                <td className="px-3 py-2 text-center text-sm text-muted-foreground">—</td>
                              </>
                            )
                          ) : (
                            <>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">0</td>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">—</td>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">—</td>
                            </>
                          )}
                          {isSelected ? (
                            <>
                              <td className="px-1 py-1">
                                <input type="number" value={item!.buyRate} onChange={e => updateItem(item!.id, 'buyRate', parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-right outline-none focus:border-pos-secondary ml-auto block" />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-sm">{formatCurrency(item!.subTotal)}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-right text-sm text-muted-foreground">{p.buyRate || 0}</td>
                              <td className="px-3 py-2 text-right text-sm text-muted-foreground">0.00</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {displayProducts.length === 0 && (
                      <tr><td colSpan={8} className="px-8 py-8 text-center text-sm text-pos-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl mb-2 block opacity-30">search</span>
                        সার্চ করে প্রোডাক্ট যোগ করুন
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Remark */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-pos-on-surface-variant uppercase shrink-0">Remark</span>
                <input value={remark} onChange={e => setRemark(e.target.value)}
                  className="flex-1 bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" placeholder="Optional note..." />
              </div>
            </div>
          </div>

          {/* ── RIGHT: Summary sidebar ── */}
          <div className="w-full lg:w-[300px] shrink-0">
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4 space-y-3 sticky top-4">
              {/* TOTAL */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Total</span>
                <span className="flex-1 text-right text-lg font-black text-pos-on-surface px-3">{formatCurrency(total)}</span>
              </div>

              {/* DIS. */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Dis.</span>
                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                  className="flex-1 text-sm py-3 px-3 outline-none bg-transparent text-right" />
              </div>

              {/* LABOUR */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Labour</span>
                <input type="number" value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="0"
                  className="flex-1 text-sm py-3 px-3 outline-none bg-transparent text-right" />
              </div>

              {/* PAYABLE */}
              <div className="flex items-center border-2 border-pos-secondary rounded-lg overflow-hidden bg-pos-secondary/5">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Payable</span>
                <span className="flex-1 text-right text-lg font-black text-pos-secondary px-3">{formatCurrency(payable)}</span>
              </div>

              {/* PAID */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Paid</span>
                <input type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0"
                  className="flex-1 text-sm py-3 px-3 outline-none bg-transparent text-right font-bold" />
              </div>

              {/* DUE */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Due</span>
                <span className={`flex-1 text-right text-lg font-black px-3 ${dueVal > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(dueVal)}</span>
              </div>

              {/* ACCOUNT */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-sm font-bold text-pos-secondary px-3 py-3 bg-pos-surface-low shrink-0 w-24 uppercase">Account</span>
                <select value={account} onChange={e => setAccount(e.target.value)}
                  className="flex-1 text-sm py-3 px-3 outline-none bg-transparent">
                  <option>Cash</option>
                  <option>Bank</option>
                  <option>bKash</option>
                  <option>Nagad</option>
                </select>
              </div>

              {/* Save button */}
              <button onClick={handleSave}
                className="w-full py-3 bg-pos-secondary hover:bg-pos-secondary/90 text-white rounded-xl font-bold text-base transition-colors mt-2 shadow-lg">
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
    <section className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm mb-1">
            <span className="text-pos-secondary font-semibold">Purchase</span>
            <span className="text-pos-on-surface-variant">›</span>
            <span className="text-pos-secondary font-medium">History</span>
          </div>
          <h2 className="text-2xl font-bold text-pos-on-surface tracking-tight">Purchase</h2>
        </div>
        <div className="flex gap-1 bg-pos-surface-container rounded-lg p-1">
          <button onClick={openAddPurchase} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 transition-colors text-pos-on-surface-variant hover:bg-pos-surface-high">
            <span className="material-symbols-outlined text-base">add</span>Add Purchase
          </button>
          <button onClick={() => setView('history')} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 transition-colors bg-pos-secondary text-white shadow">
            <span className="material-symbols-outlined text-base">folder_open</span>Purchase History
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm overflow-hidden border border-pos-surface-container">
        {/* Controls */}
        <div className="px-4 py-3 bg-pos-surface-low flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-pos-surface-container">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-pos-on-surface-variant">Show</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} className="bg-pos-surface-high border border-pos-surface-container rounded px-2 py-1 text-xs outline-none">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-pos-on-surface-variant">entries</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-pos-on-surface-variant">Search:</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-44 bg-pos-surface-high border border-pos-surface-container rounded px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-pos-secondary" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-wider bg-pos-surface-low border-b-2 border-pos-secondary/30">
                <SortHeader field="invoice">Invoice #</SortHeader>
                <SortHeader field="date">Date</SortHeader>
                <SortHeader field="supplierName">Supplier</SortHeader>
                <th className="px-4 py-3 text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-wider">Size</th>
                <SortHeader field="qty">Carton</SortHeader>
                <th className="px-4 py-3 text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-wider text-center">Piece</th>
                <SortHeader field="sqft">Sqft Qty</SortHeader>
                <SortHeader field="payable" align="text-right">Total</SortHeader>
                <SortHeader field="paid" align="text-right">Paid</SortHeader>
                <SortHeader field="due" align="text-right">Due</SortHeader>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginated.map(p => {
                const totalCarton = p.items.reduce((s, i) => s + (i.carton || 0), 0);
                const totalPiece = p.items.reduce((s, i) => s + (i.piece || 0), 0);
                const totalSqft = p.items.reduce((s, i) => s + (i.sqftQty || 0), 0);
                // Lookup category/size from products
                const productMap = new Map(products.map(pr => [pr.id, pr]));
                const categories = [...new Set(p.items.map(i => productMap.get(i.productId)?.category).filter(Boolean))];
                const sizes = [...new Set(p.items.map(i => productMap.get(i.productId)?.size).filter(Boolean))];
                return (
                  <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-pos-secondary">{p.invoice}</td>
                    <td className="px-4 py-3 text-sm">{(() => { try { return new Date(p.date).toLocaleDateString('en-GB'); } catch { return p.date; } })()}</td>
                    <td className="px-4 py-3 text-sm font-medium">{p.supplierName}</td>
                    <td className="px-4 py-3 text-xs">{categories.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-xs">{sizes.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-sm text-center">{totalCarton}</td>
                    <td className="px-4 py-3 text-sm text-center">{totalPiece}</td>
                    <td className="px-4 py-3 text-sm text-center">{totalSqft > 0 ? totalSqft.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(p.payable)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-[hsl(125,60%,35%)]">{formatCurrency(p.paid)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${p.due > 0 ? 'text-destructive' : ''}`}>{formatCurrency(p.due)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handlePrintInvoice(p)} className="w-7 h-7 rounded bg-[hsl(125,60%,35%)] text-white flex items-center justify-center" title="Print">
                          <span className="material-symbols-outlined text-sm">print</span>
                        </button>
                        <button onClick={() => openEditModal(p)} className="w-7 h-7 rounded bg-pos-secondary text-white flex items-center justify-center" title="Edit">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => setShowDeleteConfirm(p.id)} className="w-7 h-7 rounded bg-pos-error text-white flex items-center justify-center" title="Delete">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={12} className="px-8 py-8 text-center text-sm text-pos-on-surface-variant">No purchases yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-pos-surface-low border-t border-pos-surface-container flex justify-between items-center">
          <span className="text-xs text-pos-on-surface-variant">
            Showing {filtered.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} entries
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs font-medium bg-pos-surface-container rounded disabled:opacity-40 hover:bg-pos-surface-high transition-colors">Previous</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={`w-8 h-8 text-xs font-bold rounded ${page === i ? 'bg-pos-secondary text-white' : 'bg-pos-surface-container text-pos-on-surface-variant hover:bg-pos-surface-high'}`}>{i + 1}</button>
            )).slice(Math.max(0, page - 2), page + 3)}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-xs font-medium bg-pos-surface-container rounded disabled:opacity-40 hover:bg-pos-surface-high transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* Purchase print handled via iframe — no modal needed */}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-pos-on-error-container">delete</span>
              </div>
              <h3 className="text-lg font-bold">Delete Purchase</h3>
            </div>
            <p className="text-sm text-pos-on-surface-variant mb-6">Are you sure?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-pos-surface-container rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Purchase Modal */}
      {editPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4" onClick={() => setEditPurchase(null)}>
          <div className="bg-background rounded-xl w-[95vw] max-w-[900px] max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Edit Purchase #{editPurchase.invoice}</h3>
              <button onClick={() => setEditPurchase(null)} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center">
                <span className="material-symbols-outlined text-muted-foreground">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Top fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Date</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Invoice #</label>
                  <input value={editInvoice} onChange={e => setEditInvoice(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Supplier *</label>
                  <ComboInput value={editSupplier} onChange={setEditSupplier} options={suppliers.map(s => s.name)} placeholder="Select Supplier..."
                    className="w-full bg-muted border border-border rounded-lg text-sm py-2.5 px-3 outline-none" />
                </div>
              </div>

              {/* Product search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">search</span>
                <input value={editProductSearch} onChange={e => setEditProductSearch(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg text-sm py-2.5 pl-10 pr-4 outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Search product to add..." />
                {editSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-popover border border-border rounded-lg shadow-xl max-h-[180px] overflow-y-auto">
                    {editSearchResults.map(p => (
                      <button key={p.id} type="button" onClick={() => addEditProduct(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2 border-b border-border/50 last:border-0">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.barcode || ''} | Stock: {formatStockDisplay(p.stock, p.piecesPerBox || 4)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-white uppercase bg-[hsl(230,45%,35%)]">
                      <th className="px-2 py-2">Product</th>
                      <th className="px-2 py-2 text-center">Carton</th>
                      <th className="px-2 py-2 text-center">Piece</th>
                      <th className="px-2 py-2 text-center">Sqft/Qty</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2 text-right">Sub Total</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {editItems.map(item => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-2 py-1.5 font-medium">{item.name}</td>
                        <td className="px-1 py-1">
                          <input type="number" min={0} value={item.carton} onChange={e => updateEditItem(item.id, 'carton', parseInt(e.target.value) || 0)}
                            className="w-16 bg-background border border-border rounded text-sm py-1.5 text-center outline-none focus:border-ring mx-auto block" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" min={0} value={item.piece} onChange={e => updateEditItem(item.id, 'piece', parseInt(e.target.value) || 0)}
                            className="w-14 bg-background border border-border rounded text-sm py-1.5 text-center outline-none focus:border-ring mx-auto block" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" min={0} value={item.sqftQty} onChange={e => updateEditItem(item.id, 'sqftQty', parseFloat(e.target.value) || 0)}
                            className="w-16 bg-background border border-border rounded text-sm py-1.5 text-center outline-none focus:border-ring mx-auto block" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" value={item.buyRate} onChange={e => updateEditItem(item.id, 'buyRate', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-background border border-border rounded text-sm py-1.5 text-right outline-none focus:border-ring ml-auto block" />
                        </td>
                        <td className="px-2 py-1.5 text-right font-bold">{formatCurrency(item.subTotal)}</td>
                        <td className="px-1 py-1">
                          <button onClick={() => setEditItems(prev => prev.filter(i => i.id !== item.id))} className="w-6 h-6 rounded bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {editItems.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">No products added</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Discount</label>
                  <input type="number" value={editDiscount} onChange={e => setEditDiscount(e.target.value)} placeholder="0"
                    className="w-full bg-muted border border-border rounded-lg text-sm py-2 px-3 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Labour/Delivery</label>
                  <input type="number" value={editDelivery} onChange={e => setEditDelivery(e.target.value)} placeholder="0"
                    className="w-full bg-muted border border-border rounded-lg text-sm py-2 px-3 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Paid</label>
                  <input type="number" value={editPaid} onChange={e => setEditPaid(e.target.value)} placeholder="0"
                    className="w-full bg-muted border border-border rounded-lg text-sm py-2 px-3 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Remark</label>
                  <input value={editRemark} onChange={e => setEditRemark(e.target.value)} placeholder="Note..."
                    className="w-full bg-muted border border-border rounded-lg text-sm py-2 px-3 outline-none" />
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-[240px] text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatCurrency(editTotal)}</span></div>
                  <div className="flex justify-between border-t border-border pt-1"><span className="font-black text-primary">Payable</span><span className="font-black text-primary">{formatCurrency(editPayable)}</span></div>
                  <div className="flex justify-between"><span className="text-[hsl(125,60%,35%)]">Paid</span><span className="font-bold">{formatCurrency(editPaidVal)}</span></div>
                  <div className="flex justify-between"><span className={editDueVal > 0 ? 'text-destructive font-bold' : 'text-[hsl(125,60%,35%)]'}>Due</span><span className={`font-bold ${editDueVal > 0 ? 'text-destructive' : ''}`}>{formatCurrency(editDueVal)}</span></div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 py-3 border-t border-border">
              <button onClick={() => setEditPurchase(null)} className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-semibold text-sm">Cancel</button>
              <button onClick={handleEditSave} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm">Update Purchase</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
