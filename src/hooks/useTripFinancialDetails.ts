import { useQuery } from '@tanstack/react-query';
import { asDb } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

export interface TripFinancialDetailRow {
  order_id: string;
  os_number: string | null;
  trip_id: string | null;
  trip_number: string | null;
  vehicle_plate: string | null;
  trip_status: string | null;
  receita_prevista: number;
  receita_real: number;
  pedagio_previsto: number;
  pedagio_real: number;
  descarga_previsto: number;
  descarga_real: number;
  carreteiro_previsto: number;
  carreteiro_real: number;
  gris_previsto: number;
  tso_previsto: number;
  is_avulsa: boolean;
}

export function useTripFinancialDetails(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ['v_trip_financial_details', tripId],
    queryFn: async (): Promise<TripFinancialDetailRow[]> => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from('v_trip_financial_details' as never)
        .select('*')
        .eq('trip_id', asDb(tripId));

      if (error) throw error;
      return (data ?? []) as TripFinancialDetailRow[];
    },
    enabled: !!tripId,
  });
}
