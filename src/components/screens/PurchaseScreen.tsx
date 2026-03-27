import { useState, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextPurchaseNumber, type Product, type Supplier, type PurchaseRecord, type PurchaseItem } from "@/lib/store";
import ComboInput from "@/components/ComboInput";
import { toast } from "sonner";

interface PurchaseScreenProps {
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  onAddPurchase: (p: PurchaseRecord) => void;
  onDeletePurchase: (id: string) => void;
  onAddStock: (items: { productId: string; qty: number }[]) => void;
  onUpdateSupplierDue: (name: string, dueAmount: number) => void;
}

const PAGE_SIZES = [10, 25, 50, 100];
type SortField = 'invoice' | 'date' | 'supplierName' | 'qty' | 'payable' | 'paid' | 'due';

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

export default function PurchaseScreen({ products, suppliers, purchases, onAddPurchase, onDeletePurchase, onAddStock, onUpdateSupplierDue }: PurchaseScreenProps) {
  const { t } = useI18n();

  // ── View toggle ──
  const [view, setView] = useState<'history' | 'add'>('history');

  // ══════ HISTORY VIEW STATE ══════
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ══════ ADD PURCHASE STATE ══════
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
      else if (sortField === 'qty') cmp = a.items.reduce((s, i) => s + i.carton, 0) - b.items.reduce((s, i) => s + i.carton, 0);
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
  const displayProducts = useMemo(() => {
    if (!debouncedProductSearch) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(debouncedProductSearch.toLowerCase()) ||
      p.batch.toLowerCase().includes(debouncedProductSearch.toLowerCase())
    );
  }, [products, debouncedProductSearch]);

  const addProductToItems = (product: Product) => {
    // Check if already in items
    if (items.find(i => i.productId === product.id)) {
      toast.error('Already added');
      return;
    }
    setItems(prev => [...prev, {
      id: Date.now(),
      productId: product.id,
      barcode: product.barcode || product.batch || '',
      name: product.name,
      stock: product.stock,
      carton: 1,
      piece: 0,
      sqftQty: 0,
      buyRate: product.buyRate || 0,
      subTotal: product.buyRate || 0,
    }]);
    setProductSearch('');
    searchRef.current?.focus();
  };

  const updateItem = (id: number, field: keyof PurchaseItemRow, value: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      // Recalculate subTotal
      updated.subTotal = (updated.carton + (updated.piece / (products.find(p => p.id === item.productId)?.piecesPerBox || 4))) * updated.buyRate;
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
    onAddStock(items.map(i => ({ productId: i.productId, qty: i.carton })));
    if (dueVal > 0) onUpdateSupplierDue(supplierName, dueVal);
    toast.success('Purchase saved successfully');
    setView('history');
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) { onDeletePurchase(showDeleteConfirm); toast.success('Purchase deleted'); }
    setShowDeleteConfirm(null);
  };

  const viewPurchase = purchases.find(p => p.id === viewId);

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
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-1">Purchase</span>
            <h2 className="text-2xl font-bold text-pos-on-surface tracking-tight">Add Purchase</h2>
          </div>
          <button onClick={() => setView('history')} className="px-5 py-2.5 bg-pos-secondary text-white rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
            <span className="material-symbols-outlined text-lg">history</span>Purchase History
          </button>
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

            {/* Product search */}
            <div className="relative">
              <input ref={searchRef} value={productSearch} onChange={e => setProductSearch(e.target.value)}
                className="w-full bg-pos-surface-lowest border-2 border-pos-secondary/30 rounded-xl text-sm py-3 pl-11 pr-4 outline-none focus:border-pos-secondary transition-colors"
                placeholder="Search the Product..." />
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-pos-on-surface-variant">search</span>
            </div>

            {/* All products table with checkbox */}
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-[10px] font-bold text-white uppercase tracking-wider bg-[hsl(230,45%,35%)]">
                      <th className="px-2 py-2.5 w-8"><span className="material-symbols-outlined text-sm">check_box</span></th>
                      <th className="px-3 py-2.5">Barcode</th>
                      <th className="px-3 py-2.5">Product Name</th>
                      <th className="px-3 py-2.5 text-center">Stock</th>
                      <th className="px-3 py-2.5 text-center">Carton</th>
                      <th className="px-3 py-2.5 text-center">Piece</th>
                      <th className="px-3 py-2.5 text-center">Sqft/Qty</th>
                      <th className="px-3 py-2.5 text-right">Buy</th>
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
                          <td className="px-3 py-2 text-sm font-mono">{p.barcode || p.batch || '—'}</td>
                          <td className="px-3 py-2 text-sm font-medium">{p.name}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-sm ${p.stock <= 0 ? 'text-pos-error font-bold' : ''}`}>{p.stock}</span>
                          </td>
                          {isSelected ? (
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
                              <td className="px-1 py-1">
                                <input type="number" value={item!.buyRate} onChange={e => updateItem(item!.id, 'buyRate', parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-right outline-none focus:border-pos-secondary ml-auto block" />
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-sm">{formatCurrency(item!.subTotal)}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">0</td>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">0</td>
                              <td className="px-3 py-2 text-center text-sm text-muted-foreground">0</td>
                              <td className="px-3 py-2 text-right text-sm text-muted-foreground">{p.buyRate || 0}</td>
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
          <div className="w-full lg:w-[280px] shrink-0">
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-4 space-y-3 sticky top-4">
              {/* Total */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2.5">
                <span className="text-sm font-medium text-pos-on-surface-variant">Total</span>
                <span className="text-lg font-black text-pos-secondary">{formatCurrency(total)}</span>
              </div>

              {/* Discount */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-xs font-bold text-pos-on-surface-variant px-3 py-2.5 bg-pos-surface-low shrink-0 w-20">Discount</span>
                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0"
                  className="flex-1 text-sm py-2.5 px-3 outline-none bg-transparent text-right" />
              </div>

              {/* Delivery */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-xs font-bold text-pos-on-surface-variant px-3 py-2.5 bg-pos-surface-low shrink-0 w-20">Delivery</span>
                <input type="number" value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="0"
                  className="flex-1 text-sm py-2.5 px-3 outline-none bg-transparent text-right" />
              </div>

              {/* Payable */}
              <div className="flex items-center justify-between border-2 border-pos-secondary/30 rounded-lg px-3 py-2.5 bg-pos-secondary/5">
                <span className="text-sm font-bold">Payable</span>
                <span className="text-lg font-black text-pos-secondary">{formatCurrency(payable)}</span>
              </div>

              {/* Paid */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-xs font-bold text-pos-on-surface-variant px-3 py-2.5 bg-pos-surface-low shrink-0 w-20">Paid</span>
                <input type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0"
                  className="flex-1 text-sm py-2.5 px-3 outline-none bg-transparent text-right font-bold" />
              </div>

              {/* Due */}
              <div className="flex items-center justify-between border border-pos-surface-container rounded-lg px-3 py-2.5">
                <span className="text-sm font-bold">Due</span>
                <span className={`text-lg font-black ${dueVal > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(dueVal)}</span>
              </div>

              {/* Account */}
              <div className="flex items-center border border-pos-surface-container rounded-lg overflow-hidden">
                <span className="text-xs font-bold text-pos-on-surface-variant px-3 py-2.5 bg-pos-surface-low shrink-0 w-20">Account</span>
                <select value={account} onChange={e => setAccount(e.target.value)}
                  className="flex-1 text-sm py-2.5 px-3 outline-none bg-transparent">
                  <option>Cash</option>
                  <option>Bank</option>
                  <option>bKash</option>
                  <option>Nagad</option>
                </select>
              </div>

              {/* Save button */}
              <button onClick={handleSave}
                className="w-full py-3 bg-pos-error hover:bg-pos-error/90 text-white rounded-lg font-bold text-base transition-colors mt-2">
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
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-1">Purchase</span>
          <h2 className="text-2xl sm:text-4xl font-bold text-pos-on-surface leading-tight tracking-tighter">Purchase History</h2>
        </div>
        <button onClick={openAddPurchase} className="px-5 py-2.5 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold text-sm flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span>Add Purchase
        </button>
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
                <SortHeader field="qty">QTY./SQFTQTY.</SortHeader>
                <SortHeader field="payable" align="text-right">Total</SortHeader>
                <SortHeader field="paid" align="text-right">Paid</SortHeader>
                <SortHeader field="due" align="text-right">Due</SortHeader>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginated.map(p => {
                const totalQty = p.items.reduce((s, i) => s + (i.carton || 0), 0);
                return (
                  <tr key={p.id} className="hover:bg-pos-surface-low transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-pos-secondary">{p.invoice}</td>
                    <td className="px-4 py-3 text-sm">{(() => { try { return new Date(p.date).toLocaleDateString('en-GB'); } catch { return p.date; } })()}</td>
                    <td className="px-4 py-3 text-sm font-medium">{p.supplierName}</td>
                    <td className="px-4 py-3 text-sm">{totalQty}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(p.payable)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-[hsl(125,60%,35%)]">{formatCurrency(p.paid)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${p.due > 0 ? 'text-destructive' : ''}`}>{formatCurrency(p.due)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewId(p.id)} className="w-7 h-7 rounded bg-[hsl(125,60%,35%)] text-white flex items-center justify-center" title="View">
                          <span className="material-symbols-outlined text-sm">visibility</span>
                        </button>
                        <button className="w-7 h-7 rounded bg-pos-secondary text-white flex items-center justify-center" title="Edit">
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
                <tr><td colSpan={8} className="px-8 py-8 text-center text-sm text-pos-on-surface-variant">No purchases yet</td></tr>
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

      {/* View Detail Modal */}
      {viewPurchase && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setViewId(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[95vw] max-w-[500px] shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Purchase #{viewPurchase.invoice}</h3>
              <button onClick={() => setViewId(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="font-semibold">{viewPurchase.supplierName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(viewPurchase.date).toLocaleDateString('en-GB')}</span></div>
              <div className="border-t pt-2 mt-2">
                {viewPurchase.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-1">
                    <span>{item.name} × {item.carton} ctn {item.piece > 0 ? `+ ${item.piece} pcs` : ''}</span>
                    <span className="font-bold">{formatCurrency(item.subTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-pos-secondary">{formatCurrency(viewPurchase.payable)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-[hsl(125,60%,35%)]">Paid</span><span>{formatCurrency(viewPurchase.paid)}</span></div>
                <div className="flex justify-between text-xs"><span className={viewPurchase.due > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}>Due</span><span>{formatCurrency(viewPurchase.due)}</span></div>
              </div>
              {viewPurchase.remark && <p className="text-xs text-muted-foreground mt-2">Note: {viewPurchase.remark}</p>}
            </div>
          </div>
        </div>
      )}

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
    </section>
  );
}
