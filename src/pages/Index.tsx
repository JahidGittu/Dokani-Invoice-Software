import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DashboardScreen from "@/components/screens/DashboardScreen";
import ProductsScreen from "@/components/screens/ProductsScreen";
import SalesScreen from "@/components/screens/SalesScreen";
import NewSaleScreen from "@/components/screens/NewSaleScreen";
import InventoryScreen from "@/components/screens/InventoryScreen";
import CustomersScreen from "@/components/screens/CustomersScreen";
import ReportsScreen from "@/components/screens/ReportsScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import ExcelImportScreen from "@/components/screens/ExcelImportScreen";
import PurchaseScreen from "@/components/screens/PurchaseScreen";
import SupplierScreen from "@/components/screens/SupplierScreen";
import TransactionsScreen from "@/components/screens/TransactionsScreen";
import StaffsScreen from "@/components/screens/StaffsScreen";
import SmsEmailScreen from "@/components/screens/SmsEmailScreen";
import { useProducts, useCustomers, useSales, useSuppliers, usePurchases, useCompanySettings, type SaleRecord, type Product } from "@/lib/store";

export default function Index() {
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { products, addProduct, updateProduct, deleteProduct, deductStock, addStock, setProducts } = useProducts();
  const { customers, addCustomer, deleteCustomer, updateCustomerSpend } = useCustomers();
  const { sales, addSale, deleteSale } = useSales();
  const { suppliers, addSupplier, deleteSupplier, updateSupplierDue } = useSuppliers();
  const { purchases, addPurchase, deletePurchase } = usePurchases();
  const { settings, setSettings } = useCompanySettings();

  const handleSaleComplete = useCallback((sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => {
    addSale(sale);
    deductStock(stockDeductions);
    const walkInNames = ['Walk-in Customer', 'সরাসরি কাস্টমার'];
    if (!walkInNames.includes(sale.customer) && sale.customer.trim()) {
      updateCustomerSpend(sale.customer, sale.total);
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

  // Dark mode init
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // F2 shortcut to go to New Sale
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveScreen('new-sale');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard': return <DashboardScreen onNavigate={setActiveScreen} products={products} customers={customers} sales={sales} suppliers={suppliers} purchases={purchases} />;
      case 'products': return <ProductsScreen products={products} onAddProduct={addProduct} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} />;
      case 'sales': return <SalesScreen products={products} customers={customers} sales={sales} onSaleComplete={handleSaleComplete} onDeleteSale={deleteSale} companyName={settings.name} companyPhone={settings.phone} companyAddress={settings.address} onNavigate={setActiveScreen} />;
      case 'new-sale': return <NewSaleScreen products={products} customers={customers} settings={settings} onSaleComplete={handleSaleComplete} onAutoAddCustomer={handleAutoAddCustomer} />;
      case 'inventory': return <InventoryScreen products={products} onUpdateProduct={updateProduct} />;
      case 'customers': return <CustomersScreen customers={customers} onAddCustomer={addCustomer} onDeleteCustomer={deleteCustomer} />;
      case 'reports': return <ReportsScreen sales={sales} products={products} customers={customers} suppliers={suppliers} purchases={purchases} />;
      case 'purchases': return <PurchaseScreen products={products} suppliers={suppliers} purchases={purchases} onAddPurchase={addPurchase} onDeletePurchase={deletePurchase} onAddStock={addStock} onUpdateSupplierDue={updateSupplierDue} />;
      case 'suppliers': return <SupplierScreen suppliers={suppliers} onAddSupplier={addSupplier} onDeleteSupplier={deleteSupplier} />;
      case 'settings': return <SettingsScreen settings={settings} onUpdateSettings={setSettings} />;
      case 'excel': return <ExcelImportScreen products={products} onImportProducts={handleImportProducts} />;
      case 'transactions': return <TransactionsScreen sales={sales} purchases={purchases} />;
      case 'staffs': return <StaffsScreen />;
      case 'sms-email': return <SmsEmailScreen customers={customers} suppliers={suppliers} />;
      default: return <DashboardScreen onNavigate={setActiveScreen} products={products} customers={customers} sales={sales} />;
    }
  };

  return (
    <div className="bg-pos-surface text-pos-on-surface min-h-screen">
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
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
          onNavigate={setActiveScreen}
          onSearch={() => {}}
          products={products}
          sales={sales}
          customers={customers}
          userName={settings.userName}
        />
        {renderScreen()}
      </main>
      {/* FAB */}
      <button
        onClick={() => setActiveScreen('new-sale')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-pos-secondary text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-30"
        title="New Sale (F2)"
      >
        <span className="material-symbols-outlined text-2xl">receipt_long</span>
      </button>
    </div>
  );
}
