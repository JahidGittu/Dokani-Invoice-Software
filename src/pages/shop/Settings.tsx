import { useShopContext } from '@/components/ShopLayout';
import SettingsScreen from '@/components/screens/SettingsScreen';

export default function SettingsPage() {
  const { settings, setSettings } = useShopContext();
  return <SettingsScreen settings={settings} onUpdateSettings={setSettings} />;
}
