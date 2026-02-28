import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { filterSupabaseRows } from '@/lib/supabase-utils';

export interface UnloadingCostRate {
  id: string;
  name: string;
  code: string;
  unit: string;
  value: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
}

export function useUnloadingCostRates(activeOnly = true) {
  return useQuery({
    queryKey: ['unloading_cost_rates', activeOnly],
    queryFn: async () => {
      let q = supabase
        .from('unloading_cost_rates')
        .select('id, name, code, unit, value, active, valid_from, valid_until')
        .order('name');

      if (activeOnly) {
        q = q.eq('active', true);
      }

      const { data, error } = await q;
      if (error) throw error;
      return filterSupabaseRows<UnloadingCostRate>(data);
    },
  });
}
