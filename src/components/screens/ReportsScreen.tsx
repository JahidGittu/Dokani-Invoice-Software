import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { formatCurrency, downloadCSV, type SaleRecord, type Product, type Customer, type Supplier, type PurchaseRecord } from "@/lib/store";
import { isSqftUnit } from "@/lib/calc-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ReportsScreenProps {
  sales?: SaleRecord[];
  products?: Product[];
  customers?: Customer[];
  suppliers?: Supplier[];
  purchases?: PurchaseRecord[];
}

type ReportType =
  | 'purchase_invoice' | 'purchase_product' | 'category_purchase' | 'product_purchase' | 'supplier_purchase' | 'purchase_summary'
  | 'sales_invoice' | 'sales_product' | 'category_sales' | 'product_sales' | 'sales_summary' | 'brand_sales' | 'sales_return'
  | 'overall_stock' | 'overall_stock_no_price' | 'category_stock' | 'brand_stock' | 'low_stock' | 'product_ledger' | 'damage_lost'
  | 'customer_payment' | 'supplier_payment' | 'staff_salary_payment'
  | 'general_transaction' | 'category_transaction' | 'transaction_summary'
  | 'customer_invoices' | 'customer_purchased' | 'customer_ledger'
  | 'supplier_invoices' | 'supplier_sales' | 'supplier_ledger'
  | 'staff_salary' | 'cashier_sales' | 'staff_sales'
  | 'invoice_profit' | 'product_profit' | 'net_profit'
  | 'customer_dues' | 'customer_walking' | 'customer_advance' | 'supplier_balance' | 'staff_balance'
  | 'cash_ledger' | 'all_transaction_summary' | 'account_transaction' | 'account_balance';

// Helper: report table wrapper
function ReportTable({ title, summary, headers, children, emptyText }: {
  title: string; summary?: React.ReactNode; headers: string[]; children: React.ReactNode; emptyText?: string;
}) {
  return (
    <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden print-report-table">
      <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm print:bg-gray-100">{title}</div>
      {summary && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 print:grid-cols-4">{summary}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm print:text-xs">
          <thead>
            <tr className="text-[11px] font-bold text-pos-on-surface-variant uppercase bg-pos-surface-low print:bg-gray-100">
              {headers.map((h, i) => <th key={i} className={`px-4 py-2 ${i >= headers.length - 3 ? 'text-right' : ''}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-pos-surface-container print:divide-gray-300">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-pos-surface-high rounded-lg p-3 print:border print:border-gray-300">
      <div className="text-[10px] text-pos-on-surface-variant uppercase font-bold">{label}</div>
      <div className={`text-lg font-black ${color || ''}`}>{value}</div>
    </div>
  );
}

export default function ReportsScreen({ sales = [], products = [], customers = [], suppliers = [], purchases = [] }: ReportsScreenProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeReport, setActiveReport] = useState<ReportType>('sales_invoice');
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch additional data
  const [manualTxns, setManualTxns] = useState<any[]>([]);
  const [staffs, setStaffs] = useState<any[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [duePayments, setDuePayments] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const [txRes, staffRes, logRes, dpRes, settRes] = await Promise.all([
      supabase.from('manual_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('staffs').select('*'),
      supabase.from('inventory_logs').select('*').order('created_at', { ascending: false }),
      supabase.from('due_payments').select('*').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    setManualTxns(txRes.data || []);
    setStaffs(staffRes.data || []);
    setInventoryLogs(logRes.data || []);
    setDuePayments(dpRes.data || []);
    if (settRes.data) setSettings(settRes.data);
  }, [user]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Date filtering helpers
  const inDateRange = useCallback((dateStr: string) => {
    if (!dateFrom && !dateTo) return true;
    try {
      const d = dateStr.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    } catch { return true; }
  }, [dateFrom, dateTo]);

  const filteredManualTxns = useMemo(() => manualTxns.filter(tx => inDateRange(tx.transaction_date)), [manualTxns, inDateRange]);
  const filteredSales = useMemo(() => sales.filter(s => inDateRange(s.date)), [sales, inDateRange]);
  const filteredPurchases = useMemo(() => purchases.filter(p => inDateRange(p.date)), [purchases, inDateRange]);
  const filteredLogs = useMemo(() => inventoryLogs.filter(l => inDateRange(l.created_at)), [inventoryLogs, inDateRange]);
  const filteredDuePayments = useMemo(() => duePayments.filter(d => inDateRange(d.payment_date || d.created_at)), [duePayments, inDateRange]);

  // Stats
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
    const walkingDues = filteredSales.filter(s => s.customerType === 'Walking' && (s.due ?? 0) > 0);
    const purchaseTotal = filteredPurchases.reduce((s, p) => s + p.payable, 0);
    const purchasePaid = filteredPurchases.reduce((s, p) => s + p.paid, 0);
    const purchaseDue = filteredPurchases.reduce((s, p) => s + p.due, 0);
    const manualIn = filteredManualTxns.filter(tx => tx.transaction_type === 'cash_received' || tx.transaction_type === 'loan_receive').reduce((s, tx) => s + Number(tx.amount), 0);
    const manualOut = filteredManualTxns.filter(tx => tx.transaction_type === 'cash_payment' || tx.transaction_type === 'loan_payment').reduce((s, tx) => s + Number(tx.amount), 0);
    return { totalRevenue, totalPaid, totalDue, totalProfit, totalCost, dueCustomers, walkingDues, purchaseTotal, purchasePaid, purchaseDue, manualIn, manualOut };
  }, [filteredSales, filteredPurchases, filteredManualTxns, products, customers]);

  // All sale items flat
  const allSaleItems = useMemo(() => {
    return filteredSales.flatMap(s => s.items.map(item => ({ ...item, invoice: s.invoice, customer: s.customer, saleDate: s.date, customerType: s.customerType, soldBy: s.soldBy })));
  }, [filteredSales]);

  const allPurchaseItems = useMemo(() => {
    return filteredPurchases.flatMap(p => p.items.map(item => ({ ...item, invoice: p.invoice, supplier: p.supplierName, purchaseDate: p.date })));
  }, [filteredPurchases]);

  // Group helper
  function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
    return arr.reduce((acc, item) => {
      const k = key(item) || 'অন্যান্য';
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-GB'); } catch { return d; } };

  const reportList: { id: string; label: string; icon: string; children: { id: ReportType; label: string; icon: string }[] }[] = [
    { id: 'purchase', label: 'Purchase Report', icon: 'shopping_cart', children: [
      { id: 'purchase_invoice', label: 'Invoice', icon: 'receipt' },
      { id: 'purchase_product', label: 'Product', icon: 'inventory_2' },
      { id: 'category_purchase', label: 'Category', icon: 'category' },
      { id: 'product_purchase', label: 'Prod. Wise', icon: 'view_list' },
      { id: 'supplier_purchase', label: 'Supplier', icon: 'local_shipping' },
      { id: 'purchase_summary', label: 'Summary', icon: 'summarize' },
    ]},
    { id: 'sales', label: 'Sales Report', icon: 'point_of_sale', children: [
      { id: 'sales_invoice', label: 'Invoice', icon: 'receipt_long' },
      { id: 'sales_product', label: 'Product', icon: 'inventory_2' },
      { id: 'category_sales', label: 'Category', icon: 'category' },
      { id: 'product_sales', label: 'Prod. Wise', icon: 'view_list' },
      { id: 'sales_summary', label: 'Summary', icon: 'summarize' },
      { id: 'brand_sales', label: 'Brand', icon: 'branding_watermark' },
      { id: 'sales_return', label: 'Return', icon: 'assignment_return' },
    ]},
    { id: 'stock', label: 'Stock Report', icon: 'layers', children: [
      { id: 'overall_stock', label: 'Overall', icon: 'inventory' },
      { id: 'overall_stock_no_price', label: 'No Price', icon: 'visibility_off' },
      { id: 'category_stock', label: 'Category', icon: 'category' },
      { id: 'brand_stock', label: 'Brand', icon: 'branding_watermark' },
      { id: 'low_stock', label: 'Low Stock', icon: 'warning' },
      { id: 'product_ledger', label: 'Ledger', icon: 'menu_book' },
      { id: 'damage_lost', label: 'Damage', icon: 'broken_image' },
    ]},
    { id: 'payment', label: 'Payment Report', icon: 'payments', children: [
      { id: 'customer_payment', label: 'Customer', icon: 'person' },
      { id: 'supplier_payment', label: 'Supplier', icon: 'local_shipping' },
      { id: 'staff_salary_payment', label: 'Staff', icon: 'badge' },
    ]},
    { id: 'transaction', label: 'Transaction Report', icon: 'receipt_long', children: [
      { id: 'general_transaction', label: 'General', icon: 'swap_horiz' },
      { id: 'category_transaction', label: 'Category', icon: 'category' },
      { id: 'transaction_summary', label: 'Summary', icon: 'summarize' },
    ]},
    { id: 'customer', label: 'Customer Report', icon: 'group', children: [
      { id: 'customer_invoices', label: 'Invoices', icon: 'receipt' },
      { id: 'customer_purchased', label: 'Products', icon: 'shopping_bag' },
      { id: 'customer_ledger', label: 'Ledger', icon: 'menu_book' },
    ]},
    { id: 'supplier', label: 'Supplier Report', icon: 'local_shipping', children: [
      { id: 'supplier_invoices', label: 'Invoices', icon: 'receipt' },
      { id: 'supplier_sales', label: 'Products', icon: 'shopping_bag' },
      { id: 'supplier_ledger', label: 'Ledger', icon: 'menu_book' },
    ]},
    { id: 'staff', label: 'Staff Report', icon: 'badge', children: [
      { id: 'staff_salary', label: 'Salary', icon: 'payments' },
      { id: 'cashier_sales', label: 'Cashier', icon: 'point_of_sale' },
      { id: 'staff_sales', label: 'Sales', icon: 'receipt_long' },
    ]},
    { id: 'profit', label: 'Profit Reports', icon: 'trending_up', children: [
      { id: 'invoice_profit', label: 'Invoice', icon: 'receipt' },
      { id: 'product_profit', label: 'Product', icon: 'inventory_2' },
      { id: 'net_profit', label: 'Net Profit', icon: 'trending_up' },
    ]},
    { id: 'dues', label: 'Due Reports', icon: 'warning', children: [
      { id: 'customer_dues', label: 'Cust. Dues', icon: 'person' },
      { id: 'customer_walking', label: 'Walking', icon: 'directions_walk' },
      { id: 'customer_advance', label: 'Advance', icon: 'savings' },
      { id: 'supplier_balance', label: 'Supplier', icon: 'local_shipping' },
      { id: 'staff_balance', label: 'Staff', icon: 'badge' },
    ]},
    { id: 'account', label: 'Account Reports', icon: 'account_balance', children: [
      { id: 'cash_ledger', label: 'Cash Led.', icon: 'menu_book' },
      { id: 'all_transaction_summary', label: 'All TRX', icon: 'summarize' },
      { id: 'account_transaction', label: 'Acc. TRX', icon: 'swap_horiz' },
      { id: 'account_balance', label: 'Balance', icon: 'account_balance_wallet' },
    ]},
  ];

  // Get current report label
  const currentReportLabel = useMemo(() => {
    for (const group of reportList) {
      for (const child of group.children) {
        if (child.id === activeReport) return `${group.label} — ${child.label}`;
      }
    }
    return activeReport.replace(/_/g, ' ');
  }, [activeReport]);

  const handlePrint = () => {
    window.print();
  };

  const exportReport = () => {
    let rows: string[][] = [];
    if (activeReport === 'sales_invoice') {
      rows = [['Invoice', 'Customer', 'Total', 'Paid', 'Due', 'Date'], ...filteredSales.map(s => [s.invoice, s.customer, String(s.total), String(s.paid ?? s.total), String(s.due ?? 0), s.date])];
    } else if (activeReport === 'purchase_invoice') {
      rows = [['Invoice', 'Supplier', 'Total', 'Paid', 'Due', 'Date'], ...filteredPurchases.map(p => [p.invoice, p.supplierName, String(p.payable), String(p.paid), String(p.due), p.date])];
    } else if (activeReport === 'overall_stock') {
      rows = [['Product', 'Category', 'Size', 'Stock', 'Buy Rate', 'Sale Rate'], ...products.map(p => [p.name, p.category || '', p.size, String(p.stock), String(p.buyRate || 0), String(p.pricePerBox)])];
    }
    if (rows.length > 0) { downloadCSV(rows, `${activeReport}_report.csv`); toast.success(t('reportExported')); }
  };

  // --- All Transaction rows merged ---
  const allTxnRows = useMemo(() => {
    const rows = [
      ...filteredSales.map(s => ({ date: s.date, type: 'Sale' as const, ref: s.invoice, party: s.customer, amount: s.paid ?? s.total, account: s.paymentMethod || 'Cash' })),
      ...filteredPurchases.map(p => ({ date: p.date, type: 'Purchase' as const, ref: p.invoice, party: p.supplierName, amount: -p.paid, account: 'Cash' })),
      ...filteredManualTxns.map(tx => ({
        date: tx.transaction_date,
        type: (tx.transaction_type === 'cash_received' || tx.transaction_type === 'loan_receive' ? 'Cash In' : 'Cash Out') as string,
        ref: tx.category || '-',
        party: tx.description || tx.category || '-',
        amount: tx.transaction_type === 'cash_received' || tx.transaction_type === 'loan_receive' ? Number(tx.amount) : -Number(tx.amount),
        account: tx.account || 'Cash'
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows;
  }, [filteredSales, filteredPurchases, filteredManualTxns]);

  // --- RENDER ACTIVE REPORT ---
  const renderReport = () => {
    switch (activeReport) {
      // ═══════════════ PURCHASE REPORTS ═══════════════
      case 'purchase_invoice':
        return (
          <ReportTable title={`Purchase Invoice Report (${filteredPurchases.length})`}
            summary={<>
              <SummaryCard label="Total" value={formatCurrency(stats.purchaseTotal)} />
              <SummaryCard label="Paid" value={formatCurrency(stats.purchasePaid)} color="text-[hsl(125,60%,35%)]" />
              <SummaryCard label="Due" value={formatCurrency(stats.purchaseDue)} color="text-destructive" />
            </>}
            headers={['Invoice', 'Supplier', 'Date', 'Total', 'Paid', 'Due']}>
            {filteredPurchases.map(p => (
              <tr key={p.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{p.invoice}</td>
                <td className="px-4 py-2">{p.supplierName}</td>
                <td className="px-4 py-2 text-xs">{fmtDate(p.date)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(p.payable)}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(p.paid)}</td>
                <td className={`px-4 py-2 text-right font-bold ${p.due > 0 ? 'text-destructive' : ''}`}>{formatCurrency(p.due)}</td>
              </tr>
            ))}
            {filteredPurchases.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো পার্চেজ পাওয়া যায়নি</td></tr>}
          </ReportTable>
        );

      case 'purchase_product':
        return (
          <ReportTable title={`Purchase Product Report (${allPurchaseItems.length} items)`}
            headers={['Product', 'Barcode', 'Invoice', 'Supplier', 'Ctn', 'Pcs', 'Rate', 'SubTotal']}>
            {allPurchaseItems.map((item, i) => (
              <tr key={i} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold text-xs">{item.name}</td>
                <td className="px-4 py-2 text-xs text-pos-on-surface-variant">{item.barcode}</td>
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{item.invoice}</td>
                <td className="px-4 py-2 text-xs">{item.supplier}</td>
                <td className="px-4 py-2 text-right">{item.carton}</td>
                <td className="px-4 py-2 text-right">{item.piece}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.buyRate)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(item.subTotal)}</td>
              </tr>
            ))}
            {allPurchaseItems.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );

      case 'category_purchase': {
        const grouped = groupBy(allPurchaseItems, i => {
          const prod = products.find(p => p.id === i.productId);
          return prod?.category || 'অন্যান্য';
        });
        return (
          <ReportTable title="Category Wise Purchase" headers={['Category', 'Items', 'Qty (Ctn)', 'Qty (Pcs)', 'Total']}>
            {Object.entries(grouped).map(([cat, items]) => (
              <tr key={cat} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{cat}</td>
                <td className="px-4 py-2 text-right">{items.length}</td>
                <td className="px-4 py-2 text-right">{items.reduce((s, i) => s + i.carton, 0)}</td>
                <td className="px-4 py-2 text-right">{items.reduce((s, i) => s + i.piece, 0)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(items.reduce((s, i) => s + i.subTotal, 0))}</td>
              </tr>
            ))}
            {Object.keys(grouped).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'product_purchase': {
        const grouped = groupBy(allPurchaseItems, i => i.name);
        return (
          <ReportTable title="Product Wise Purchase" headers={['Product', 'Times Purchased', 'Total Ctn', 'Total Pcs', 'Total Amount']}>
            {Object.entries(grouped).map(([name, items]) => (
              <tr key={name} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{name}</td>
                <td className="px-4 py-2 text-right">{items.length}</td>
                <td className="px-4 py-2 text-right">{items.reduce((s, i) => s + i.carton, 0)}</td>
                <td className="px-4 py-2 text-right">{items.reduce((s, i) => s + i.piece, 0)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(items.reduce((s, i) => s + i.subTotal, 0))}</td>
              </tr>
            ))}
            {Object.keys(grouped).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'supplier_purchase': {
        const grouped = groupBy(filteredPurchases, p => p.supplierName);
        return (
          <ReportTable title="Supplier Wise Purchase" headers={['Supplier', 'Invoices', 'Total', 'Paid', 'Due']}>
            {Object.entries(grouped).map(([sup, pList]) => (
              <tr key={sup} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{sup}</td>
                <td className="px-4 py-2 text-right">{pList.length}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(pList.reduce((s, p) => s + p.payable, 0))}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(pList.reduce((s, p) => s + p.paid, 0))}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(pList.reduce((s, p) => s + p.due, 0))}</td>
              </tr>
            ))}
            {Object.keys(grouped).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'purchase_summary':
        return (
          <ReportTable title="Purchase Summary"
            summary={<>
              <SummaryCard label="Total Purchase" value={formatCurrency(stats.purchaseTotal)} />
              <SummaryCard label="Total Paid" value={formatCurrency(stats.purchasePaid)} color="text-[hsl(125,60%,35%)]" />
              <SummaryCard label="Total Due" value={formatCurrency(stats.purchaseDue)} color="text-destructive" />
              <SummaryCard label="Invoices" value={String(filteredPurchases.length)} />
            </>}
            headers={['Metric', 'Value']}>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">মোট পার্চেজ সংখ্যা</td><td className="px-4 py-2 text-right font-bold">{filteredPurchases.length}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">মোট আইটেম</td><td className="px-4 py-2 text-right font-bold">{allPurchaseItems.length}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">মোট টাকা</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(stats.purchaseTotal)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">পরিশোধিত</td><td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(stats.purchasePaid)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">বাকি</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(stats.purchaseDue)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">সাপ্লায়ার সংখ্যা</td><td className="px-4 py-2 text-right font-bold">{new Set(filteredPurchases.map(p => p.supplierName)).size}</td></tr>
          </ReportTable>
        );

      // ═══════════════ SALES REPORTS ═══════════════
      case 'sales_invoice':
        return (
          <ReportTable title={`Sales Invoice Report (${filteredSales.length})`}
            summary={<>
              <SummaryCard label="Total" value={formatCurrency(stats.totalRevenue)} />
              <SummaryCard label="Paid" value={formatCurrency(stats.totalPaid)} color="text-[hsl(125,60%,35%)]" />
              <SummaryCard label="Due" value={formatCurrency(stats.totalDue)} color="text-destructive" />
            </>}
            headers={['Invoice', 'Customer', 'Date', 'Total', 'Paid', 'Due']}>
            {filteredSales.map(s => (
              <tr key={s.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                <td className="px-4 py-2">{s.customer}</td>
                <td className="px-4 py-2 text-xs">{fmtDate(s.date)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(s.total)}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(s.paid ?? s.total)}</td>
                <td className={`px-4 py-2 text-right font-bold ${(s.due ?? 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(s.due ?? 0)}</td>
              </tr>
            ))}
            {filteredSales.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো সেল পাওয়া যায়নি</td></tr>}
          </ReportTable>
        );

      case 'sales_product':
        return (
          <ReportTable title={`Sales Product Report (${allSaleItems.length} items)`}
            headers={['Product', 'Invoice', 'Customer', 'Qty', 'Rate', 'Amount']}>
            {allSaleItems.map((item, i) => (
              <tr key={i} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold text-xs">{item.name}</td>
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{item.invoice}</td>
                <td className="px-4 py-2 text-xs">{item.customer}</td>
                <td className="px-4 py-2 text-right">{item.qty}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(item.qty * item.price)}</td>
              </tr>
            ))}
            {allSaleItems.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );

      case 'category_sales': {
        const grouped = groupBy(allSaleItems, i => i.category || 'অন্যান্য');
        return (
          <ReportTable title="Category Wise Sales" headers={['Category', 'Items Sold', 'Total Qty', 'Total Amount']}>
            {Object.entries(grouped).map(([cat, items]) => (
              <tr key={cat} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{cat}</td>
                <td className="px-4 py-2 text-right">{items.length}</td>
                <td className="px-4 py-2 text-right">{items.reduce((s, i) => s + i.qty, 0)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(items.reduce((s, i) => s + i.qty * i.price, 0))}</td>
              </tr>
            ))}
            {Object.keys(grouped).length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'product_sales': {
        const grouped = groupBy(allSaleItems, i => i.productId || i.name);
        return (
          <ReportTable title="Product Wise Sales" headers={['Product', 'Times Sold', 'Total Qty', 'Total Amount']}>
            {Object.entries(grouped).map(([_, items]) => (
              <tr key={items[0].name} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{items[0].name}</td>
                <td className="px-4 py-2 text-right">{items.length}</td>
                <td className="px-4 py-2 text-right">{items.reduce((s, i) => s + i.qty, 0)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(items.reduce((s, i) => s + i.qty * i.price, 0))}</td>
              </tr>
            ))}
            {Object.keys(grouped).length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'sales_summary':
        return (
          <ReportTable title="Sales Summary"
            summary={<>
              <SummaryCard label="Revenue" value={formatCurrency(stats.totalRevenue)} />
              <SummaryCard label="Paid" value={formatCurrency(stats.totalPaid)} color="text-[hsl(125,60%,35%)]" />
              <SummaryCard label="Due" value={formatCurrency(stats.totalDue)} color="text-destructive" />
              <SummaryCard label="Profit" value={formatCurrency(stats.totalProfit)} color={stats.totalProfit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'} />
            </>}
            headers={['Metric', 'Value']}>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">মোট সেল সংখ্যা</td><td className="px-4 py-2 text-right font-bold">{filteredSales.length}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">মোট আইটেম বিক্রি</td><td className="px-4 py-2 text-right font-bold">{allSaleItems.length}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">ক্যাশ সেল</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(filteredSales.filter(s => (s.paymentMethod || 'Cash') === 'Cash').reduce((sum, s) => sum + (s.paid ?? s.total), 0))}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">বাকি সেল</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(stats.totalDue)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">মোট রিটার্ন</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(filteredSales.reduce((s, sale) => s + (sale.returnAmount || 0), 0))}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">কাস্টমার সংখ্যা</td><td className="px-4 py-2 text-right font-bold">{new Set(filteredSales.map(s => s.customer)).size}</td></tr>
          </ReportTable>
        );

      case 'brand_sales': {
        const grouped = groupBy(allSaleItems, i => {
          const prod = products.find(p => p.id === i.productId);
          return prod?.brand || 'অন্যান্য';
        });
        return (
          <ReportTable title="Brand Wise Sales Summary" headers={['Brand', 'Items Sold', 'Total Qty', 'Total Amount']}>
            {Object.entries(grouped).map(([brand, items]) => (
              <tr key={brand} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{brand}</td>
                <td className="px-4 py-2 text-right">{items.length}</td>
                <td className="px-4 py-2 text-right">{items.reduce((s, i) => s + i.qty, 0)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(items.reduce((s, i) => s + i.qty * i.price, 0))}</td>
              </tr>
            ))}
            {Object.keys(grouped).length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'sales_return': {
        const returnSales = filteredSales.filter(s => (s.returnAmount || 0) > 0);
        return (
          <ReportTable title={`Sales Return Report (${returnSales.length})`}
            summary={<SummaryCard label="Total Returns" value={formatCurrency(returnSales.reduce((s, sale) => s + (sale.returnAmount || 0), 0))} color="text-destructive" />}
            headers={['Invoice', 'Customer', 'Date', 'Return Amount', 'Total', 'Status']}>
            {returnSales.map(s => (
              <tr key={s.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                <td className="px-4 py-2">{s.customer}</td>
                <td className="px-4 py-2 text-xs">{fmtDate(s.date)}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(s.returnAmount || 0)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(s.total)}</td>
                <td className="px-4 py-2 text-right"><span className="text-xs px-2 py-0.5 bg-pos-error-container text-pos-on-error-container rounded">Return</span></td>
              </tr>
            ))}
            {returnSales.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো রিটার্ন পাওয়া যায়নি</td></tr>}
          </ReportTable>
        );
      }

      // ═══════════════ STOCK REPORTS ═══════════════
      case 'overall_stock': {
        const totalStockValue = products.reduce((s, p) => s + p.stock * (p.buyRate || 0), 0);
        const totalSaleValue = products.reduce((s, p) => s + p.stock * p.pricePerBox, 0);
        return (
          <ReportTable title={`Overall Stock Report (${products.length} products)`}
            summary={<>
              <SummaryCard label="Stock Value (Cost)" value={formatCurrency(totalStockValue)} />
              <SummaryCard label="Stock Value (Sale)" value={formatCurrency(totalSaleValue)} color="text-[hsl(125,60%,35%)]" />
            </>}
            headers={['Product', 'Category', 'Size', 'Stock', 'Buy Rate', 'Sale Rate']}>
            {products.map(p => (
              <tr key={p.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{p.name} <span className="text-[10px] text-pos-on-surface-variant">{p.batch}</span></td>
                <td className="px-4 py-2 text-xs">{p.category || '-'}</td>
                <td className="px-4 py-2 text-xs">{p.size}</td>
                <td className={`px-4 py-2 text-right font-bold ${p.stock <= (p.reorderLimit || 20) ? 'text-pos-error' : ''}`}>{p.stock}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(p.buyRate || 0)}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(p.pricePerBox)}</td>
              </tr>
            ))}
          </ReportTable>
        );
      }

      case 'overall_stock_no_price':
        return (
          <ReportTable title={`Stock Report Without Price (${products.length})`}
            headers={['Product', 'Category', 'Brand', 'Size', 'Stock']}>
            {products.map(p => (
              <tr key={p.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{p.name}</td>
                <td className="px-4 py-2 text-xs">{p.category || '-'}</td>
                <td className="px-4 py-2 text-xs">{p.brand || '-'}</td>
                <td className="px-4 py-2 text-xs">{p.size}</td>
                <td className={`px-4 py-2 text-right font-bold ${p.stock <= (p.reorderLimit || 20) ? 'text-pos-error' : ''}`}>{p.stock}</td>
              </tr>
            ))}
          </ReportTable>
        );

      case 'category_stock': {
        const grouped = groupBy(products, p => p.category || 'অন্যান্য');
        return (
          <ReportTable title="Category Wise Stock" headers={['Category', 'Products', 'Total Stock', 'Stock Value (Cost)', 'Stock Value (Sale)']}>
            {Object.entries(grouped).map(([cat, prods]) => (
              <tr key={cat} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{cat}</td>
                <td className="px-4 py-2 text-right">{prods.length}</td>
                <td className="px-4 py-2 text-right font-bold">{prods.reduce((s, p) => s + p.stock, 0)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(prods.reduce((s, p) => s + p.stock * (p.buyRate || 0), 0))}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(prods.reduce((s, p) => s + p.stock * p.pricePerBox, 0))}</td>
              </tr>
            ))}
          </ReportTable>
        );
      }

      case 'brand_stock': {
        const grouped = groupBy(products, p => p.brand || 'অন্যান্য');
        return (
          <ReportTable title="Brand Wise Stock" headers={['Brand', 'Products', 'Total Stock', 'Stock Value (Cost)', 'Stock Value (Sale)']}>
            {Object.entries(grouped).map(([brand, prods]) => (
              <tr key={brand} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{brand}</td>
                <td className="px-4 py-2 text-right">{prods.length}</td>
                <td className="px-4 py-2 text-right font-bold">{prods.reduce((s, p) => s + p.stock, 0)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(prods.reduce((s, p) => s + p.stock * (p.buyRate || 0), 0))}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(prods.reduce((s, p) => s + p.stock * p.pricePerBox, 0))}</td>
              </tr>
            ))}
          </ReportTable>
        );
      }

      case 'low_stock': {
        const lowStockItems = products.filter(p => p.stock <= (p.reorderLimit || 20));
        return (
          <ReportTable title={`Low Stock Alert (${lowStockItems.length} items)`}
            headers={['Product', 'Category', 'Current Stock', 'Reorder Limit', 'Status']}>
            {lowStockItems.map(p => (
              <tr key={p.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{p.name} <span className="text-[10px] text-pos-on-surface-variant">{p.size}</span></td>
                <td className="px-4 py-2 text-xs">{p.category || '-'}</td>
                <td className="px-4 py-2 text-right font-bold text-pos-error">{p.stock}</td>
                <td className="px-4 py-2 text-right">{p.reorderLimit || 20}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${p.stock === 0 ? 'bg-pos-error-container text-pos-on-error-container' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                    {p.stock === 0 ? 'Out of Stock' : 'Low'}
                  </span>
                </td>
              </tr>
            ))}
            {lowStockItems.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[hsl(125,60%,35%)]"><span className="material-symbols-outlined align-middle mr-1">check_circle</span>সব স্টক ঠিক আছে!</td></tr>}
          </ReportTable>
        );
      }

      case 'product_ledger':
        return (
          <ReportTable title={`Product Ledger (${filteredLogs.length} entries)`}
            headers={['Date', 'Product', 'Type', 'Qty', 'After', 'Note']}>
            {filteredLogs.slice(0, 200).map(log => (
              <tr key={log.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs">{fmtDate(log.created_at)}</td>
                <td className="px-4 py-2 font-semibold text-xs">{log.product_name}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${log.log_type === 'IN' ? 'bg-[hsl(125,60%,90%)] text-[hsl(125,60%,25%)]' : 'bg-[hsl(0,60%,90%)] text-destructive'}`}>
                    {log.log_type}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-bold">{log.qty}</td>
                <td className="px-4 py-2 text-right">{log.total_after}</td>
                <td className="px-4 py-2 text-xs text-pos-on-surface-variant">{log.note}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );

      case 'damage_lost': {
        const damageLogs = filteredLogs.filter(l => l.note?.toLowerCase().includes('damage') || l.note?.toLowerCase().includes('lost') || l.note?.toLowerCase().includes('ক্ষতি'));
        return (
          <ReportTable title={`Damage/Lost Report (${damageLogs.length})`}
            headers={['Date', 'Product', 'Qty', 'Note']}>
            {damageLogs.map(log => (
              <tr key={log.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs">{fmtDate(log.created_at)}</td>
                <td className="px-4 py-2 font-semibold">{log.product_name}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{log.qty}</td>
                <td className="px-4 py-2 text-xs">{log.note}</td>
              </tr>
            ))}
            {damageLogs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[hsl(125,60%,35%)]"><span className="material-symbols-outlined align-middle mr-1">check_circle</span>কোনো ক্ষতি/হারানোর রেকর্ড নেই</td></tr>}
          </ReportTable>
        );
      }

      // ═══════════════ PAYMENT REPORTS ═══════════════
      case 'customer_payment': {
        const custPayments = [...filteredSales.map(s => ({ date: s.date, invoice: s.invoice, party: s.customer, method: s.paymentMethod || 'Cash', total: s.total, paid: s.paid ?? s.total, due: s.due ?? 0 })),
          ...filteredDuePayments.filter(d => d.reference_type === 'sale').map(d => ({ date: d.payment_date?.slice(0, 10) || d.created_at?.slice(0, 10), invoice: 'Due Payment', party: d.customer_or_supplier, method: d.payment_method, total: 0, paid: Number(d.amount), due: 0 }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return (
          <ReportTable title={`Customer Payment Receive (${custPayments.length})`}
            summary={<SummaryCard label="Total Received" value={formatCurrency(custPayments.reduce((s, p) => s + p.paid, 0))} color="text-[hsl(125,60%,35%)]" />}
            headers={['Date', 'Invoice', 'Customer', 'Method', 'Total', 'Paid', 'Due']}>
            {custPayments.map((p, i) => (
              <tr key={i} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs">{fmtDate(p.date)}</td>
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{p.invoice}</td>
                <td className="px-4 py-2">{p.party}</td>
                <td className="px-4 py-2 text-xs uppercase">{p.method}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(p.total)}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(p.paid)}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{p.due > 0 ? formatCurrency(p.due) : '-'}</td>
              </tr>
            ))}
            {custPayments.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'supplier_payment': {
        const supPayments = [...filteredPurchases.map(p => ({ date: p.date, invoice: p.invoice, party: p.supplierName, total: p.payable, paid: p.paid, due: p.due })),
          ...filteredDuePayments.filter(d => d.reference_type === 'purchase').map(d => ({ date: d.payment_date?.slice(0, 10) || d.created_at?.slice(0, 10), invoice: 'Due Payment', party: d.customer_or_supplier, total: 0, paid: Number(d.amount), due: 0 }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return (
          <ReportTable title={`Supplier Payment Report (${supPayments.length})`}
            summary={<SummaryCard label="Total Paid" value={formatCurrency(supPayments.reduce((s, p) => s + p.paid, 0))} color="text-destructive" />}
            headers={['Date', 'Invoice', 'Supplier', 'Total', 'Paid', 'Due']}>
            {supPayments.map((p, i) => (
              <tr key={i} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs">{fmtDate(p.date)}</td>
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{p.invoice}</td>
                <td className="px-4 py-2">{p.party}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(p.total)}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(p.paid)}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{p.due > 0 ? formatCurrency(p.due) : '-'}</td>
              </tr>
            ))}
            {supPayments.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'staff_salary_payment': {
        const salaryTxns = filteredManualTxns.filter(tx => tx.category?.toLowerCase().includes('salary') || tx.category?.toLowerCase().includes('বেতন'));
        return (
          <ReportTable title={`Staff Salary Payment (${salaryTxns.length})`}
            summary={<SummaryCard label="Total Salary Paid" value={formatCurrency(salaryTxns.reduce((s, tx) => s + Number(tx.amount), 0))} color="text-destructive" />}
            headers={['Date', 'Description', 'Account', 'Amount']}>
            {salaryTxns.map((tx, i) => (
              <tr key={i} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs">{fmtDate(tx.transaction_date)}</td>
                <td className="px-4 py-2">{tx.description || tx.category}</td>
                <td className="px-4 py-2 text-xs uppercase">{tx.account}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(Number(tx.amount))}</td>
              </tr>
            ))}
            {salaryTxns.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো বেতন পেমেন্ট পাওয়া যায়নি</td></tr>}
          </ReportTable>
        );
      }

      // ═══════════════ TRANSACTION REPORTS ═══════════════
      case 'general_transaction':
        return (
          <ReportTable title={`General Transaction (${allTxnRows.length})`}
            summary={<>
              <SummaryCard label="Sales Income" value={formatCurrency(stats.totalPaid)} color="text-[hsl(125,60%,35%)]" />
              <SummaryCard label="Purchase Expense" value={formatCurrency(stats.purchasePaid)} color="text-destructive" />
              <SummaryCard label="Manual In" value={formatCurrency(stats.manualIn)} color="text-pos-secondary" />
              <SummaryCard label="Net Balance" value={formatCurrency(stats.totalPaid - stats.purchasePaid + stats.manualIn - stats.manualOut)} color={stats.totalPaid - stats.purchasePaid + stats.manualIn - stats.manualOut >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'} />
            </>}
            headers={['Date', 'Type', 'Reference', 'Party', 'Amount']}>
            {allTxnRows.map((t, i) => (
              <tr key={i} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs">{fmtDate(t.date)}</td>
                <td className="px-4 py-2"><span className={`text-xs font-bold px-2 py-0.5 rounded ${t.type === 'Sale' ? 'bg-[hsl(125,60%,90%)] text-[hsl(125,60%,25%)]' : t.type === 'Cash In' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-[hsl(0,60%,90%)] text-destructive'}`}>{t.type}</span></td>
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{t.ref}</td>
                <td className="px-4 py-2">{t.party}</td>
                <td className={`px-4 py-2 text-right font-bold ${t.amount >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount)}</td>
              </tr>
            ))}
            {allTxnRows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );

      case 'category_transaction': {
        const catGrouped = groupBy(filteredManualTxns, tx => tx.category || 'অন্যান্য');
        return (
          <ReportTable title="Category Wise Transaction" headers={['Category', 'Count', 'Cash In', 'Cash Out', 'Net']}>
            {Object.entries(catGrouped).map(([cat, txns]) => {
              const cashIn = txns.filter(tx => tx.transaction_type === 'cash_received' || tx.transaction_type === 'loan_receive').reduce((s, tx) => s + Number(tx.amount), 0);
              const cashOut = txns.filter(tx => tx.transaction_type === 'cash_payment' || tx.transaction_type === 'loan_payment').reduce((s, tx) => s + Number(tx.amount), 0);
              return (
                <tr key={cat} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2 font-semibold">{cat}</td>
                  <td className="px-4 py-2 text-right">{txns.length}</td>
                  <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(cashIn)}</td>
                  <td className="px-4 py-2 text-right text-destructive">{formatCurrency(cashOut)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${cashIn - cashOut >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(cashIn - cashOut)}</td>
                </tr>
              );
            })}
            {/* Add sales and purchases as categories */}
            <tr className="hover:bg-pos-surface-low bg-pos-surface-low/50">
              <td className="px-4 py-2 font-semibold">বিক্রয় আয়</td>
              <td className="px-4 py-2 text-right">{filteredSales.length}</td>
              <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalPaid)}</td>
              <td className="px-4 py-2 text-right">-</td>
              <td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalPaid)}</td>
            </tr>
            <tr className="hover:bg-pos-surface-low bg-pos-surface-low/50">
              <td className="px-4 py-2 font-semibold">পার্চেজ খরচ</td>
              <td className="px-4 py-2 text-right">{filteredPurchases.length}</td>
              <td className="px-4 py-2 text-right">-</td>
              <td className="px-4 py-2 text-right text-destructive">{formatCurrency(stats.purchasePaid)}</td>
              <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(-stats.purchasePaid)}</td>
            </tr>
          </ReportTable>
        );
      }

      case 'transaction_summary':
        return (
          <ReportTable title="Transaction Summary"
            summary={<>
              <SummaryCard label="Total In" value={formatCurrency(stats.totalPaid + stats.manualIn)} color="text-[hsl(125,60%,35%)]" />
              <SummaryCard label="Total Out" value={formatCurrency(stats.purchasePaid + stats.manualOut)} color="text-destructive" />
              <SummaryCard label="Net" value={formatCurrency(stats.totalPaid + stats.manualIn - stats.purchasePaid - stats.manualOut)} />
            </>}
            headers={['Source', 'In', 'Out', 'Net']}>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">বিক্রয়</td><td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalPaid)}</td><td className="px-4 py-2 text-right">-</td><td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalPaid)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">পার্চেজ</td><td className="px-4 py-2 text-right">-</td><td className="px-4 py-2 text-right text-destructive">{formatCurrency(stats.purchasePaid)}</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(-stats.purchasePaid)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">ম্যানুয়াল ইন</td><td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(stats.manualIn)}</td><td className="px-4 py-2 text-right">-</td><td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(stats.manualIn)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">ম্যানুয়াল আউট</td><td className="px-4 py-2 text-right">-</td><td className="px-4 py-2 text-right text-destructive">{formatCurrency(stats.manualOut)}</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(-stats.manualOut)}</td></tr>
            <tr className="bg-pos-surface-high font-bold"><td className="px-4 py-3 font-bold">মোট</td><td className="px-4 py-3 text-right text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalPaid + stats.manualIn)}</td><td className="px-4 py-3 text-right text-destructive">{formatCurrency(stats.purchasePaid + stats.manualOut)}</td><td className={`px-4 py-3 text-right ${stats.totalPaid + stats.manualIn - stats.purchasePaid - stats.manualOut >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(stats.totalPaid + stats.manualIn - stats.purchasePaid - stats.manualOut)}</td></tr>
          </ReportTable>
        );

      // ═══════════════ CUSTOMER REPORTS ═══════════════
      case 'customer_invoices':
        return (
          <ReportTable title={`Customer Report (${customers.length})`}
            headers={['Name', 'Phone', 'Invoices', 'Total Spent', 'Due']}>
            {customers.map(c => {
              const custSales = filteredSales.filter(s => s.customer === c.name);
              return (
                <tr key={c.id} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2 font-semibold">{c.name}</td>
                  <td className="px-4 py-2 text-xs">{c.phone}</td>
                  <td className="px-4 py-2 text-right">{custSales.length}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(c.totalSpent)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${(c.totalDue || 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(c.totalDue || 0)}</td>
                </tr>
              );
            })}
            {customers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো কাস্টমার নেই</td></tr>}
          </ReportTable>
        );

      case 'customer_purchased': {
        const custProducts = groupBy(allSaleItems, i => i.customer || 'Walking');
        return (
          <ReportTable title="Customer Purchased Products" headers={['Customer', 'Product', 'Qty', 'Rate', 'Amount']}>
            {Object.entries(custProducts).flatMap(([cust, items]) =>
              items.map((item, i) => (
                <tr key={`${cust}-${i}`} className="hover:bg-pos-surface-low">
                  {i === 0 && <td className="px-4 py-2 font-semibold" rowSpan={items.length}>{cust}</td>}
                  <td className="px-4 py-2 text-xs">{item.name}</td>
                  <td className="px-4 py-2 text-right">{item.qty}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(item.qty * item.price)}</td>
                </tr>
              ))
            )}
            {Object.keys(custProducts).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'customer_ledger':
        return (
          <ReportTable title="Customer Ledger"
            headers={['Customer', 'Total Purchase', 'Total Paid', 'Due', 'Advance']}>
            {customers.map(c => {
              const custSales = sales.filter(s => s.customer === c.name);
              const totalBill = custSales.reduce((sum, s) => sum + s.total, 0);
              const totalPaid = custSales.reduce((sum, s) => sum + (s.paid ?? s.total), 0);
              const due = Math.max(0, totalBill - totalPaid);
              const advance = Math.max(0, totalPaid - totalBill);
              return (
                <tr key={c.id} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2 font-semibold">{c.name}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(totalBill)}</td>
                  <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(totalPaid)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${due > 0 ? 'text-destructive' : ''}`}>{formatCurrency(due)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${advance > 0 ? 'text-[hsl(125,60%,35%)]' : ''}`}>{formatCurrency(advance)}</td>
                </tr>
              );
            })}
            {customers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো কাস্টমার নেই</td></tr>}
          </ReportTable>
        );

      // ═══════════════ SUPPLIER REPORTS ═══════════════
      case 'supplier_invoices':
        return (
          <ReportTable title={`Supplier Report (${suppliers.length})`}
            headers={['Name', 'Contact', 'Phone', 'Address', 'Total Due']}>
            {suppliers.map(s => (
              <tr key={s.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{s.name}</td>
                <td className="px-4 py-2 text-xs">{s.contactPerson}</td>
                <td className="px-4 py-2 text-xs">{s.phone}</td>
                <td className="px-4 py-2 text-xs">{s.address}</td>
                <td className={`px-4 py-2 text-right font-bold ${(s.totalDue || 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(s.totalDue || 0)}</td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো সাপ্লায়ার নেই</td></tr>}
          </ReportTable>
        );

      case 'supplier_sales': {
        const supProducts = groupBy(allPurchaseItems, i => i.supplier);
        return (
          <ReportTable title="Supplier Products Report" headers={['Supplier', 'Product', 'Ctn', 'Pcs', 'Rate', 'SubTotal']}>
            {Object.entries(supProducts).flatMap(([sup, items]) =>
              items.map((item, i) => (
                <tr key={`${sup}-${i}`} className="hover:bg-pos-surface-low">
                  {i === 0 && <td className="px-4 py-2 font-semibold" rowSpan={items.length}>{sup}</td>}
                  <td className="px-4 py-2 text-xs">{item.name}</td>
                  <td className="px-4 py-2 text-right">{item.carton}</td>
                  <td className="px-4 py-2 text-right">{item.piece}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.buyRate)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(item.subTotal)}</td>
                </tr>
              ))
            )}
            {Object.keys(supProducts).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'supplier_ledger':
        return (
          <ReportTable title="Supplier Ledger"
            headers={['Supplier', 'Total Purchase', 'Total Paid', 'Due']}>
            {suppliers.map(s => {
              const supPurchases = purchases.filter(p => p.supplierName === s.name);
              const totalPurchase = supPurchases.reduce((sum, p) => sum + p.payable, 0);
              const totalPaid = supPurchases.reduce((sum, p) => sum + p.paid, 0);
              return (
                <tr key={s.id} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2 font-semibold">{s.name}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(totalPurchase)}</td>
                  <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(totalPaid)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${s.totalDue > 0 ? 'text-destructive' : ''}`}>{formatCurrency(s.totalDue)}</td>
                </tr>
              );
            })}
            {suppliers.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো সাপ্লায়ার নেই</td></tr>}
          </ReportTable>
        );

      // ═══════════════ STAFF REPORTS ═══════════════
      case 'staff_salary':
        return (
          <ReportTable title={`Staff Salary Report (${staffs.length})`}
            summary={<SummaryCard label="Total Monthly Salary" value={formatCurrency(staffs.reduce((s, st) => s + Number(st.salary || 0), 0))} />}
            headers={['Name', 'Role', 'Phone', 'Join Date', 'Status', 'Salary']}>
            {staffs.map(st => (
              <tr key={st.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{st.name}</td>
                <td className="px-4 py-2 text-xs">{st.role}</td>
                <td className="px-4 py-2 text-xs">{st.phone}</td>
                <td className="px-4 py-2 text-xs">{fmtDate(st.join_date)}</td>
                <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded font-bold ${st.status === 'active' ? 'bg-[hsl(125,60%,90%)] text-[hsl(125,60%,25%)]' : 'bg-[hsl(0,60%,90%)] text-destructive'}`}>{st.status}</span></td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(Number(st.salary || 0))}</td>
              </tr>
            ))}
            {staffs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো স্টাফ নেই — Staff পেজ থেকে যোগ করুন</td></tr>}
          </ReportTable>
        );

      case 'cashier_sales': {
        const bySoldBy = groupBy(filteredSales, s => s.soldBy || 'N/A');
        return (
          <ReportTable title="Cashier Wise Sales" headers={['Cashier', 'Invoices', 'Total Sales', 'Total Paid', 'Total Due']}>
            {Object.entries(bySoldBy).map(([cashier, sList]) => (
              <tr key={cashier} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{cashier}</td>
                <td className="px-4 py-2 text-right">{sList.length}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(sList.reduce((s, sale) => s + sale.total, 0))}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(sList.reduce((s, sale) => s + (sale.paid ?? sale.total), 0))}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(sList.reduce((s, sale) => s + (sale.due ?? 0), 0))}</td>
              </tr>
            ))}
            {Object.keys(bySoldBy).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'staff_sales': {
        const bySoldBy = groupBy(filteredSales, s => s.soldBy || 'N/A');
        return (
          <ReportTable title="Staff Wise Sales Report" headers={['Staff', 'Invoice', 'Customer', 'Date', 'Amount']}>
            {Object.entries(bySoldBy).flatMap(([staff, sList]) =>
              sList.map((s, i) => (
                <tr key={`${staff}-${i}`} className="hover:bg-pos-surface-low">
                  {i === 0 && <td className="px-4 py-2 font-semibold" rowSpan={sList.length}>{staff}</td>}
                  <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                  <td className="px-4 py-2">{s.customer}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(s.date)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(s.total)}</td>
                </tr>
              ))
            )}
            {Object.keys(bySoldBy).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      // ═══════════════ PROFIT REPORTS ═══════════════
      case 'invoice_profit':
        return (
          <ReportTable title="Invoice Wise Profit"
            summary={<>
              <SummaryCard label="Revenue" value={formatCurrency(stats.totalRevenue)} />
              <SummaryCard label="Cost" value={formatCurrency(stats.totalCost)} color="text-pos-on-surface-variant" />
              <SummaryCard label="Profit" value={formatCurrency(stats.totalProfit)} color={stats.totalProfit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'} />
            </>}
            headers={['Invoice', 'Customer', 'Revenue', 'Cost', 'Profit']}>
            {filteredSales.map(s => {
              const revenue = s.total;
              let cost = 0;
              s.items.forEach(item => {
                const prod = products.find(p => p.id === item.productId);
                if (prod) {
                  const effQty = isSqftUnit(prod.unit) ? (item.sqftQty ?? item.qty) : item.qty;
                  cost += (prod.buyRate || 0) * effQty;
                }
              });
              const profit = revenue - cost;
              return (
                <tr key={s.id} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                  <td className="px-4 py-2">{s.customer}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(revenue)}</td>
                  <td className="px-4 py-2 text-right text-pos-on-surface-variant">{formatCurrency(cost)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${profit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(profit)}</td>
                </tr>
              );
            })}
            {filteredSales.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );

      case 'product_profit': {
        const productProfits = products.map(p => {
          const soldQty = filteredSales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((sq, i) => {
            return sq + (isSqftUnit(p.unit) ? (i.sqftQty ?? i.qty) : i.qty);
          }, 0), 0);
          if (soldQty === 0) return null;
          const revenue = filteredSales.reduce((sum, s) => sum + s.items.filter(i => i.productId === p.id).reduce((sr, i) => sr + i.qty * i.price, 0), 0);
          const cost = soldQty * (p.buyRate || 0);
          return { ...p, soldQty, revenue, cost, profit: revenue - cost };
        }).filter(Boolean) as any[];

        return (
          <ReportTable title="Product Wise Profit" headers={['Product', 'Sold Qty', 'Revenue', 'Cost', 'Profit']}>
            {productProfits.map(p => (
              <tr key={p.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{p.name} <span className="text-[10px] text-pos-on-surface-variant">{p.size}</span></td>
                <td className="px-4 py-2 text-right">{p.soldQty}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(p.revenue)}</td>
                <td className="px-4 py-2 text-right text-pos-on-surface-variant">{formatCurrency(p.cost)}</td>
                <td className={`px-4 py-2 text-right font-bold ${p.profit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(p.profit)}</td>
              </tr>
            ))}
            {productProfits.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'net_profit':
        return (
          <ReportTable title="Net Profit Report"
            summary={<>
              <SummaryCard label="Gross Revenue" value={formatCurrency(stats.totalRevenue)} />
              <SummaryCard label="Product Cost" value={formatCurrency(stats.totalCost)} color="text-destructive" />
              <SummaryCard label="Gross Profit" value={formatCurrency(stats.totalProfit)} color={stats.totalProfit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'} />
              <SummaryCard label="Operating Expense" value={formatCurrency(stats.manualOut)} color="text-destructive" />
            </>}
            headers={['Item', 'Amount']}>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">বিক্রয় আয়</td><td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalRevenue)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">(-) পণ্য খরচ (COGS)</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(stats.totalCost)}</td></tr>
            <tr className="bg-pos-surface-high"><td className="px-4 py-2 font-bold">= গ্রস প্রফিট</td><td className={`px-4 py-2 text-right font-black ${stats.totalProfit >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(stats.totalProfit)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">(-) অপারেটিং খরচ</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(stats.manualOut)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2">(+) অন্যান্য আয়</td><td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(stats.manualIn)}</td></tr>
            <tr className="bg-pos-secondary/10"><td className="px-4 py-3 font-black text-lg">= নেট প্রফিট</td><td className={`px-4 py-3 text-right font-black text-xl ${stats.totalProfit - stats.manualOut + stats.manualIn >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(stats.totalProfit - stats.manualOut + stats.manualIn)}</td></tr>
          </ReportTable>
        );

      // ═══════════════ DUE REPORTS ═══════════════
      case 'customer_dues':
        return (
          <ReportTable title={`Customer Dues (${stats.dueCustomers.length})`}
            summary={<SummaryCard label="Total Due" value={formatCurrency(stats.dueCustomers.reduce((s, c) => s + (c.totalDue || 0), 0))} color="text-destructive" />}
            headers={['Customer', 'Phone', 'Total Spent', 'Due']}>
            {stats.dueCustomers.map(c => (
              <tr key={c.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{c.name}</td>
                <td className="px-4 py-2 text-xs">{c.phone}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(c.totalSpent)}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(c.totalDue || 0)}</td>
              </tr>
            ))}
            {stats.dueCustomers.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[hsl(125,60%,35%)]"><span className="material-symbols-outlined align-middle mr-1">check_circle</span>কোনো বকেয়া নেই!</td></tr>}
          </ReportTable>
        );

      case 'customer_walking': {
        const walkingDues = filteredSales.filter(s => s.customerType === 'Walking' && (s.due ?? 0) > 0);
        return (
          <ReportTable title={`Walking Customer Dues (${walkingDues.length})`}
            summary={<SummaryCard label="Total Walking Due" value={formatCurrency(walkingDues.reduce((s, sale) => s + (sale.due ?? 0), 0))} color="text-destructive" />}
            headers={['Invoice', 'Customer', 'Phone', 'Date', 'Total', 'Due']}>
            {walkingDues.map(s => (
              <tr key={s.id} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs font-bold text-pos-secondary">{s.invoice}</td>
                <td className="px-4 py-2">{s.customer}</td>
                <td className="px-4 py-2 text-xs">{s.phone}</td>
                <td className="px-4 py-2 text-xs">{fmtDate(s.date)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(s.total)}</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(s.due ?? 0)}</td>
              </tr>
            ))}
            {walkingDues.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[hsl(125,60%,35%)]"><span className="material-symbols-outlined align-middle mr-1">check_circle</span>কোনো বকেয়া নেই!</td></tr>}
          </ReportTable>
        );
      }

      case 'customer_advance':
        return (
          <ReportTable title="Customer Advance"
            headers={['Name', 'Phone', 'Total Paid', 'Total Bill', 'Advance']}>
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
                  <td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(advance)}</td>
                </tr>
              );
            })}
            {customers.every(c => {
              const custSales = sales.filter(s => s.customer === c.name);
              return (custSales.reduce((sum, s) => sum + (s.paid ?? s.total), 0) - custSales.reduce((sum, s) => sum + s.total, 0)) <= 0;
            }) && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো অগ্রিম পাওয়া যায়নি</td></tr>}
          </ReportTable>
        );

      case 'supplier_balance':
        return (
          <ReportTable title="Supplier Balance"
            summary={<SummaryCard label="Total Supplier Due" value={formatCurrency(suppliers.reduce((s, sup) => s + (sup.totalDue || 0), 0))} color="text-destructive" />}
            headers={['Supplier', 'Phone', 'Total Purchase', 'Paid', 'Balance Due']}>
            {suppliers.map(s => {
              const supPurchases = purchases.filter(p => p.supplierName === s.name);
              return (
                <tr key={s.id} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2 font-semibold">{s.name}</td>
                  <td className="px-4 py-2 text-xs">{s.phone}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(supPurchases.reduce((sum, p) => sum + p.payable, 0))}</td>
                  <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(supPurchases.reduce((sum, p) => sum + p.paid, 0))}</td>
                  <td className={`px-4 py-2 text-right font-bold ${s.totalDue > 0 ? 'text-destructive' : 'text-[hsl(125,60%,35%)]'}`}>{formatCurrency(s.totalDue)}</td>
                </tr>
              );
            })}
            {suppliers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো সাপ্লায়ার নেই</td></tr>}
          </ReportTable>
        );

      case 'staff_balance':
        return (
          <ReportTable title="Staff Balance"
            headers={['Staff', 'Role', 'Monthly Salary', 'Salary Paid', 'Balance']}>
            {staffs.map(st => {
              const salaryPaid = manualTxns.filter(tx =>
                (tx.category?.toLowerCase().includes('salary') || tx.category?.toLowerCase().includes('বেতন')) &&
                tx.description?.toLowerCase().includes(st.name.toLowerCase())
              ).reduce((s, tx) => s + Number(tx.amount), 0);
              return (
                <tr key={st.id} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2 font-semibold">{st.name}</td>
                  <td className="px-4 py-2 text-xs">{st.role}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(Number(st.salary || 0))}</td>
                  <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(salaryPaid)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(Number(st.salary || 0) - salaryPaid)}</td>
                </tr>
              );
            })}
            {staffs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো স্টাফ নেই</td></tr>}
          </ReportTable>
        );

      // ═══════════════ ACCOUNT REPORTS ═══════════════
      case 'cash_ledger': {
        let balance = 0;
        const ledgerRows = allTxnRows.filter(t => t.account === 'Cash' || t.type === 'Sale' || t.type === 'Purchase').reverse().map(t => {
          balance += t.amount;
          return { ...t, balance };
        }).reverse();
        return (
          <ReportTable title="Cash Ledger"
            headers={['Date', 'Type', 'Party', 'In', 'Out', 'Balance']}>
            {ledgerRows.map((t, i) => (
              <tr key={i} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 text-xs">{fmtDate(t.date)}</td>
                <td className="px-4 py-2"><span className={`text-xs font-bold px-2 py-0.5 rounded ${t.amount >= 0 ? 'bg-[hsl(125,60%,90%)] text-[hsl(125,60%,25%)]' : 'bg-[hsl(0,60%,90%)] text-destructive'}`}>{t.type}</span></td>
                <td className="px-4 py-2 text-xs">{t.party}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{t.amount > 0 ? formatCurrency(t.amount) : '-'}</td>
                <td className="px-4 py-2 text-right text-destructive">{t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '-'}</td>
                <td className={`px-4 py-2 text-right font-bold ${t.balance >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(t.balance)}</td>
              </tr>
            ))}
            {ledgerRows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-pos-on-surface-variant">কোনো ডাটা নেই</td></tr>}
          </ReportTable>
        );
      }

      case 'all_transaction_summary':
        return (
          <ReportTable title="All Transaction Summary"
            summary={<>
              <SummaryCard label="Sales" value={formatCurrency(stats.totalPaid)} color="text-[hsl(125,60%,35%)]" />
              <SummaryCard label="Purchase" value={formatCurrency(stats.purchasePaid)} color="text-destructive" />
              <SummaryCard label="Manual In" value={formatCurrency(stats.manualIn)} color="text-pos-secondary" />
              <SummaryCard label="Manual Out" value={formatCurrency(stats.manualOut)} color="text-destructive" />
            </>}
            headers={['Type', 'Count', 'Total Amount']}>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">বিক্রয়</td><td className="px-4 py-2 text-right">{filteredSales.length}</td><td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(stats.totalPaid)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">পার্চেজ</td><td className="px-4 py-2 text-right">{filteredPurchases.length}</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(stats.purchasePaid)}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">নগদ গ্রহণ</td><td className="px-4 py-2 text-right">{filteredManualTxns.filter(tx => tx.transaction_type === 'cash_received').length}</td><td className="px-4 py-2 text-right font-bold text-[hsl(125,60%,35%)]">{formatCurrency(filteredManualTxns.filter(tx => tx.transaction_type === 'cash_received').reduce((s, tx) => s + Number(tx.amount), 0))}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">নগদ পেমেন্ট</td><td className="px-4 py-2 text-right">{filteredManualTxns.filter(tx => tx.transaction_type === 'cash_payment').length}</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(filteredManualTxns.filter(tx => tx.transaction_type === 'cash_payment').reduce((s, tx) => s + Number(tx.amount), 0))}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">লোন গ্রহণ</td><td className="px-4 py-2 text-right">{filteredManualTxns.filter(tx => tx.transaction_type === 'loan_receive').length}</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(filteredManualTxns.filter(tx => tx.transaction_type === 'loan_receive').reduce((s, tx) => s + Number(tx.amount), 0))}</td></tr>
            <tr className="hover:bg-pos-surface-low"><td className="px-4 py-2 font-semibold">লোন পেমেন্ট</td><td className="px-4 py-2 text-right">{filteredManualTxns.filter(tx => tx.transaction_type === 'loan_payment').length}</td><td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(filteredManualTxns.filter(tx => tx.transaction_type === 'loan_payment').reduce((s, tx) => s + Number(tx.amount), 0))}</td></tr>
            <tr className="bg-pos-surface-high font-bold">
              <td className="px-4 py-3 font-bold">নেট ব্যালেন্স</td>
              <td className="px-4 py-3 text-right">{filteredSales.length + filteredPurchases.length + filteredManualTxns.length}</td>
              <td className={`px-4 py-3 text-right font-black ${stats.totalPaid - stats.purchasePaid + stats.manualIn - stats.manualOut >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(stats.totalPaid - stats.purchasePaid + stats.manualIn - stats.manualOut)}</td>
            </tr>
          </ReportTable>
        );

      case 'account_transaction': {
        const accounts = ['Cash', 'bKash', 'Nagad', 'Card'];
        const byAccount = accounts.map(acc => {
          const salesAmt = filteredSales.filter(s => (s.paymentMethod || 'Cash') === acc).reduce((sum, s) => sum + (s.paid ?? s.total), 0);
          const txnIn = filteredManualTxns.filter(tx => tx.account === acc && (tx.transaction_type === 'cash_received' || tx.transaction_type === 'loan_receive')).reduce((s, tx) => s + Number(tx.amount), 0);
          const txnOut = filteredManualTxns.filter(tx => tx.account === acc && (tx.transaction_type === 'cash_payment' || tx.transaction_type === 'loan_payment')).reduce((s, tx) => s + Number(tx.amount), 0);
          return { account: acc, salesIn: salesAmt, txnIn, txnOut, net: salesAmt + txnIn - txnOut };
        });
        return (
          <ReportTable title="Account Wise Transaction" headers={['Account', 'Sales In', 'Manual In', 'Manual Out', 'Net']}>
            {byAccount.map(a => (
              <tr key={a.account} className="hover:bg-pos-surface-low">
                <td className="px-4 py-2 font-semibold">{a.account}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(a.salesIn)}</td>
                <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(a.txnIn)}</td>
                <td className="px-4 py-2 text-right text-destructive">{formatCurrency(a.txnOut)}</td>
                <td className={`px-4 py-2 text-right font-bold ${a.net >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(a.net)}</td>
              </tr>
            ))}
            <tr className="bg-pos-surface-high font-bold">
              <td className="px-4 py-3">মোট</td>
              <td className="px-4 py-3 text-right text-[hsl(125,60%,35%)]">{formatCurrency(byAccount.reduce((s, a) => s + a.salesIn, 0))}</td>
              <td className="px-4 py-3 text-right text-[hsl(125,60%,35%)]">{formatCurrency(byAccount.reduce((s, a) => s + a.txnIn, 0))}</td>
              <td className="px-4 py-3 text-right text-destructive">{formatCurrency(byAccount.reduce((s, a) => s + a.txnOut, 0))}</td>
              <td className={`px-4 py-3 text-right font-black ${byAccount.reduce((s, a) => s + a.net, 0) >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(byAccount.reduce((s, a) => s + a.net, 0))}</td>
            </tr>
          </ReportTable>
        );
      }

      case 'account_balance': {
        const accounts = ['Cash', 'bKash', 'Nagad', 'Card'];
        return (
          <ReportTable title="Account Balance" headers={['Account', 'Received', 'Paid Out', 'Balance']}>
            {accounts.map(method => {
              const received = filteredSales.filter(s => (s.paymentMethod || 'Cash') === method).reduce((sum, s) => sum + (s.paid ?? s.total), 0)
                + filteredManualTxns.filter(tx => tx.account === method && (tx.transaction_type === 'cash_received' || tx.transaction_type === 'loan_receive')).reduce((s, tx) => s + Number(tx.amount), 0);
              const paidOut = (method === 'Cash' ? stats.purchasePaid : 0)
                + filteredManualTxns.filter(tx => tx.account === method && (tx.transaction_type === 'cash_payment' || tx.transaction_type === 'loan_payment')).reduce((s, tx) => s + Number(tx.amount), 0);
              return (
                <tr key={method} className="hover:bg-pos-surface-low">
                  <td className="px-4 py-2 font-semibold">{method}</td>
                  <td className="px-4 py-2 text-right text-[hsl(125,60%,35%)]">{formatCurrency(received)}</td>
                  <td className="px-4 py-2 text-right text-destructive">{formatCurrency(paidOut)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${received - paidOut >= 0 ? 'text-[hsl(125,60%,35%)]' : 'text-destructive'}`}>{formatCurrency(received - paidOut)}</td>
                </tr>
              );
            })}
          </ReportTable>
        );
      }

      default:
        return (
          <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container overflow-hidden">
            <div className="px-5 py-3 bg-pos-surface-low font-semibold text-sm capitalize">{activeReport.replace(/_/g, ' ')}</div>
            <div className="p-8 text-center text-pos-on-surface-variant">
              <span className="material-symbols-outlined text-5xl mb-3 block opacity-40">construction</span>
              <p className="text-sm font-medium">এই রিপোর্টটি শীঘ্রই আসছে</p>
            </div>
          </div>
        );
    }
  };

  return (
    <section className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Screen Header - hidden on print */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 no-print">
        <div>
          <span className="text-xs text-pos-on-surface-variant uppercase tracking-widest block mb-2">{t('performanceOverview')}</span>
          <h2 className="text-3xl sm:text-5xl font-bold text-pos-on-surface leading-tight tracking-tighter">{t('reports')}</h2>
        </div>
        <button onClick={exportReport} className="px-6 py-3 bg-gradient-to-b from-pos-secondary to-pos-secondary-dim text-white rounded-lg font-medium flex items-center gap-2 shadow-lg hover:-translate-y-1 transition-transform">
          <span className="material-symbols-outlined text-lg">file_download</span>{t('exportReport')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Report List - hidden on print */}
        <div className="lg:col-span-4 bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto no-print">
          <h3 className="text-sm font-bold text-pos-on-surface-variant uppercase tracking-wider mb-4">List of Reports</h3>
          <div className="space-y-1">
            {reportList.map(item => {
              const isParentActive = item.children.some(c => c.id === activeReport);
              const isExpanded = expandedParents[item.id] ?? isParentActive;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => {
                      setExpandedParents(prev => ({ ...prev, [item.id]: !isExpanded }));
                      if (!item.children.some(c => c.id === activeReport)) {
                        setActiveReport(item.children[0].id);
                      }
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isParentActive ? 'bg-pos-secondary text-white' : 'text-pos-on-surface hover:bg-pos-surface-high'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className={`material-symbols-outlined text-base transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {isExpanded && (
                    <div className="mt-1.5 ml-2 grid grid-cols-3 gap-1.5 animate-in slide-in-from-top-2 duration-200 mb-1">
                      {item.children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => setActiveReport(child.id)}
                          className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${
                            activeReport === child.id ? 'bg-pos-secondary text-white shadow-md' : 'bg-pos-surface-high text-pos-on-surface-variant hover:bg-pos-surface-container'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">{child.icon}</span>
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Report Content */}
        <div className="lg:col-span-8 space-y-4" ref={printRef}>
          {/* Date Range - hidden on print */}
          <div className="bg-pos-surface-lowest rounded-xl border border-pos-surface-container p-5 space-y-4 no-print">
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

          {/* Print Header - only visible on print */}
          <div className="hidden print:block print-header">
            <div className="text-center border-b-2 border-black pb-3 mb-4">
              <h1 className="text-xl font-bold">{settings.name || 'Shop Name'}</h1>
              {settings.address && <p className="text-xs">{settings.address}</p>}
              <p className="text-xs">{[settings.phone, settings.email].filter(Boolean).join(' | ')}</p>
              <div className="mt-2 text-sm font-bold uppercase">{currentReportLabel}</div>
              {(dateFrom || dateTo) && (
                <p className="text-xs mt-1">
                  তারিখ: {dateFrom ? fmtDate(dateFrom) : 'শুরু'} — {dateTo ? fmtDate(dateTo) : 'আজ পর্যন্ত'}
                </p>
              )}
              <p className="text-[10px] mt-1 text-gray-500">প্রিন্ট: {new Date().toLocaleString('en-GB')}</p>
            </div>
          </div>

          {/* Report Content */}
          {renderReport()}
        </div>
      </div>
    </section>
  );
}
