import { useShopContext } from '@/components/ShopLayout';
import InventoryScreen from '@/components/screens/InventoryScreen';

export default function InventoryPage() {
  const { products, updateProduct } = useShopContext();
  return <InventoryScreen products={products} onUpdateProduct={updateProduct} />;
}
