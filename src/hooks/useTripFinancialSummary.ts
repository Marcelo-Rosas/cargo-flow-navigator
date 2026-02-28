import { useQuery } from '@tanstack/react-query';
import { asDb, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

export interface TripFinancialSummary {
  trip_id: string;
  trip_number: string;
  vehicle_plate: string;
  driver_id: string;
  status_operational: string;
  financial_status: string;
  orders_count: number;
  receita_bruta: number;
  custos_trip: number;
  custos_os: number;
  custos_diretos: number;
  margem_bruta: number;
  margem_percent: number | null;
}

export function useTripFinancialSummary(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ['trip_financial_summary', tripId],
    queryFn: async (): Promise<TripFinancialSummary | null> => {
      if (!tripId) return null;
      const { data, error } = await supabase
        .from('trip_financial_summary' as never)
        .select('*')
        .eq('trip_id', asDb(tripId))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<TripFinancialSummary>(data);
    },
    enabled: !!tripId,
  });
}
