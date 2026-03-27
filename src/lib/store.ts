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

export interface SaleItem {
  productId: string;
  name: string;
  detail: string;
  qty: number;
  price: number;
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
  userName: string;
  userRole: string;
  lowStockThreshold: number;
  invPrefix: string;
  darkMode: boolean;
}

// ─── Default Data ───
const defaultProducts: Product[] = [
  { id: '1', name: 'Royal Marble', size: '60×60', finish: 'Glossy', pricePerBox: 1500, sqftPerBox: 9.6, stock: 80, batch: 'BT-2501' },
  { id: '2', name: 'Ocean Blue', size: '30×60', finish: 'Matte', pricePerBox: 1200, sqftPerBox: 7.2, stock: 45, batch: 'BT-2502' },
  { id: '3', name: 'Rustic Wood', size: '15×60', finish: 'Matte', pricePerBox: 890, sqftPerBox: 5.4, stock: 15, batch: 'BT-2503' },
  { id: '4', name: 'Calacatta Gold', size: '60×120', finish: 'Glossy', pricePerBox: 2200, sqftPerBox: 14.4, stock: 30, batch: 'BT-2504' },
  { id: '5', name: 'Pearl White', size: '30×30', finish: 'Glossy', pricePerBox: 750, sqftPerBox: 5.4, stock: 8, batch: 'BT-2505' },
];

const defaultCustomers: Customer[] = [
  { id: '1', name: 'Rahim Uddin', initials: 'RU', phone: '01711223344', address: 'Dhaka', totalSpent: 234500, lastOrder: '27 Mar 2026', color: 'secondary' },
  { id: '2', name: 'Karim Trading', initials: 'KT', phone: '01922334455', address: 'Chittagong', totalSpent: 189000, lastOrder: '25 Mar 2026', color: 'tertiary' },
];

const defaultSales: SaleRecord[] = [];

const defaultSettings: CompanySettings = {
  name: 'TilePOS Lite',
  address: 'Chattogram, Bangladesh',
  phone: '01700-000000',
  email: 'info@tilepos.com',
  userName: 'Arif Rahman',
  userRole: 'Administrator',
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

// ─── Format ───
export function formatCurrency(amount: number): string {
  return '৳' + amount.toLocaleString('en-IN');
}

export function calcDiscount(subtotal: number, discountVal: number, discountType: 'flat' | 'percent'): number {
  return discountType === 'percent' ? Math.round(subtotal * discountVal / 100) : discountVal;
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

  return { products, setProducts, addProduct, updateProduct, deleteProduct, deductStock };
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

  const deleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
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
