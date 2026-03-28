import { useShopContext } from '@/components/ShopLayout';
import DashboardScreen from '@/components/screens/DashboardScreen';

export default function DashboardPage() {
  const { products, customers, sales, suppliers, purchases, onNavigate, settings } = useShopContext();
  return <DashboardScreen onNavigate={onNavigate} products={products} customers={customers} sales={sales} suppliers={suppliers} purchases={purchases} shopName={settings?.name} />;
}
