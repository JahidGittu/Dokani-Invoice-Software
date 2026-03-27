import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { formatCurrency, downloadCSV, type SaleRecord, type Product, type Customer, type Supplier, type PurchaseRecord } from "@/lib/store";

interface ReportsScreenProps {
  sales?: SaleRecord[];
  products?: Product[];
  customers?: Customer[];
  suppliers?: Supplier[];
  purchases?: PurchaseRecord[];
}

type ReportType = 'purchase' | 'sales' | 'stock' | 'payment' | 'customer' | 'supplier' | 'profit' | 'customer_dues' | 'customer_walking' | 'supplier_balance' | 'account';

export default function ReportsScreen({ sales = [], products = [], customers = [], suppliers = [], purchases = [] }: ReportsScreenProps) {
  const { t } = useI18n();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeReport, setActiveReport] = useState<ReportType>('sales');

  const filteredSales = useMemo(() => {
    if (!dateFrom && !dateTo) return sales;
    return sales.filter(s => {
      try {
        const d = new Date(s.date);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      } catch { return true; }
    });
  }, [sales, dateFrom, dateTo]);

  const filteredPurchases = useMemo(() => {
    if (!dateFrom && !dateTo) return purchases;
    return purchases.filter(p => {
      try {
        const d = new Date(p.date);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      } catch { return true; }
    });
  }, [purchases, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((s, sale) => s + sale.total, 0);
    const totalPaid = filteredSales.reduce((s, sale) => s + (sale.paid ?? sale.total), 0);
    const totalDue = filteredSales.reduce((s, sale) => s + (sale.due ?? 0), 0);
    let totalCost = 0;
    filteredSales.forEach(s => s.items.forEach(item => {
      const p = products.find(pr => pr.id === item.productId);
      totalCost += (p?.buyRate || 0) * item.qty;
    }));
    const totalProfit = totalRevenue - totalCost;
    const dueCustomers = customers.filter(c => (c.totalDue || 0) > 0).sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0));
    const purchaseTotal = filteredPurchases.reduce((s, p) => s + p.payable, 0);
    const purchasePaid = filteredPurchases.reduce((s, p) => s + p.paid, 0);
    const purchaseDue = filteredPurchases.reduce((s, p) => s + p.due, 0);
    return { totalRevenue, totalPaid, totalDue, totalProfit, totalCost, dueCustomers, purchaseTotal, purchasePaid, purchaseDue };
  }, [filteredSales, filteredPurchases, products, customers]);

  const reportList: { id: ReportType; label: string; icon: string; children?: { id: ReportType; label: string }[] }[] = [
    { id: 'purchase', label: 'Purchase Report', icon: 'shopping_cart' },
    { id: 'sales', label: 'Sales Report', icon: 'point_of_sale' },
    { id: 'stock', label: 'Stock Report', icon: 'layers' },
    { id: 'payment', label: 'Payment Report', icon: 'payments' },
    { id: 'customer', label: 'Customer Report', icon: 'group' },
    { id: 'supplier', label: 'Supplier Report', icon: 'local_shipping' },
    { id: 'profit', label: 'Profit Reports', icon: 'trending_up' },
    { id: 'customer_dues', label: 'Due Reports', icon: 'warning', children: [
      { id: 'customer_dues', label: 'Customer Dues' },
      { id: 'customer_walking', label: 'Customer Dues (Walking)' },
      { id: 'supplier_balance', label: 'Supplier Balance' },
    ]},
    { id: 'account', label: 'Account Reports', icon: 'account_balance' },
  ];

  const handlePrint = () => {
    window.print();
  };

  const exportReport = () => {
    let rows: string[][] = [];
    if (activeReport === 'sales') {
      rows = [['Invoice', 'Customer', 'Total', 'Paid', 'Due', 'Date'], ...filteredSales.map(s => [s.invoice, s.customer, String(s.total), String(s.paid ?? s.total), String(s.due ?? 0), s.date])];
    } else if (activeReport === 'purchase') {
      rows = [['Invoice', 'Supplier', 'Total', 'Paid', 'Due', 'Date'], ...filteredPurchases.map(p => [p.invoice, p.supplierName, String(p.payable), String(p.paid), String(p.due), p.date])];
    } else if (activeReport === 'stock') {
      rows = [['Product', 'Category', 'Size', 'Stock', 'Buy Rate', 'Sale Rate'], ...products.map(p => [p.name, p.category || '', p.size, String(p.stock), String(p.buyRate || 0), String(p.pricePerBox)])];
    }
    if (rows.length > 0) { downloadCSV(rows, `${activeReport}_report.csv`); toast.success(t('reportExported')); }
  };

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('performanceOverview')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('reports')}</h2>
        </div>
        <button onClick={exportReport} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">file_download</span>{t('exportReport')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Report List */}
        <div className="lg:col-span-4 bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-5">
          <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-wider mb-4">List of Reports</h3>
          <div className="space-y-1">
            {reportList.map(item => (
              <div key={item.id}>
                <button onClick={() => setActiveReport(item.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeReport === item.id || item.children?.some(c => c.id === activeReport) ? 'bg-pos-secondary text-white' : 'text-pos-on-surface hover:bg-pos-surface-high'}`}>
                  <span className="material-symbols-outlined text-base">{item.icon}</span>
                  {item.label}
                </button>
                {item.children && (
                  <div className="ml-8 space-y-0.5 mt-0.5">
                    {item.children.map(child => (
                      <button key={child.id} onClick={() => setActiveReport(child.id)}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeReport === child.id ? 'text-pos-secondary font-bold' : 'text-pos-on-surface-variant hover:text-pos-on-surface'}`}>
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Report Content */}
        <div className="lg:col-span-8 space-y-4">
          {/* Date Range */}
          <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-5 space-y-4">
            <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-wider">Report Range</h3>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs text-pos-on-surface-variant mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-pos-on-surface-variant mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-pos-surface-high border border-pos-surface-container rounded-lg text-sm py-2 px-3 outline-none" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-pos-error font-bold hover:underline">{t('clear')}</button>
              )}
            </div>
            <button onClick={handlePrint} className="px-6 py-2.5 bg-pos-error text-white rounded-lg font-semibold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">print</span>{t('print')}
            </button>
          </div>

          {/* Report Data */}
          {activeReport === 'sales' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Sales Report ({filteredSales.length})</div>
              <div className="grid grid-cols-3 gap-4 p-4">
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('total')}</div><div className="text-xl font-black">{formatCurrency(stats.totalRevenue)}</div></div>
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('paid')}</div><div className="text-xl font-black text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalPaid)}</div></div>
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('due')}</div><div className="text-xl font-black text-destructive">{formatCurrency(stats.totalDue)}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('invoice')}</th><th className="px-4 py-2">{t('customer')}</th><th className="px-4 py-2 text-right">{t('total')}</th><th className="px-4 py-2 text-right">{t('paid')}</th><th className="px-4 py-2 text-right">{t('due')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {filteredSales.slice(0, 20).map(s => (
                      <tr key={s.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                        <td className="px-4 py-2">{s.customer}</td>
                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(s.total)}</td>
                        <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(s.paid ?? s.total)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${(s.due ?? 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(s.due ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'purchase' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Purchase Report ({filteredPurchases.length})</div>
              <div className="grid grid-cols-3 gap-4 p-4">
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('total')}</div><div className="text-xl font-black">{formatCurrency(stats.purchaseTotal)}</div></div>
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('paid')}</div><div className="text-xl font-black text-[hsl(125,60%,35%)]">{formatCurrency(stats.purchasePaid)}</div></div>
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('due')}</div><div className="text-xl font-black text-destructive">{formatCurrency(stats.purchaseDue)}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('invoice')}</th><th className="px-4 py-2">{t('supplierLabel')}</th><th className="px-4 py-2 text-right">{t('total')}</th><th className="px-4 py-2 text-right">{t('paid')}</th><th className="px-4 py-2 text-right">{t('due')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {filteredPurchases.slice(0, 20).map(p => (
                      <tr key={p.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{p.invoice}</td>
                        <td className="px-4 py-2">{p.supplierName}</td>
                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(p.payable)}</td>
                        <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(p.paid)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${p.due > 0 ? 'text-destructive' : ''}`}>{formatCurrency(p.due)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'stock' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Stock Report ({products.length} products)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('products')}</th><th className="px-4 py-2">{t('category')}</th><th className="px-4 py-2 text-center">{t('stock')}</th><th className="px-4 py-2 text-right">Buy Rate</th><th className="px-4 py-2 text-right">Sale Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 font-semibold">{p.name} <span className="text-[10px] text-pos-on-surface-variant">{p.size}</span></td>
                        <td className="px-4 py-2 text-xs">{p.category || '-'}</td>
                        <td className={`px-4 py-2 text-center font-bold ${p.stock <= 20 ? 'text-pos-error' : ''}`}>{p.stock}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(p.buyRate || 0)}</td>
                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(p.pricePerBox)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'payment' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Payment Report</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('invoice')}</th><th className="px-4 py-2">{t('customer')}</th><th className="px-4 py-2">{t('paymentMethod')}</th><th className="px-4 py-2 text-right">{t('total')}</th><th className="px-4 py-2 text-right">{t('paid')}</th><th className="px-4 py-2 text-right">{t('due')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {filteredSales.slice(0, 20).map(s => (
                      <tr key={s.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                        <td className="px-4 py-2">{s.customer}</td>
                        <td className="px-4 py-2 text-xs uppercase">{s.paymentMethod}</td>
                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(s.total)}</td>
                        <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(s.paid ?? s.total)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${(s.due ?? 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(s.due ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'customer' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Customer Report ({customers.length})</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('name')}</th><th className="px-4 py-2">{t('phoneLabel')}</th><th className="px-4 py-2 text-right">Total Spent</th><th className="px-4 py-2 text-right">{t('due')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {customers.map(c => (
                      <tr key={c.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 font-semibold">{c.name}</td>
                        <td className="px-4 py-2 text-xs">{c.phone}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(c.totalSpent)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${(c.totalDue || 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(c.totalDue || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'supplier' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Supplier Report ({suppliers.length})</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('name')}</th><th className="px-4 py-2">{t('phoneLabel')}</th><th className="px-4 py-2">{t('address')}</th><th className="px-4 py-2 text-right">{t('totalDue')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {suppliers.map(s => (
                      <tr key={s.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 font-semibold">{s.name}</td>
                        <td className="px-4 py-2 text-xs">{s.phone}</td>
                        <td className="px-4 py-2 text-xs">{s.address}</td>
                        <td className={`px-4 py-2 text-right font-bold ${(s.totalDue || 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(s.totalDue || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'profit' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Profit Report</div>
              <div className="grid grid-cols-3 gap-4 p-4">
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">Revenue</div><div className="text-xl font-black">{formatCurrency(stats.totalRevenue)}</div></div>
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">Cost</div><div className="text-xl font-black text-pos-on-surface-variant">{formatCurrency(stats.totalCost)}</div></div>
                <div className="bg-pos-surface-high rounded-lg p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">Profit</div><div className={`text-xl font-black ${stats.totalProfit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(stats.totalProfit)}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('products')}</th><th className="px-4 py-2 text-center">Sold</th><th className="px-4 py-2 text-right">Revenue</th><th className="px-4 py-2 text-right">Cost</th><th className="px-4 py-2 text-right">Profit</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {products.map(p => {
                      const soldQty = filteredSales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((sq, i) => sq + i.qty, 0), 0);
                      if (soldQty === 0) return null;
                      const revenue = filteredSales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((sr, i) => sr + i.qty * i.price, 0), 0);
                      const cost = soldQty * (p.buyRate || 0);
                      const profit = revenue - cost;
                      return (
                        <tr key={p.id} className="hover:bg-pos-surface-low">
                          <td className="px-4 py-2 font-semibold">{p.name} <span className="text-[10px] text-pos-on-surface-variant">{p.size}</span></td>
                          <td className="px-4 py-2 text-center">{soldQty}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(revenue)}</td>
                          <td className="px-4 py-2 text-right text-pos-on-surface-variant">{formatCurrency(cost)}</td>
                          <td className={`px-4 py-2 text-right font-bold ${profit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(profit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(activeReport === 'customer_dues' || activeReport === 'customer_walking') && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">{activeReport === 'customer_dues' ? 'Customer Dues' : 'Customer Dues (Walking)'}</div>
              <div className="space-y-3 p-4">
                {stats.dueCustomers.length > 0 ? stats.dueCustomers.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-pos-surface-low rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-pos-error-container flex items-center justify-center">
                        <span className="text-xs font-bold text-pos-on-error-container">{c.initials}</span>
                      </div>
                      <div>
                        <div className="font-bold text-sm">{c.name}</div>
                        <div className="text-[10px] text-pos-on-surface-variant">{c.phone}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-destructive">{formatCurrency(c.totalDue || 0)}</div>
                      <div className="text-[10px] text-pos-on-surface-variant">Total: {formatCurrency(c.totalSpent)}</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-pos-on-surface-variant text-sm">
                    <span className="material-symbols-outlined text-3xl text-[hsl(125,60%,35%)] block mb-2">check_circle</span>
                    No outstanding dues!
                  </div>
                )}
              </div>
            </div>
          )}

          {activeReport === 'supplier_balance' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Supplier Balance</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('name')}</th><th className="px-4 py-2">{t('phoneLabel')}</th><th className="px-4 py-2 text-right">Balance Due</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {suppliers.filter(s => s.totalDue > 0).map(s => (
                      <tr key={s.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 font-semibold">{s.name}</td>
                        <td className="px-4 py-2 text-xs">{s.phone}</td>
                        <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(s.totalDue)}</td>
                      </tr>
                    ))}
                    {suppliers.filter(s => s.totalDue > 0).length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-pos-on-surface-variant text-sm">No supplier dues!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'account' && (
            <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Account Reports</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">Account</th><th className="px-4 py-2 text-right">Received</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {['cash', 'bkash', 'nagad', 'card'].map(method => {
                      const total = filteredSales.filter(s => (s.paymentMethod || 'cash') === method).reduce((sum, s) => sum + (s.paid ?? s.total), 0);
                      return (
                        <tr key={method} className="hover:bg-pos-surface-low">
                          <td className="px-4 py-2 font-semibold capitalize">{method}</td>
                          <td className="px-4 py-2 text-right font-bold">{formatCurrency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
