import { useShopContext } from '@/components/ShopLayout';
import PurchaseScreen from '@/components/screens/PurchaseScreen';

export default function PurchasesPage() {
  const { products, suppliers, purchases, addPurchase, deletePurchase, addStock, updateSupplierDue } = useShopContext();
  return <PurchaseScreen products={products} suppliers={suppliers} purchases={purchases} onAddPurchase={addPurchase} onDeletePurchase={deletePurchase} onAddStock={addStock} onUpdateSupplierDue={updateSupplierDue} />;
}
