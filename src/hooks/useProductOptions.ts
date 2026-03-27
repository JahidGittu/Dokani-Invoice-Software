import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PRODUCT_CATEGORIES, PRODUCT_BRANDS } from '@/lib/store';

const DEFAULT_FINISHES = ['Glossy', 'Matte', 'Lappato', 'Rustic', 'Carving'];
const DEFAULT_SIZES = ['24×24', '60×60', '80×80', '60×120', '30×60', '30×30', '40×40', '12×24', '12×12'];

type OptionType = 'category' | 'brand' | 'finish' | 'size';

export function useProductOptions() {
  const { user } = useAuth();
  const [customOptions, setCustomOptions] = useState<Record<OptionType, string[]>>({
    category: [], brand: [], finish: [], size: [],
  });

  const fetchOptions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('product_options')
      .select('option_type, option_value')
      .order('created_at', { ascending: true }) as any;
    
    const grouped: Record<OptionType, string[]> = { category: [], brand: [], finish: [], size: [] };
    (data || []).forEach((row: any) => {
      if (grouped[row.option_type as OptionType]) {
        grouped[row.option_type as OptionType].push(row.option_value);
      }
    });
    setCustomOptions(grouped);
  }, [user]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const addOption = useCallback(async (type: OptionType, value: string) => {
    if (!user || !value.trim()) return;
    const trimmed = value.trim();
    // Check if already in defaults or custom
    const all = getOptions(type);
    if (all.includes(trimmed)) return;
    
    await (supabase.from('product_options') as any).insert({
      user_id: user.id, option_type: type, option_value: trimmed,
    });
    setCustomOptions(prev => ({
      ...prev,
      [type]: [...prev[type], trimmed],
    }));
  }, [user]);

  const getOptions = useCallback((type: OptionType): string[] => {
    const defaults: Record<OptionType, string[]> = {
      category: PRODUCT_CATEGORIES,
      brand: PRODUCT_BRANDS,
      finish: DEFAULT_FINISHES,
      size: DEFAULT_SIZES,
    };
    const merged = [...defaults[type]];
    customOptions[type].forEach(v => {
      if (!merged.includes(v)) merged.push(v);
    });
    return merged;
  }, [customOptions]);

  return { getOptions, addOption };
}
