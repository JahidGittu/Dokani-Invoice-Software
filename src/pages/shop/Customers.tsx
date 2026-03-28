import { useShopContext } from '@/components/ShopLayout';
import CustomersScreen from '@/components/screens/CustomersScreen';

export default function CustomersPage() {
  const { customers, sales, addCustomer, deleteCustomer, updateCustomerDue } = useShopContext();
  return <CustomersScreen customers={customers} sales={sales} onAddCustomer={addCustomer} onDeleteCustomer={deleteCustomer} onUpdateCustomerDue={updateCustomerDue} />;
}
