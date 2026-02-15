import { useQuery } from '@tanstack/react-query';
import { asDb, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

export interface Vehicle {
  id: string;
  plate: string;
  driver_id: string | null;
  active: boolean;
  brand: string | null;
  model: string | null;
}

export function useVehicles(driverId?: string | null) {
  return useQuery({
    queryKey: ['vehicles', driverId],
    queryFn: async () => {
      let query = supabase
        .from('vehicles')
        .select('id, plate, driver_id, active, brand, model')
        .eq('active', asDb(true))
        .order('plate', { ascending: true });

      // Optionally filter by driver_id
      if (driverId) {
        query = query.eq('driver_id', asDb(driverId));
      }

      const { data, error } = await query;

      if (error) throw error;
      return filterSupabaseRows<Vehicle>(data);
    },
  });
}

export function useVehicle(id: string | null | undefined) {
  return useQuery({
    queryKey: ['vehicles', 'single', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('vehicles')
        .select('id, plate, driver_id, active, brand, model')
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<Vehicle>(data);
    },
    enabled: !!id,
  });
}
