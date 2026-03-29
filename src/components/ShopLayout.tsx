import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useSupabaseProducts, useSupabaseCustomers, useSupabaseSales, useSupabaseSuppliers, useSupabasePurchases, useSupabaseSettings } from '@/lib/supabase-store';
import { type SaleRecord, type Product } from '@/lib/store';

// Map route paths to screen IDs for sidebar active state
const pathToScreen: Record<string, string> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/new-sale': 'new-sale',
  '/products': 'products',
  '/purchases': 'purchases',
  '/sales': 'sales',
  '/inventory': 'inventory',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/staffs': 'staffs',
  '/transactions': 'transactions',
  '/reports': 'reports',
  '/sms-email': 'sms-email',
  '/settings': 'settings',
};

const screenToPath: Record<string, string> = {
  'dashboard': '/',
  'new-sale': '/new-sale',
  'products': '/products',
  'purchases': '/purchases',
  'sales': '/sales',
  'inventory': '/inventory',
  'customers': '/customers',
  'suppliers': '/suppliers',
  'staffs': '/staffs',
  'transactions': '/transactions',
  'reports': '/reports',
  'sms-email': '/sms-email',
  'settings': '/settings',
};

export default function ShopLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeScreen = pathToScreen[location.pathname] || 'dashboard';

  const { products, addProduct, updateProduct, deleteProduct, deductStock, addStock, setProducts } = useSupabaseProducts();
  const { customers, addCustomer, deleteCustomer, updateCustomerSpend, updateCustomerDue } = useSupabaseCustomers();
  const { sales, addSale, deleteSale } = useSupabaseSales();
  const { suppliers, addSupplier, deleteSupplier, updateSupplierDue } = useSupabaseSuppliers();
  const { purchases, addPurchase, deletePurchase, updatePurchase } = useSupabasePurchases();
  const { settings, setSettings } = useSupabaseSettings();

  const handleNavigate = useCallback((screen: string) => {
    const path = screenToPath[screen] || '/';
    navigate(path);
  }, [navigate]);

  const handleSaleComplete = useCallback((sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => {
    addSale(sale);
    deductStock(stockDeductions);
    const walkInNames = ['Walk-in Customer', 'সরাসরি কাস্টমার'];
    if (!walkInNames.includes(sale.customer) && sale.customer.trim()) {
      const dueAmount = sale.due ?? 0;
      updateCustomerSpend(sale.customer, sale.total, dueAmount);
    }
  }, [addSale, deductStock, updateCustomerSpend]);

  const handleAutoAddCustomer = useCallback((name: string, phone: string, address: string) => {
    if (!customers.find(c => c.name === name)) {
      addCustomer(name, phone, address);
    }
  }, [customers, addCustomer]);

  const handleImportProducts = useCallback((newProducts: Omit<Product, 'id'>[]) => {
    newProducts.forEach(p => addProduct(p));
  }, [addProduct]);

  // Dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); navigate('/new-sale'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); document.getElementById('global-search')?.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  // Context passed to child routes via Outlet context
  const ctx = {
    products, addProduct, updateProduct, deleteProduct, deductStock, addStock, setProducts,
    customers, addCustomer, deleteCustomer, updateCustomerSpend, updateCustomerDue,
    sales, addSale, deleteSale,
    suppliers, addSupplier, deleteSupplier, updateSupplierDue,
    purchases, addPurchase, deletePurchase, updatePurchase,
    settings, setSettings,
    handleSaleComplete, handleAutoAddCustomer, handleImportProducts,
    onNavigate: handleNavigate,
  };

  return (
    <div className="bg-pos-surface text-pos-on-surface min-h-screen">
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        products={products}
        userName={settings.userName}
        userRole={settings.userRole}
      />
      <main className="lg:ml-64 min-h-screen">
        <Header
          activeScreen={activeScreen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onNavigate={handleNavigate}
          onSearch={() => {}}
          products={products}
          sales={sales}
          customers={customers}
          userName={settings.userName}
          shopName={settings.name}
        />
        <Outlet context={ctx} />
      </main>
      {/* FAB */}
      <button
        onClick={() => navigate('/new-sale')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-pos-secondary text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-30"
        title="New Sale (F2)"
      >
        <span className="material-symbols-outlined text-2xl">receipt_long</span>
      </button>
    </div>
  );
}

// Hook for child routes to access shop context
import { useOutletContext } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useShopContext(): any {
  return useOutletContext();
}
