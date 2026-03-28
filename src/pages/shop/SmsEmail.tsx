import { useShopContext } from '@/components/ShopLayout';
import SmsEmailScreen from '@/components/screens/SmsEmailScreen';

export default function SmsEmailPage() {
  const { customers, suppliers } = useShopContext();
  return <SmsEmailScreen customers={customers} suppliers={suppliers} />;
}
