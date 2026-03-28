import { useShopContext } from '@/components/ShopLayout';
import ProductsScreen from '@/components/screens/ProductsScreen';

export default function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useShopContext();
  return <ProductsScreen products={products} onAddProduct={addProduct} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} />;
}
