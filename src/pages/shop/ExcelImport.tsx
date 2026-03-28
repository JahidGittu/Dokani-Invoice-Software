import { useShopContext } from '@/components/ShopLayout';
import ExcelImportScreen from '@/components/screens/ExcelImportScreen';

export default function ExcelImportPage() {
  const { products, handleImportProducts } = useShopContext();
  return <ExcelImportScreen products={products} onImportProducts={handleImportProducts} />;
}
