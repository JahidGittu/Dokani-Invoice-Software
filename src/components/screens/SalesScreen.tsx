import { useState, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, getNextInvoiceNumber, downloadCSV, type CartItem, type Product, type SaleRecord, type Customer } from "@/lib/store";
import { toast } from "sonner";
import InvoiceModal from "@/components/InvoiceModal";

interface SalesScreenProps {
  products: Product[];
  customers: Customer[];
  sales: SaleRecord[];
  onSaleComplete: (sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => void;
  onDeleteSale: (id: string) => void;
  companyName: string;
  companyPhone?: string;
  companyAddress?: string;
  onNavigate: (screen: string) => void;
}

const PAGE_SIZE = 10;

export default function SalesScreen({ products, customers, sales, onSaleComplete, onDeleteSale, companyName, companyPhone, companyAddress, onNavigate }: SalesScreenProps) {
  const { t } = useI18n();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [viewSale, setViewSale] = useState<SaleRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 250);

  const filteredProducts = useMemo(() =>
    products.filter(p =>
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.size.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.batch.toLowerCase().includes(debouncedSearch.toLowerCase())
    ), [products, debouncedSearch]);

  const customerSuggestions = useMemo(() =>
    customerName.length >= 1 ? customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5) : [],
    [customerName, customers]);

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const paginatedSales = useMemo(() => sales.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sales, page]);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) { toast.error(`${product.name} ${t('outOfStockMsg')}`); return; }
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) { toast.error(`${t('onlyInStock')} ${product.stock} ${t('onlyBoxesAvail')}`); return prev; }
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1 }];
    });
    toast.success(`${product.name} ${t('addedToCart')}`);
  }, [t]);

  const changeQty = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].qty + delta;
      if (newQty <= 0) { updated.splice(index, 1); return updated; }
      if (newQty > updated[index].product.stock) { toast.error(`${t('onlyInStock')} ${updated[index].product.stock} ${t('onlyBoxesAvail')}`); return prev; }
      updated[index] = { ...updated[index], qty: newQty };
      return updated;
    });
  };

  const subtotal = cart.reduce((sum, c) => sum + c.product.pricePerBox * c.qty, 0);
  const discountValue = discountType === 'percent' ? Math.round(subtotal * (parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);

  const handleCheckout = () => {
    if (!cart.length) { toast.error(t('cartEmpty')); return; }
    const inv = getNextInvoiceNumber();
    const now = new Date();
    const sale: SaleRecord = {
      id: crypto.randomUUID(), invoice: inv, customer: customerName || t('walkInCustomer'), phone: customerPhone,
      items: cart.map(c => ({ productId: c.product.id, name: c.product.name, detail: `${c.product.size} · ${c.product.finish}`, qty: c.qty, price: c.product.pricePerBox })),
      subtotal, discount: discountValue, discountType, total, paymentMethod: 'cash', notes: '', status: 'paid',
      date: now.toISOString(), time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
    onSaleComplete(sale, cart.map(c => ({ productId: c.product.id, qty: c.qty })));
    setViewSale(sale); setShowInvoice(true);
    setCart([]); setCustomerName(''); setCustomerPhone(''); setDiscount('');
    toast.success(`${t('saleCompleted')} ${inv}`);
  };

  const reopenInvoice = (s: SaleRecord) => { setViewSale(s); setShowInvoice(true); };

  const confirmDeleteSale = () => {
    if (showDeleteConfirm) { onDeleteSale(showDeleteConfirm); toast.success(t('saleDeleted')); }
    setShowDeleteConfirm(null);
  };

  const exportSalesCSV = () => {
    const rows = [[t('invoice'), t('customer'), t('phoneLabel'), t('items'), t('subtotal'), t('discount'), t('total'), t('payment'), t('status'), t('date')],
      ...sales.map(s => [s.invoice, s.customer, s.phone || '', String(s.items.length), String(s.subtotal), String(s.discount), String(s.total), s.paymentMethod, s.status, s.date])
    ];
    downloadCSV(rows, 'sales_export.csv');
    toast.success(t('csvExported'));
  };

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('pointOfSale')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('salesPOS')}</h2>
        </div>
        <button onClick={() => onNavigate('new-sale')} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">receipt_long</span>{t('newSaleEntryBtn')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-pos-surface-high border-none rounded-lg text-sm py-3 pl-10 focus:ring-2 focus:ring-pos-secondary outline-none"
              placeholder={t('searchByName')} />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-pos-on-surface-variant">search</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.length > 0 ? filteredProducts.map(p => (
              <div key={p.id} onClick={() => addToCart(p)}
                className={`bg-pos-surface-lowest rounded-xl p-5 border border-pos-surface-container cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg ${p.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="text-sm font-bold mb-1">{p.name}</div>
                <div className="text-xs text-pos-on-surface-variant mb-3">{p.size} · {p.finish}</div>
                <div className="flex justify-between items-end">
                  <div className="text-lg font-black text-pos-secondary">{formatCurrency(p.pricePerBox)}</div>
                  <div className={`text-[10px] font-bold ${p.stock <= 20 ? 'text-pos-error' : 'text-pos-on-surface-variant'}`}>{p.stock} {t('boxes')}</div>
                </div>
              </div>
            )) : (
              <div className="text-xs text-pos-on-surface-variant col-span-2 py-4">{t('noProducts')} <button onClick={() => onNavigate('products')} className="text-pos-secondary underline">{t('addProduct')}</button></div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container sticky top-24">
            <div className="px-5 py-4 border-b border-pos-surface-container flex justify-between items-center">
              <h3 className="font-semibold">{t('currentCart')} <span className="text-pos-on-surface-variant font-normal text-sm">({cart.length})</span></h3>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-pos-error hover:underline">{t('clear')}</button>}
            </div>
            <div className="px-5 pt-4 relative">
              <input value={customerName} onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full bg-pos-surface-high border-none rounded-lg text-xs py-2 pl-8 focus:ring-2 focus:ring-pos-secondary outline-none"
                placeholder={t('customerName')} />
              <span className="material-symbols-outlined absolute left-7 top-1/2 mt-2 -translate-y-1/2 text-pos-on-surface-variant text-base">person</span>
              {showSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute left-5 right-5 bg-pos-surface-lowest border border-pos-surface-container rounded-lg shadow-xl z-10 mt-1 max-h-[160px] overflow-y-auto">
                  {customerSuggestions.map(c => (
                    <button key={c.id} onMouseDown={() => { setCustomerName(c.name); setCustomerPhone(c.phone); setShowSuggestions(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-pos-surface-high transition-colors">{c.name} <span className="text-pos-on-surface-variant">{c.phone}</span></button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 min-h-[180px]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-pos-on-surface-variant">
                  <span className="material-symbols-outlined text-3xl mb-2">shopping_cart</span>
                  <span className="text-xs">{t('clickToAdd')}</span>
                </div>
              ) : cart.map((c, i) => (
                <div key={c.product.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-pos-surface-low transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{c.product.name}</div>
                    <div className="text-[10px] text-pos-on-surface-variant">{c.product.size} · {formatCurrency(c.product.pricePerBox)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(i, -1)} className="w-6 h-6 rounded bg-pos-surface-container text-sm font-bold hover:bg-pos-surface-high flex items-center justify-center">−</button>
                    <span className="text-xs font-bold w-5 text-center">{c.qty}</span>
                    <button onClick={() => changeQty(i, 1)} className="w-6 h-6 rounded bg-pos-surface-container text-sm font-bold hover:bg-pos-surface-high flex items-center justify-center">+</button>
                  </div>
                  <div className="text-xs font-bold text-pos-secondary w-16 text-right">{formatCurrency(c.product.pricePerBox * c.qty)}</div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4 space-y-3 border-t border-pos-surface-container pt-4">
              <div className="flex justify-between text-xs text-pos-on-surface-variant"><span>{t('subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center text-xs text-pos-on-surface-variant">
                <span>{t('discount')}</span>
                <div className="flex gap-1 items-center">
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" className="w-16 bg-pos-surface-high border-none rounded text-xs py-1 px-2 outline-none text-right" />
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percent')} className="bg-pos-surface-high border-none rounded text-xs py-1 px-1 outline-none">
                    <option value="flat">৳</option><option value="percent">%</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between font-black text-base"><span>{t('total')}</span><span className="text-pos-secondary">{formatCurrency(total)}</span></div>
              <button onClick={handleCheckout} className="w-full py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50" disabled={!cart.length}>
                <span className="material-symbols-outlined text-base">receipt</span>{t('checkoutInvoice')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sales History */}
      <div className="bg-pos-surface-lowest rounded-xl shadow-sm border border-pos-surface-container relative">
        <div className="px-4 sm:px-8 py-5 flex justify-between items-center bg-pos-surface-low rounded-t-xl">
          <h3 className="text-base font-semibold">{t('salesHistory')} <span className="text-pos-on-surface-variant font-normal text-sm">({sales.length})</span></h3>
          <button onClick={exportSalesCSV} className="text-sm font-medium text-pos-secondary flex items-center gap-1 hover:underline">
            <span className="material-symbols-outlined text-base">download</span>{t('export')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase tracking-widest bg-pos-surface-low border-t border-pos-surface-container">
              <th className="px-3 sm:px-4 py-3">{t('invoice')}</th>
              <th className="px-3 sm:px-4 py-3">{t('date')}</th>
              <th className="px-3 sm:px-4 py-3 hidden md:table-cell">Type</th>
              <th className="px-3 sm:px-4 py-3">{t('customer')}</th>
              <th className="px-3 sm:px-4 py-3 hidden lg:table-cell">{t('phone')}</th>
              <th className="px-3 sm:px-4 py-3">{t('total')}</th>
              <th className="px-3 sm:px-4 py-3 hidden md:table-cell">Return</th>
              <th className="px-3 sm:px-4 py-3 hidden md:table-cell">{t('discount')}</th>
              <th className="px-3 sm:px-4 py-3 hidden lg:table-cell">Less</th>
              <th className="px-3 sm:px-4 py-3">{t('paid')}</th>
              <th className="px-3 sm:px-4 py-3">{t('due')}</th>
              <th className="px-3 sm:px-4 py-3 text-right">{t('actions')}</th>
            </tr></thead>
            <tbody className="divide-y divide-pos-surface-container">
              {paginatedSales.length > 0 ? paginatedSales.map(s => {
                const saledue = s.due ?? (s.total - (s.paid ?? s.total));
                const custType = s.customerType || (s.customer === t('walkInCustomer') ? 'Walking' : 'Listed');
                return (
                <tr key={s.id} className="hover:bg-pos-surface-low transition-colors">
                  <td className="px-3 sm:px-4 py-3 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                  <td className="px-3 sm:px-4 py-3 text-xs text-pos-on-surface-variant">{(() => { try { return new Date(s.date).toLocaleDateString('en-GB'); } catch { return s.date; } })()}</td>
                  <td className="px-3 sm:px-4 py-3 text-xs hidden md:table-cell">{custType}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm">{s.customer}</td>
                  <td className="px-3 sm:px-4 py-3 text-xs hidden lg:table-cell">{s.phone || '-'}</td>
                  <td className="px-3 sm:px-4 py-3 font-bold">{formatCurrency(s.total)}</td>
                  <td className="px-3 sm:px-4 py-3 text-xs hidden md:table-cell">{formatCurrency(s.returnAmount ?? 0)}</td>
                  <td className="px-3 sm:px-4 py-3 text-xs hidden md:table-cell">{formatCurrency(s.discount)}</td>
                  <td className="px-3 sm:px-4 py-3 text-xs hidden lg:table-cell">{formatCurrency(s.lessAmount ?? 0)}</td>
                  <td className="px-3 sm:px-4 py-3 text-xs font-semibold text-[hsl(125,60%,35%)]">{formatCurrency(s.paid ?? s.total)}</td>
                  <td className={`px-3 sm:px-4 py-3 text-xs font-semibold ${saledue > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(saledue)}</td>
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button data-sale-id={s.id} className="px-3 py-1.5 bg-pos-error text-white rounded text-xs font-semibold flex items-center gap-1"
                        onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}>
                        Options <span className="material-symbols-outlined text-xs">arrow_drop_down</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}) : (
                <tr><td colSpan={12} className="px-8 py-8 text-center text-xs text-pos-on-surface-variant">{t('noSalesYet')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Floating dropdown menu rendered outside overflow container */}
        {openMenuId && (() => {
          const sale = sales.find(s => s.id === openMenuId);
          if (!sale) return null;
          return (
            <div className="fixed inset-0 z-[999]" onClick={() => setOpenMenuId(null)}>
              <div className="fixed z-[1000]" style={(() => {
                const btn = document.querySelector(`[data-sale-id="${openMenuId}"]`) as HTMLElement;
                if (!btn) return { top: '50%', right: '2rem' };
                const rect = btn.getBoundingClientRect();
                const menuHeight = 140;
                const spaceBelow = window.innerHeight - rect.bottom;
                const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
                return { top: `${top}px`, right: `${window.innerWidth - rect.right}px` };
              })()}
                onClick={e => e.stopPropagation()}>
                <div className="bg-card border border-border rounded-lg shadow-xl min-w-[140px] py-1">
                  <button onClick={() => { reopenInvoice(sale); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-accent flex items-center gap-2 transition-colors"><span className="material-symbols-outlined text-sm text-pos-secondary">visibility</span>{t('view')}</button>
                  <button onClick={() => { setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-accent flex items-center gap-2 transition-colors"><span className="material-symbols-outlined text-sm text-pos-secondary">edit</span>{t('edit')}</button>
                  <button onClick={() => { setShowDeleteConfirm(sale.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs hover:bg-accent flex items-center gap-2 text-destructive transition-colors"><span className="material-symbols-outlined text-sm">delete</span>{t('delete')}</button>
                </div>
              </div>
            </div>
          );
        })()}
        {sales.length > PAGE_SIZE && (
          <div className="px-6 py-3 bg-pos-surface-low border-t border-pos-surface-container flex justify-between items-center">
            <span className="text-xs text-pos-on-surface-variant">{t('page')} {page + 1} {t('of')} {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">{t('prev')}</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs font-semibold bg-pos-surface-container rounded-lg disabled:opacity-40">{t('next')}</button>
            </div>
          </div>
        )}
      </div>

      {showInvoice && viewSale && (
        <InvoiceModal sale={viewSale} companyName={companyName} companyPhone={companyPhone} companyAddress={companyAddress} onClose={() => setShowInvoice(false)} />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-pos-surface-lowest rounded-xl w-[360px] shadow-2xl p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-pos-on-error-container">delete</span>
              </div>
              <h3 className="text-lg font-bold">{t('deleteSale')}</h3>
            </div>
            <p className="text-sm text-pos-on-surface-variant mb-6">{t('deleteSaleMsg')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-pos-surface-container text-pos-on-surface-variant rounded-lg font-semibold text-sm">{t('cancel')}</button>
              <button onClick={confirmDeleteSale} className="flex-1 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
