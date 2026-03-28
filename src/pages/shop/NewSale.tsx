import { useShopContext } from '@/components/ShopLayout';
import NewSaleScreen from '@/components/screens/NewSaleScreen';

export default function NewSalePage() {
  const { products, customers, settings, handleSaleComplete, handleAutoAddCustomer } = useShopContext();
  return <NewSaleScreen products={products} customers={customers} settings={settings} onSaleComplete={handleSaleComplete} onAutoAddCustomer={handleAutoAddCustomer} />;
}
