import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DashboardScreen from "@/components/screens/DashboardScreen";
import ProductsScreen from "@/components/screens/ProductsScreen";
import SalesScreen from "@/components/screens/SalesScreen";
import InventoryScreen from "@/components/screens/InventoryScreen";
import CustomersScreen from "@/components/screens/CustomersScreen";
import ReportsScreen from "@/components/screens/ReportsScreen";

export default function Index() {
  const [activeScreen, setActiveScreen] = useState('dashboard');

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard': return <DashboardScreen onNavigate={setActiveScreen} />;
      case 'products': return <ProductsScreen />;
      case 'sales': return <SalesScreen />;
      case 'inventory': return <InventoryScreen />;
      case 'customers': return <CustomersScreen />;
      case 'reports': return <ReportsScreen />;
      default: return <DashboardScreen onNavigate={setActiveScreen} />;
    }
  };

  return (
    <div className="bg-pos-surface text-pos-on-surface min-h-screen">
      <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
      <main className="ml-64 min-h-screen">
        <Header activeScreen={activeScreen} />
        {renderScreen()}
      </main>
      {/* FAB */}
      <button
        onClick={() => setActiveScreen('sales')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-pos-secondary text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-50"
      >
        <span className="material-symbols-outlined text-2xl">point_of_sale</span>
      </button>
    </div>
  );
}
