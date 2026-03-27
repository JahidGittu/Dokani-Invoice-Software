import { useState, useEffect, useCallback } from 'react';

// ─── Types ───
export interface Product {
  id: string;
  name: string;
  size: string;
  finish: string;
  pricePerBox: number;
  sqftPerBox: number;
  stock: number;
  batch: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface SaleRecord {
  id: string;
  invoice: string;
  customer: string;
  phone: string;
  items: { productId: string; name: string; detail: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  discountType: 'flat' | 'percent';
  total: number;
  paymentMethod: 'cash' | 'credit' | 'mobile';
  notes: string;
  status: 'Paid' | 'Pending';
  date: string;
  time: string;
}

export interface Customer {
  id: string;
  name: string;
  initials: string;
  phone: string;
  address: string;
  totalSpent: number;
  lastOrder: string;
  color: 'secondary' | 'tertiary' | 'primary' | 'error';
}

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
}

// ─── Default Data ───
const defaultProducts: Product[] = [
  { id: '1', name: 'Royal Marble', size: '24×24', finish: 'Glossy', pricePerBox: 1200, sqftPerBox: 9.2, stock: 345, batch: 'BT-2401' },
  { id: '2', name: 'Ivory Stone', size: '12×24', finish: 'Matte', pricePerBox: 950, sqftPerBox: 7.7, stock: 12, batch: 'BT-2388' },
  { id: '3', name: 'Dark Slate', size: '24×48', finish: 'Matte', pricePerBox: 1800, sqftPerBox: 15.6, stock: 210, batch: 'BT-2412' },
  { id: '4', name: 'Pearl White', size: '30×30', finish: 'Glossy', pricePerBox: 780, sqftPerBox: 6.0, stock: 8, batch: 'BT-2395' },
  { id: '5', name: 'Travertine', size: '60×60', finish: 'Lappato', pricePerBox: 2400, sqftPerBox: 25.0, stock: 438, batch: 'BT-2420' },
  { id: '6', name: 'Sand Beige', size: '12×12', finish: 'Matte', pricePerBox: 650, sqftPerBox: 4.0, stock: 18, batch: 'BT-2378' },
];

const defaultCustomers: Customer[] = [
  { id: '1', name: 'Rahim Mia', initials: 'RM', phone: '01712-345678', address: 'Chattogram', totalSpent: 234500, lastOrder: '27 Mar 2026', color: 'secondary' },
  { id: '2', name: 'Karim Ahmed', initials: 'KA', phone: '01822-987654', address: 'Dhaka', totalSpent: 189000, lastOrder: '25 Mar 2026', color: 'tertiary' },
  { id: '3', name: 'Selim Brothers', initials: 'SB', phone: '01933-112233', address: 'Sylhet', totalSpent: 98750, lastOrder: '22 Mar 2026', color: 'primary' },
  { id: '4', name: 'Nasir Traders', initials: 'NT', phone: '01555-667788', address: 'Rajshahi', totalSpent: 67200, lastOrder: '18 Mar 2026', color: 'error' },
];

const defaultSales: SaleRecord[] = [
  { id: '1', invoice: 'INV-0090', customer: 'Rahim Mia', phone: '01712-345678', items: [{ productId: '1', name: 'Royal Marble', detail: '24×24 Glossy', qty: 10, price: 1200 }], subtotal: 12000, discount: 0, discountType: 'flat', total: 12000, paymentMethod: 'cash', notes: '', status: 'Paid', date: '27 Mar 2026', time: '10:34 AM' },
  { id: '2', invoice: 'INV-0089', customer: 'Karim Ahmed', phone: '01822-987654', items: [{ productId: '3', name: 'Dark Slate', detail: '24×48 Matte', qty: 12, price: 1800 }], subtotal: 21600, discount: 0, discountType: 'flat', total: 21600, paymentMethod: 'cash', notes: '', status: 'Paid', date: '27 Mar 2026', time: '9:15 AM' },
  { id: '3', invoice: 'INV-0088', customer: 'Selim Brothers', phone: '01933-112233', items: [{ productId: '5', name: 'Travertine', detail: '60×60 Lappato', qty: 3, price: 2400 }, { productId: '6', name: 'Sand Beige', detail: '12×12 Matte', qty: 2, price: 650 }], subtotal: 8500, discount: 0, discountType: 'flat', total: 8500, paymentMethod: 'credit', notes: '', status: 'Pending', date: '26 Mar 2026', time: '8:50 AM' },
];

const defaultSettings: CompanySettings = {
  name: 'TilePOS Lite',
  address: 'Chattogram, Bangladesh',
  phone: '01700-000000',
  email: 'info@tilepos.com',
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
  return loadJSON<number>('tilepos_inv_counter', 91);
}
function setInvoiceCounter(n: number) {
  saveJSON('tilepos_inv_counter', n);
}

export function getNextInvoiceNumber(): string {
  const c = getInvoiceCounter();
  setInvoiceCounter(c + 1);
  return `INV-${String(c).padStart(4, '0')}`;
}

// ─── Format ───
export function formatCurrency(amount: number): string {
  return '৳' + amount.toLocaleString('en-IN');
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

  const deductStock = useCallback((items: { productId: string; qty: number }[]) => {
    setProducts(prev => prev.map(p => {
      const item = items.find(i => i.productId === p.id);
      return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
    }));
  }, []);

  return { products, setProducts, addProduct, updateProduct, deductStock };
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
      lastOrder: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    setCustomers(prev => [...prev, newC]);
    return newC;
  }, []);

  const updateCustomerSpend = useCallback((name: string, amount: number) => {
    setCustomers(prev => prev.map(c =>
      c.name === name ? {
        ...c,
        totalSpent: c.totalSpent + amount,
        lastOrder: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      } : c
    ));
  }, []);

  return { customers, setCustomers, addCustomer, updateCustomerSpend };
}

export function useSales() {
  const [sales, setSales] = useState<SaleRecord[]>(() => loadJSON('tilepos_sales', defaultSales));

  useEffect(() => { saveJSON('tilepos_sales', sales); }, [sales]);

  const addSale = useCallback((sale: SaleRecord) => {
    setSales(prev => [sale, ...prev]);
  }, []);

  return { sales, setSales, addSale };
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
    settings: loadJSON('tilepos_settings', defaultSettings),
    invoiceCounter: getInvoiceCounter(),
    exportDate: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tilepos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.products) saveJSON('tilepos_products', data.products);
    if (data.customers) saveJSON('tilepos_customers', data.customers);
    if (data.sales) saveJSON('tilepos_sales', data.sales);
    if (data.settings) saveJSON('tilepos_settings', data.settings);
    if (data.invoiceCounter) setInvoiceCounter(data.invoiceCounter);
    return true;
  } catch {
    return false;
  }
}

export function getLowStockProducts(products: Product[], threshold = 20): Product[] {
  return products.filter(p => p.stock <= threshold);
}

export function getTodaysSalesTotal(sales: SaleRecord[]): number {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return sales.filter(s => s.date === today).reduce((sum, s) => sum + s.total, 0);
}
