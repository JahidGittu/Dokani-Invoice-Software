import { useShopContext } from '@/components/ShopLayout';
import SupplierScreen from '@/components/screens/SupplierScreen';

export default function SuppliersPage() {
  const { suppliers, addSupplier, deleteSupplier } = useShopContext();
  return <SupplierScreen suppliers={suppliers} onAddSupplier={addSupplier} onDeleteSupplier={deleteSupplier} />;
}
