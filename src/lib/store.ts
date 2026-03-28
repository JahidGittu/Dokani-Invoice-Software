import { useState, useEffect, useCallback } from 'react';

// ─── Types ───
export interface Product {
  id: string;
  name: string;
  size: string;
  finish: string;
  pricePerBox: number;
  sqftPerBox: number;
  piecesPerBox: number;
  stock: number;
  batch: string;
  barcode?: string;
  category?: string;
  brand?: string;
  buyRate?: number;
  unit?: string;
  height?: string;
  width?: string;
  reorderLimit?: number;
  imageUrl?: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  detail: string;
  qty: number;
  price: number;
  carton?: number;
  piece?: number;
  sqftQty?: number;
  itemType?: 'Sale' | 'Return';
  category?: string;
}

export interface SaleRecord {
  id: string;
  invoice: string;
  customer: string;
  phone: string;
  address?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  discountType: 'flat' | 'percent';
  total: number;
  paymentMethod: string;
  notes: string;
  status: 'paid' | 'pending' | 'credit';
  date: string;
  time: string;
  // New fields
  paid?: number;
  due?: number;
  delivery?: number;
  returnAmount?: number;
  lessAmount?: number;
  previousDues?: number;
  balance?: number;
  labour?: number;
  soldBy?: string;
  customerType?: 'Listed' | 'Walking';
}

export interface Customer {
  id: string;
  name: string;
  initials: string;
  phone: string;
  address: string;
  totalSpent: number;
  totalDue: number;
  lastOrder: string;
  color: 'secondary' | 'tertiary' | 'primary' | 'error';
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalDue: number;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  barcode: string;
  carton: number;
  piece: number;
  sqftQty: number;
  buyRate: number;
  subTotal: number;
}

export interface PurchaseRecord {
  id: string;
  invoice: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  total: number;
  discount: number;
  delivery: number;
  payable: number;
  paid: number;
  due: number;
  remark: string;
}

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  userName: string;
  userRole: string;
  lowStockThreshold: number;
  invPrefix: string;
  darkMode: boolean;
}

// ─── Default Data ───
const defaultProducts: Product[] = [
  { id: '1', name: 'Royal Marble', size: '60×60', finish: 'Glossy', pricePerBox: 1500, sqftPerBox: 9.6, piecesPerBox: 4, stock: 80, batch: 'BT-2501', category: 'Floor Tiles', brand: 'RAK', buyRate: 1200 },
  { id: '2', name: 'Ocean Blue', size: '30×60', finish: 'Matte', pricePerBox: 1200, sqftPerBox: 7.2, piecesPerBox: 6, stock: 45, batch: 'BT-2502', category: 'Wall Tiles', brand: 'Akij', buyRate: 900 },
  { id: '3', name: 'Rustic Wood', size: '15×60', finish: 'Matte', pricePerBox: 890, sqftPerBox: 5.4, piecesPerBox: 8, stock: 15, batch: 'BT-2503', category: 'Floor Tiles', brand: 'China', buyRate: 650 },
  { id: '4', name: 'Calacatta Gold', size: '60×120', finish: 'Glossy', pricePerBox: 2200, sqftPerBox: 14.4, piecesPerBox: 2, stock: 30, batch: 'BT-2504', category: 'Wall Tiles', brand: 'TYT', buyRate: 1800 },
  { id: '5', name: 'Pearl White', size: '30×30', finish: 'Glossy', pricePerBox: 750, sqftPerBox: 5.4, piecesPerBox: 10, stock: 8, batch: 'BT-2505', category: 'Wall Tiles', brand: 'Fresh', buyRate: 550 },
];

const defaultCustomers: Customer[] = [
  { id: '1', name: 'Rahim Uddin', initials: 'RU', phone: '01711223344', address: 'Dhaka', totalSpent: 234500, totalDue: 0, lastOrder: '27 Mar 2026', color: 'secondary' },
  { id: '2', name: 'Karim Trading', initials: 'KT', phone: '01922334455', address: 'Chittagong', totalSpent: 189000, totalDue: 25000, lastOrder: '25 Mar 2026', color: 'tertiary' },
];

const defaultSales: SaleRecord[] = [];
const defaultSuppliers: Supplier[] = [
  { id: '1', name: 'Akij Ceramics', phone: '01811223344', address: 'Dhaka', totalDue: 0 },
  { id: '2', name: 'RAK Bangladesh', phone: '01922112233', address: 'Gazipur', totalDue: 6000 },
];
const defaultPurchases: PurchaseRecord[] = [];

const defaultSettings: CompanySettings = {
  name: 'Dokani',
  address: 'Chattogram, Bangladesh',
  phone: '01700-000000',
  email: 'info@dokani.com.bd',
  userName: 'Arif Rahman',
  userRole: 'System Admin',
  lowStockThreshold: 20,
  invPrefix: 'INV',
  darkMode: false,
};

// ─── localStorage helpers ───
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Invoice counter ───
function getInvoiceCounter(): number {
  return loadJSON<number>('tilepos_inv_counter', 1);
}
function setInvoiceCounter(n: number) {
  saveJSON('tilepos_inv_counter', n);
}

export function getNextInvoiceNumber(prefix = 'INV'): string {
  const c = getInvoiceCounter();
  setInvoiceCounter(c + 1);
  return `${prefix}-${String(c).padStart(4, '0')}`;
}

// Purchase invoice counter
function getPurchaseCounter(): number {
  return loadJSON<number>('tilepos_purchase_counter', 1);
}
function setPurchaseCounter(n: number) {
  saveJSON('tilepos_purchase_counter', n);
}
export function getNextPurchaseNumber(): string {
  const c = getPurchaseCounter();
  setPurchaseCounter(c + 1);
  return `PUR-${String(c).padStart(4, '0')}`;
}

// ─── Format ───
export function formatCurrency(amount: number): string {
  return '৳' + amount.toLocaleString('en-IN');
}

export function calcDiscount(subtotal: number, discountVal: number, discountType: 'flat' | 'percent'): number {
  return discountType === 'percent' ? Math.round(subtotal * discountVal / 100) : discountVal;
}

// Number to words (Bengali + English)
export function numberToWords(num: number, lang: 'en' | 'bn' = 'en'): string {
  if (num === 0) return lang === 'bn' ? 'শূন্য টাকা মাত্র' : 'Zero Taka Only';
  const ones = lang === 'bn'
    ? ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোল', 'সতেরো', 'আঠারো', 'উনিশ']
    : ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = lang === 'bn'
    ? ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই']
    : ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + (lang === 'bn' ? ' শত ' : ' Hundred ') + convert(n % 100);
    if (n < 100000) return convert(Math.floor(n / 1000)) + (lang === 'bn' ? ' হাজার ' : ' Thousand ') + convert(n % 1000);
    if (n < 10000000) return convert(Math.floor(n / 100000)) + (lang === 'bn' ? ' লক্ষ ' : ' Lakh ') + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + (lang === 'bn' ? ' কোটি ' : ' Crore ') + convert(n % 10000000);
  };
  const result = convert(Math.floor(num)).trim();
  return result + (lang === 'bn' ? ' টাকা মাত্র' : ' Taka Only');
}

// ─── Custom Hooks ───
export function useProducts() {
  const [products, setProducts] = useState<Product[]>(() => loadJSON('tilepos_products', defaultProducts));

  useEffect(() => { saveJSON('tilepos_products', products); }, [products]);

  const addProduct = useCallback((p: Omit<Product, 'id'>) => {
    setProducts(prev => [...prev, { ...p, id: crypto.randomUUID() }]);
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const deductStock = useCallback((items: { productId: string; qty: number }[]) => {
    setProducts(prev => prev.map(p => {
      const item = items.find(i => i.productId === p.id);
      return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
    }));
  }, []);

  const addStock = useCallback((items: { productId: string; qty: number }[]) => {
    setProducts(prev => prev.map(p => {
      const item = items.find(i => i.productId === p.id);
      return item ? { ...p, stock: p.stock + item.qty } : p;
    }));
  }, []);

  return { products, setProducts, addProduct, updateProduct, deleteProduct, deductStock, addStock };
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>(() => loadJSON('tilepos_customers', defaultCustomers));

  useEffect(() => { saveJSON('tilepos_customers', customers); }, [customers]);

  const addCustomer = useCallback((name: string, phone: string, address: string) => {
    const colors: Customer['color'][] = ['secondary', 'tertiary', 'primary', 'error'];
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const newC: Customer = {
      id: crypto.randomUUID(),
      name, initials, phone, address,
      totalSpent: 0,
      totalDue: 0,
      lastOrder: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    setCustomers(prev => [...prev, newC]);
    return newC;
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCustomerSpend = useCallback((name: string, amount: number, dueAmount: number = 0) => {
    setCustomers(prev => prev.map(c =>
      c.name === name ? {
        ...c,
        totalSpent: c.totalSpent + amount,
        totalDue: (c.totalDue || 0) + dueAmount,
        lastOrder: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      } : c
    ));
  }, []);

  return { customers, setCustomers, addCustomer, deleteCustomer, updateCustomerSpend };
}

export function useSales() {
  const [sales, setSales] = useState<SaleRecord[]>(() => loadJSON('tilepos_sales', defaultSales));

  useEffect(() => { saveJSON('tilepos_sales', sales); }, [sales]);

  const addSale = useCallback((sale: SaleRecord) => {
    setSales(prev => [sale, ...prev]);
  }, []);

  const deleteSale = useCallback((id: string) => {
    setSales(prev => prev.filter(s => s.id !== id));
  }, []);

  return { sales, setSales, addSale, deleteSale };
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadJSON('tilepos_suppliers', defaultSuppliers));

  useEffect(() => { saveJSON('tilepos_suppliers', suppliers); }, [suppliers]);

  const addSupplier = useCallback((name: string, phone: string, address: string) => {
    const s: Supplier = { id: crypto.randomUUID(), name, phone, address, totalDue: 0 };
    setSuppliers(prev => [...prev, s]);
    return s;
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateSupplierDue = useCallback((name: string, dueAmount: number) => {
    setSuppliers(prev => prev.map(s => s.name === name ? { ...s, totalDue: (s.totalDue || 0) + dueAmount } : s));
  }, []);

  return { suppliers, setSuppliers, addSupplier, deleteSupplier, updateSupplierDue };
}

export function usePurchases() {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => loadJSON('tilepos_purchases', defaultPurchases));

  useEffect(() => { saveJSON('tilepos_purchases', purchases); }, [purchases]);

  const addPurchase = useCallback((p: PurchaseRecord) => {
    setPurchases(prev => [p, ...prev]);
  }, []);

  const deletePurchase = useCallback((id: string) => {
    setPurchases(prev => prev.filter(p => p.id !== id));
  }, []);

  return { purchases, setPurchases, addPurchase, deletePurchase };
}

export function useCompanySettings() {
  const [settings, setSettings] = useState<CompanySettings>(() => loadJSON('tilepos_settings', defaultSettings));

  useEffect(() => { saveJSON('tilepos_settings', settings); }, [settings]);

  return { settings, setSettings };
}

// ─── Export / Import JSON ───
export function exportAllData() {
  const data = {
    products: loadJSON('tilepos_products', defaultProducts),
    customers: loadJSON('tilepos_customers', defaultCustomers),
    sales: loadJSON('tilepos_sales', defaultSales),
    suppliers: loadJSON('tilepos_suppliers', defaultSuppliers),
    purchases: loadJSON('tilepos_purchases', defaultPurchases),
    settings: loadJSON('tilepos_settings', defaultSettings),
    invoiceCounter: getInvoiceCounter(),
    purchaseCounter: getPurchaseCounter(),
    exportDate: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tilepos_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.products) saveJSON('tilepos_products', data.products);
    if (data.customers) saveJSON('tilepos_customers', data.customers);
    if (data.sales) saveJSON('tilepos_sales', data.sales);
    if (data.suppliers) saveJSON('tilepos_suppliers', data.suppliers);
    if (data.purchases) saveJSON('tilepos_purchases', data.purchases);
    if (data.settings) saveJSON('tilepos_settings', data.settings);
    if (data.invoiceCounter) setInvoiceCounter(data.invoiceCounter);
    if (data.purchaseCounter) setPurchaseCounter(data.purchaseCounter);
    return true;
  } catch {
    return false;
  }
}

export function getLowStockProducts(products: Product[], threshold = 20): Product[] {
  return products.filter(p => p.stock <= threshold);
}

export function getTodaysSalesTotal(sales: SaleRecord[]): number {
  const today = new Date().toDateString();
  return sales.filter(s => {
    try { return new Date(s.date).toDateString() === today; } catch { return false; }
  }).reduce((sum, s) => sum + s.total, 0);
}

export function getTodaysSalesCount(sales: SaleRecord[]): number {
  const today = new Date().toDateString();
  return sales.filter(s => {
    try { return new Date(s.date).toDateString() === today; } catch { return false; }
  }).length;
}

export function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Product categories list
export const PRODUCT_CATEGORIES = [
  'Wall Tiles', 'Floor Tiles', 'Scarting Tiles', 'Wall Paper', 
  'Tiles Related', 'Sanitary', 'Fitting', 'Other'
];

export const PRODUCT_BRANDS = [
  'Akij', 'RAK', 'Fresh', 'TYT', 'China', 'Bangla', 'Great Wall', 'Other'
];
