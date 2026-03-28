import { useShopContext } from '@/components/ShopLayout';
import SalesScreen from '@/components/screens/SalesScreen';

export default function SalesPage() {
  const { products, customers, sales, settings, handleSaleComplete, deleteSale, handleAutoAddCustomer, onNavigate } = useShopContext();
  return (
    <SalesScreen
      products={products} customers={customers} sales={sales} settings={settings}
      onSaleComplete={handleSaleComplete} onDeleteSale={deleteSale}
      onAutoAddCustomer={handleAutoAddCustomer}
      companyName={settings.name} companyPhone={settings.phone} companyAddress={settings.address}
      onNavigate={onNavigate}
    />
  );
}
