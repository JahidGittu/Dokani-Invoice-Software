import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { formatCurrency, downloadCSV, type SaleRecord, type Product, type Customer, type Supplier, type PurchaseRecord } from "@/lib/store";
import { isSqftUnit } from "@/lib/calc-utils";
import InfoTooltip from "@/components/InfoTooltip";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ReportsScreenProps {
  sales?: SaleRecord[];
  products?: Product[];
  customers?: Customer[];
  suppliers?: Supplier[];
  purchases?: PurchaseRecord[];
}

type ReportType = 'purchase' | 'sales' | 'stock' | 'payment' | 'general_transaction' | 'customer' | 'supplier' | 'staff' | 'profit' | 'customer_dues' | 'customer_walking' | 'customer_advance' | 'supplier_balance' | 'staff_balance' | 'account';

const CHART_COLORS = [
  'hsl(210,80%,55%)', 'hsl(142,70%,45%)', 'hsl(340,75%,55%)', 'hsl(45,90%,50%)',
  'hsl(280,65%,55%)', 'hsl(190,70%,45%)', 'hsl(15,80%,55%)', 'hsl(100,60%,45%)',
];

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
      if (!p) return;
      const effectiveQty = isSqftUnit(p.unit) ? (item.sqftQty ?? item.qty) : item.qty;
      totalCost += (p.buyRate || 0) * effectiveQty;
    }));
    const totalProfit = totalRevenue - totalCost;
    const dueCustomers = customers.filter(c => (c.totalDue || 0) > 0).sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0));
    const purchaseTotal = filteredPurchases.reduce((s, p) => s + p.payable, 0);
    const purchasePaid = filteredPurchases.reduce((s, p) => s + p.paid, 0);
    const purchaseDue = filteredPurchases.reduce((s, p) => s + p.due, 0);
    return { totalRevenue, totalPaid, totalDue, totalProfit, totalCost, dueCustomers, purchaseTotal, purchasePaid, purchaseDue };
  }, [filteredSales, filteredPurchases, products, customers]);

  // Chart data generators
  const salesChartData = useMemo(() => {
    const byDate: Record<string, number> = {};
    filteredSales.forEach(s => {
      try {
        const key = new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        byDate[key] = (byDate[key] || 0) + s.total;
      } catch { /* skip */ }
    });
    return Object.entries(byDate).map(([date, amount]) => ({ date, amount: Math.round(amount) }));
  }, [filteredSales]);

  const purchaseChartData = useMemo(() => {
    const bySupplier: Record<string, number> = {};
    filteredPurchases.forEach(p => {
      bySupplier[p.supplierName] = (bySupplier[p.supplierName] || 0) + p.payable;
    });
    return Object.entries(bySupplier).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredPurchases]);

  const stockChartData = useMemo(() => {
    const byCat: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.category || 'Others';
      byCat[cat] = (byCat[cat] || 0) + p.stock;
    });
    return Object.entries(byCat).map(([name, value]) => ({ name, value }));
  }, [products]);

  const profitChartData = useMemo(() => {
    return products.map(p => {
      const soldQty = filteredSales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((sq, i) => sq + i.qty, 0), 0);
      if (soldQty === 0) return null;
      const revenue = filteredSales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((sr, i) => sr + i.qty * i.price, 0), 0);
      const cost = soldQty * (p.buyRate || 0);
      return { name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name, revenue: Math.round(revenue), cost: Math.round(cost), profit: Math.round(revenue - cost) };
    }).filter(Boolean) as { name: string; revenue: number; cost: number; profit: number }[];
  }, [filteredSales, products]);

  const paymentMethodData = useMemo(() => {
    const byMethod: Record<string, number> = {};
    filteredSales.forEach(s => {
      const m = (s.paymentMethod || 'Cash').toLowerCase();
      byMethod[m] = (byMethod[m] || 0) + (s.paid ?? s.total);
    });
    return Object.entries(byMethod).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round(value) }));
  }, [filteredSales]);

  const dueChartData = useMemo(() => {
    return stats.dueCustomers.slice(0, 8).map(c => ({
      name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
      due: Math.round(c.totalDue || 0),
    }));
  }, [stats.dueCustomers]);

  const reportList: { id: ReportType; label: string; icon: string; children?: { id: ReportType; label: string }[] }[] = [
    { id: 'purchase', label: 'Purchase Report', icon: 'shopping_cart' },
    { id: 'sales', label: 'Sales Report', icon: 'point_of_sale' },
    { id: 'stock', label: 'Stock Report', icon: 'layers' },
    { id: 'payment', label: 'Payment Report', icon: 'payments' },
    { id: 'general_transaction', label: 'General Transaction', icon: 'receipt_long' },
    { id: 'customer', label: 'Customer Report', icon: 'group' },
    { id: 'supplier', label: 'Supplier Report', icon: 'local_shipping' },
    { id: 'staff', label: 'Staff Report', icon: 'badge' },
    { id: 'profit', label: 'Profit Reports', icon: 'trending_up' },
    { id: 'customer_dues', label: 'Due Reports', icon: 'warning', children: [
      { id: 'customer_dues', label: 'Customer Dues' },
      { id: 'customer_walking', label: 'Customer Dues (Walking)' },
      { id: 'customer_advance', label: 'Customer Advance' },
      { id: 'supplier_balance', label: 'Supplier Balance' },
      { id: 'staff_balance', label: 'Staff Balance' },
    ]},
    { id: 'account', label: 'Account Reports', icon: 'account_balance' },
  ];

  const handlePrint = () => window.print();

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

  // Render chart based on active report
  const renderChart = () => {
    switch (activeReport) {
      case 'sales':
        if (salesChartData.length === 0) return null;
        return (
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase mb-4 flex items-center gap-1.5">
              📈 Sales Trend <InfoTooltip text="তারিখ অনুযায়ী বিক্রির পরিমাণ" />
            </h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(210,80%,55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(210,80%,55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,85%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="amount" stroke="hsl(210,80%,55%)" fillOpacity={1} fill="url(#salesGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'purchase':
        if (purchaseChartData.length === 0) return null;
        return (
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase mb-4 flex items-center gap-1.5">
              🏭 Supplier-wise Purchase <InfoTooltip text="সাপ্লায়ার অনুযায়ী পার্চেজের পরিমাণ" />
            </h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={purchaseChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {purchaseChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'stock':
        if (stockChartData.length === 0) return null;
        return (
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase mb-4 flex items-center gap-1.5">
              📦 Category-wise Stock <InfoTooltip text="ক্যাটাগরি অনুযায়ী স্টকের পরিমাণ" />
            </h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,85%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Stock" radius={[6, 6, 0, 0]}>
                    {stockChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'profit':
        if (profitChartData.length === 0) return null;
        return (
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase mb-4 flex items-center gap-1.5">
              💰 Product-wise Profit <InfoTooltip text="প্রোডাক্ট অনুযায়ী লাভের তুলনা" />
            </h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,85%)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(210,80%,55%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="cost" name="Cost" fill="hsl(0,60%,55%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="profit" name="Profit" fill="hsl(142,70%,45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'payment':
      case 'account':
        if (paymentMethodData.length === 0) return null;
        return (
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase mb-4 flex items-center gap-1.5">
              💳 Payment Method Distribution <InfoTooltip text="পেমেন্ট মেথড অনুযায়ী প্রাপ্তি" />
            </h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentMethodData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {paymentMethodData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'customer_dues':
      case 'customer_walking':
        if (dueChartData.length === 0) return null;
        return (
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase mb-4 flex items-center gap-1.5">
              ⚠️ Top Dues <InfoTooltip text="সবচেয়ে বেশি বকেয়া কাস্টমার" />
            </h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,85%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="due" name="Due" fill="hsl(0,65%,55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'general_transaction': {
        const txData = [
          { name: 'Sales Income', value: Math.round(stats.totalPaid), fill: 'hsl(142,70%,45%)' },
          { name: 'Purchase Expense', value: Math.round(stats.purchasePaid), fill: 'hsl(0,60%,55%)' },
        ];
        return (
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h4 className="text-xs font-bold text-pos-on-surface-variant uppercase mb-4 flex items-center gap-1.5">
              📊 Income vs Expense <InfoTooltip text="বিক্রি আয় বনাম পার্চেজ ব্যয়ের তুলনা" />
            </h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={txData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,85%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" name="Amount" radius={[8, 8, 0, 0]}>
                    {txData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <section className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-pos-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            {t('reports')}
          </h2>
          <span className="text-xs text-pos-on-surface-variant">{t('performanceOverview')}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-4 py-2.5 bg-muted text-foreground rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-muted/80 transition-colors">
            <span className="material-symbols-outlined text-base">print</span>{t('print')}
          </button>
          <button onClick={exportReport} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-base">file_download</span>{t('exportReport')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Report List + Chart */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h3 className="text-xs font-bold text-pos-on-surface-variant uppercase tracking-wider mb-3">Reports</h3>
            <div className="space-y-0.5">
              {reportList.map(item => (
                <div key={item.id}>
                  <button onClick={() => setActiveReport(item.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeReport === item.id || item.children?.some(c => c.id === activeReport) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-pos-on-surface hover:bg-pos-surface-high'}`}>
                    <span className="material-symbols-outlined text-base">{item.icon}</span>
                    {item.label}
                  </button>
                  {item.children && (
                    <div className="ml-8 space-y-0.5 mt-0.5">
                      {item.children.map(child => (
                        <button key={child.id} onClick={() => setActiveReport(child.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeReport === child.id ? 'text-primary font-bold bg-primary/5' : 'text-pos-on-surface-variant hover:text-pos-on-surface'}`}>
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chart below the sidebar */}
          {renderChart()}
        </div>

        {/* Right: Report Content */}
        <div className="lg:col-span-8 space-y-4">
          {/* Date Range */}
          <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-[10px] text-pos-on-surface-variant font-bold uppercase mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-pos-surface-high border border-pos-surface-container rounded-xl text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-[10px] text-pos-on-surface-variant font-bold uppercase mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-pos-surface-high border border-pos-surface-container rounded-xl text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-ring" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-destructive font-bold hover:underline pb-2">{t('clear')}</button>
              )}
            </div>
          </div>

          {/* Report Data */}
          {activeReport === 'sales' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">point_of_sale</span>
                Sales Report ({filteredSales.length})
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold flex items-center gap-1">{t('total')} <InfoTooltip text="মোট বিক্রির পরিমাণ" /></div><div className="text-lg font-black mt-1">{formatCurrency(stats.totalRevenue)}</div></div>
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('paid')}</div><div className="text-lg font-black text-[hsl(142,70%,35%)] mt-1">{formatCurrency(stats.totalPaid)}</div></div>
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('due')}</div><div className="text-lg font-black text-destructive mt-1">{formatCurrency(stats.totalDue)}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('invoice')}</th><th className="px-4 py-2">{t('customer')}</th><th className="px-4 py-2 text-right">{t('total')}</th><th className="px-4 py-2 text-right">{t('paid')}</th><th className="px-4 py-2 text-right">{t('due')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {filteredSales.slice(0, 20).map(s => (
                      <tr key={s.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 text-xs font-bold text-primary">{s.invoice}</td>
                        <td className="px-4 py-2">{s.customer}</td>
                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(s.total)}</td>
                        <td className="px-4 py-2 text-right text-[hsl(142,70%,35%)]">{formatCurrency(s.paid ?? s.total)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${(s.due ?? 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(s.due ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'purchase' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">shopping_cart</span>
                Purchase Report ({filteredPurchases.length})
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('total')}</div><div className="text-lg font-black mt-1">{formatCurrency(stats.purchaseTotal)}</div></div>
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('paid')}</div><div className="text-lg font-black text-[hsl(142,70%,35%)] mt-1">{formatCurrency(stats.purchasePaid)}</div></div>
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{t('due')}</div><div className="text-lg font-black text-destructive mt-1">{formatCurrency(stats.purchaseDue)}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('invoice')}</th><th className="px-4 py-2">{t('supplierLabel')}</th><th className="px-4 py-2 text-right">{t('total')}</th><th className="px-4 py-2 text-right">{t('paid')}</th><th className="px-4 py-2 text-right">{t('due')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {filteredPurchases.slice(0, 20).map(p => (
                      <tr key={p.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 text-xs font-bold text-primary">{p.invoice}</td>
                        <td className="px-4 py-2">{p.supplierName}</td>
                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(p.payable)}</td>
                        <td className="px-4 py-2 text-right text-[hsl(142,70%,35%)]">{formatCurrency(p.paid)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${p.due > 0 ? 'text-destructive' : ''}`}>{formatCurrency(p.due)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'stock' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">layers</span>
                Stock Report ({products.length} products)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('products')}</th><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-center">{t('stock')}</th><th className="px-4 py-2 text-right">Buy Rate</th><th className="px-4 py-2 text-right">Sale Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 font-semibold">{p.name} <span className="text-[10px] text-pos-on-surface-variant">{p.size}</span></td>
                        <td className="px-4 py-2 text-xs">{p.category || '-'}</td>
                        <td className={`px-4 py-2 text-center font-bold ${p.stock <= 20 ? 'text-destructive' : ''}`}>{p.stock}</td>
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
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">payments</span>
                Payment Report
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('invoice')}</th><th className="px-4 py-2">{t('customer')}</th><th className="px-4 py-2">{t('paymentMethod')}</th><th className="px-4 py-2 text-right">{t('total')}</th><th className="px-4 py-2 text-right">{t('paid')}</th><th className="px-4 py-2 text-right">{t('due')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {filteredSales.slice(0, 20).map(s => (
                      <tr key={s.id} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 text-xs font-bold text-primary">{s.invoice}</td>
                        <td className="px-4 py-2">{s.customer}</td>
                        <td className="px-4 py-2 text-xs uppercase">{s.paymentMethod}</td>
                        <td className="px-4 py-2 text-right font-bold">{formatCurrency(s.total)}</td>
                        <td className="px-4 py-2 text-right text-[hsl(142,70%,35%)]">{formatCurrency(s.paid ?? s.total)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${(s.due ?? 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(s.due ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'customer' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">group</span>
                Customer Report ({customers.length})
              </div>
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
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">local_shipping</span>
                Supplier Report ({suppliers.length})
              </div>
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
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">trending_up</span>
                Profit Report
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold flex items-center gap-1">Revenue <InfoTooltip text="মোট বিক্রি থেকে আয়" /></div><div className="text-lg font-black mt-1">{formatCurrency(stats.totalRevenue)}</div></div>
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold flex items-center gap-1">Cost <InfoTooltip text="পণ্য কেনার খরচ" /></div><div className="text-lg font-black text-pos-on-surface-variant mt-1">{formatCurrency(stats.totalCost)}</div></div>
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold flex items-center gap-1">Profit <InfoTooltip text="Revenue − Cost = লাভ" /></div><div className={`text-lg font-black mt-1 ${stats.totalProfit >= 0 ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'}`}>{formatCurrency(stats.totalProfit)}</div></div>
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
                          <td className={`px-4 py-2 text-right font-bold ${profit >= 0 ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'}`}>{formatCurrency(profit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(activeReport === 'customer_dues' || activeReport === 'customer_walking') && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">{activeReport === 'customer_dues' ? 'Customer Dues' : 'Customer Dues (Walking)'}</div>
              <div className="space-y-2 p-4">
                {stats.dueCustomers.length > 0 ? stats.dueCustomers.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-pos-surface-low rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-destructive">{c.initials}</span>
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
                    <span className="material-symbols-outlined text-3xl text-[hsl(142,70%,35%)] block mb-2">check_circle</span>
                    No outstanding dues!
                  </div>
                )}
              </div>
            </div>
          )}

          {activeReport === 'supplier_balance' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
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

          {activeReport === 'general_transaction' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">receipt_long</span>
                General Transaction
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold flex items-center gap-1">Sales Income <InfoTooltip text="বিক্রি থেকে নগদ প্রাপ্তি" /></div><div className="text-lg font-black text-[hsl(142,70%,35%)] mt-1">{formatCurrency(stats.totalPaid)}</div></div>
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold flex items-center gap-1">Purchase Expense <InfoTooltip text="পার্চেজে নগদ ব্যয়" /></div><div className="text-lg font-black text-destructive mt-1">{formatCurrency(stats.purchasePaid)}</div></div>
                <div className="bg-pos-surface-high rounded-xl p-3"><div className="text-[10px] text-pos-on-surface-variant uppercase font-bold flex items-center gap-1">Net Balance <InfoTooltip text="Income − Expense = নিট ব্যালেন্স" /></div><div className={`text-lg font-black mt-1 ${stats.totalPaid - stats.purchasePaid >= 0 ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'}`}>{formatCurrency(stats.totalPaid - stats.purchasePaid)}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">Date</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Reference</th><th className="px-4 py-2">Party</th><th className="px-4 py-2 text-right">Amount</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {[...filteredSales.map(s => ({ date: s.date, type: 'Sale' as const, ref: s.invoice, party: s.customer, amount: s.paid ?? s.total })),
                      ...filteredPurchases.map(p => ({ date: p.date, type: 'Purchase' as const, ref: p.invoice, party: p.supplierName, amount: -p.paid }))]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 30).map((t, i) => (
                      <tr key={i} className="hover:bg-pos-surface-low">
                        <td className="px-4 py-2 text-xs">{(() => { try { return new Date(t.date).toLocaleDateString('en-GB'); } catch { return t.date; } })()}</td>
                        <td className="px-4 py-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.type === 'Sale' ? 'bg-[hsl(142,70%,92%)] text-[hsl(142,70%,30%)]' : 'bg-destructive/10 text-destructive'}`}>{t.type}</span></td>
                        <td className="px-4 py-2 text-xs font-bold text-primary">{t.ref}</td>
                        <td className="px-4 py-2">{t.party}</td>
                        <td className={`px-4 py-2 text-right font-bold ${t.amount >= 0 ? 'text-[hsl(142,70%,35%)]' : 'text-destructive'}`}>{t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'staff' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Staff Report</div>
              <div className="p-8 text-center text-pos-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 block">badge</span>
                <p className="text-sm">Staff management coming soon.</p>
              </div>
            </div>
          )}

          {activeReport === 'customer_advance' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Customer Advance</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low">
                    <th className="px-4 py-2">{t('name')}</th><th className="px-4 py-2">{t('phoneLabel')}</th><th className="px-4 py-2 text-right">Total Paid</th><th className="px-4 py-2 text-right">Total Bill</th><th className="px-4 py-2 text-right">Advance</th>
                  </tr></thead>
                  <tbody className="divide-y divide-pos-surface-container">
                    {customers.map(c => {
                      const custSales = sales.filter(s => s.customer === c.name);
                      const totalBill = custSales.reduce((sum, s) => sum + s.total, 0);
                      const totalPaid = custSales.reduce((sum, s) => sum + (s.paid ?? s.total), 0);
                      const advance = totalPaid - totalBill;
                      if (advance <= 0) return null;
                      return (
                        <tr key={c.id} className="hover:bg-pos-surface-low">
                          <td className="px-4 py-2 font-semibold">{c.name}</td>
                          <td className="px-4 py-2 text-xs">{c.phone}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(totalPaid)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(totalBill)}</td>
                          <td className="px-4 py-2 text-right font-bold text-[hsl(142,70%,35%)]">{formatCurrency(advance)}</td>
                        </tr>
                      );
                    })}
                    {customers.every(c => {
                      const custSales = sales.filter(s => s.customer === c.name);
                      const totalBill = custSales.reduce((sum, s) => sum + s.total, 0);
                      const totalPaid = custSales.reduce((sum, s) => sum + (s.paid ?? s.total), 0);
                      return totalPaid - totalBill <= 0;
                    }) && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant text-sm">No customer advances found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'staff_balance' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm">Staff Balance</div>
              <div className="p-8 text-center text-pos-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 block">account_balance_wallet</span>
                <p className="text-sm">Staff balance tracking coming soon.</p>
              </div>
            </div>
          )}

          {activeReport === 'account' && (
            <div className="bg-pos-surface-lowest rounded-2xl border border-pos-surface-container overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">account_balance</span>
                Account Reports
              </div>
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
