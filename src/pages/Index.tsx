import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DashboardScreen from "@/components/screens/DashboardScreen";
import ProductsScreen from "@/components/screens/ProductsScreen";
import SalesScreen from "@/components/screens/SalesScreen";
import InventoryScreen from "@/components/screens/InventoryScreen";
import CustomersScreen from "@/components/screens/CustomersScreen";
import ReportsScreen from "@/components/screens/ReportsScreen";
import SettingsScreen from "@/components/screens/SettingsScreen";
import { useProducts, useCustomers, useSales, useCompanySettings, type SaleRecord } from "@/lib/store";

export default function Index() {
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { products, addProduct, updateProduct, deductStock } = useProducts();
  const { customers, addCustomer, updateCustomerSpend } = useCustomers();
  const { sales, addSale } = useSales();
  const { settings, setSettings } = useCompanySettings();

  const handleSaleComplete = useCallback((sale: SaleRecord, stockDeductions: { productId: string; qty: number }[]) => {
    addSale(sale);
    deductStock(stockDeductions);
    if (sale.customer !== 'Walk-in Customer') {
      updateCustomerSpend(sale.customer, sale.total);
    }
  }, [addSale, deductStock, updateCustomerSpend]);

  // F2 shortcut to go to Sales
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F2' && activeScreen !== 'sales') {
        e.preventDefault();
        setActiveScreen('sales');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeScreen]);

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard': return <DashboardScreen onNavigate={setActiveScreen} />;
      case 'products': return <ProductsScreen products={products} onAddProduct={addProduct} onUpdateProduct={updateProduct} />;
      case 'sales': return <SalesScreen products={products} customers={customers} onSaleComplete={handleSaleComplete} companyName={settings.name} />;
      case 'inventory': return <InventoryScreen products={products} />;
      case 'customers': return <CustomersScreen customers={customers} onAddCustomer={addCustomer} />;
      case 'reports': return <ReportsScreen />;
      case 'settings': return <SettingsScreen settings={settings} onUpdateSettings={setSettings} />;
      default: return <DashboardScreen onNavigate={setActiveScreen} />;
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
      />
      <main className="lg:ml-64 min-h-screen">
        <Header
          activeScreen={activeScreen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onNavigate={setActiveScreen}
          onSearch={() => {}}
          products={products}
        />
        {renderScreen()}
      </main>
      {/* FAB */}
      <button
        onClick={() => setActiveScreen('sales')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-pos-secondary text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-30"
      >
        <span className="material-symbols-outlined text-2xl">point_of_sale</span>
      </button>
    </div>
  );
}
