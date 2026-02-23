import { useQuery } from '@tanstack/react-query';
import { filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type VehicleType = Database['public']['Tables']['vehicle_types']['Row'];

export function useVehicleTypes() {
  return useQuery({
    queryKey: ['vehicle-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('id, code, name, axes_count, capacity_kg, capacity_m3, active')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return filterSupabaseRows<VehicleType>(data);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — vehicle types rarely change
  });
}
