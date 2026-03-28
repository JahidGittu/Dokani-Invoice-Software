import { useShopContext } from '@/components/ShopLayout';
import TransactionsScreen from '@/components/screens/TransactionsScreen';

export default function TransactionsPage() {
  const { sales, purchases } = useShopContext();
  return <TransactionsScreen sales={sales} purchases={purchases} />;
}
