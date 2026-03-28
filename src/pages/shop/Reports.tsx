import { useShopContext } from '@/components/ShopLayout';
import ReportsScreen from '@/components/screens/ReportsScreen';

export default function ReportsPage() {
  const { sales, products, customers, suppliers, purchases } = useShopContext();
  return <ReportsScreen sales={sales} products={products} customers={customers} suppliers={suppliers} purchases={purchases} />;
}
