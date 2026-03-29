import { useShopContext } from '@/components/ShopLayout';
import PurchaseScreen from '@/components/screens/PurchaseScreen';

export default function PurchasesPage() {
  const { products, suppliers, purchases, addPurchase, deletePurchase, updatePurchase, addStock, updateSupplierDue, settings } = useShopContext();
  return <PurchaseScreen products={products} suppliers={suppliers} purchases={purchases} onAddPurchase={addPurchase} onDeletePurchase={deletePurchase} onUpdatePurchase={updatePurchase} onAddStock={addStock} onUpdateSupplierDue={updateSupplierDue} settings={settings} />;
}
