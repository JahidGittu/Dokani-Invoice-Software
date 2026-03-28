import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setRole(null);
      setIsRoleLoading(false);
      return;
    }

    setIsRoleLoading(true);
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('Role fetch error:', error);
        setRole(data?.role ?? 'user');
        setIsRoleLoading(false);
      });
  }, [user?.id, authLoading]);

  return { role, isRoleLoading, isAdmin: role === 'admin' };
}
