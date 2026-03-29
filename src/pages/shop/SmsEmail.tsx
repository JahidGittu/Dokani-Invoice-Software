import { useShopContext } from '@/components/ShopLayout';
import SmsEmailScreen from '@/components/screens/SmsEmailScreen';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function SmsEmailPage() {
  const { customers, suppliers } = useShopContext();
  const { user } = useAuth();
  const [staffs, setStaffs] = useState<{ id: string; name: string; phone: string }[]>([]);

  const fetchStaffs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('staffs').select('id, name, phone').eq('user_id', user.id);
    setStaffs((data || []).map(s => ({ id: s.id, name: s.name, phone: s.phone })));
  }, [user]);

  useEffect(() => { fetchStaffs(); }, [fetchStaffs]);

  return <SmsEmailScreen customers={customers} suppliers={suppliers} staffs={staffs} />;
}
