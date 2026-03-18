import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RsPerKmRow {
  order_id: string;
  os_number: string | null;
  client_name: string | null;
  origin: string;
  destination: string;
  km_distance: number;
  carreteiro_real: number;
  rs_per_km: number;
  vehicle_type_id: string | null;
  vehicle_type_name: string | null;
  order_date: string;
}

export interface UseRsPerKmByRouteParams {
  dateFrom: string; // dd/mm/yyyy vindo do DateFilterRange
  dateTo: string;
  vehicleTypeId?: string | null;
}

function toIsoRange(dateFrom: string, dateTo: string): { fromIso: string; toIso: string } {
  // DateFilterRange já entrega dd/mm/yyyy; converter para ISO simples local
  const [dfDay, dfMonth, dfYear] = dateFrom.split('/');
  const [dtDay, dtMonth, dtYear] = dateTo.split('/');

  const from = new Date(Number(dfYear), Number(dfMonth) - 1, Number(dfDay), 0, 0, 0);
  const to = new Date(Number(dtYear), Number(dtMonth) - 1, Number(dtDay), 23, 59, 59, 999);

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

export function useRsPerKmByRoute(
  params: UseRsPerKmByRouteParams
): UseQueryResult<RsPerKmRow[], Error> {
  const { dateFrom, dateTo, vehicleTypeId } = params;

  return useQuery<RsPerKmRow[], Error>({
    queryKey: ['rs-per-km-by-route', dateFrom, dateTo, vehicleTypeId],
    queryFn: async () => {
      const { fromIso, toIso } = toIsoRange(dateFrom, dateTo);

      type Row = {
        order_id: string;
        os_number: string | null;
        client_name: string | null;
        origin: string;
        destination: string;
        km_distance: number;
        carreteiro_real: number;
        rs_per_km: number;
        vehicle_type_id: string | null;
        vehicle_type_name: string | null;
        order_date: string;
      };

      let query = supabase
        .from('orders_rs_per_km' as never)
        .select(
          `
          order_id,
          os_number,
          client_name,
          origin,
          destination,
          km_distance,
          carreteiro_real,
          rs_per_km,
          vehicle_type_id,
          vehicle_type_name,
          order_date
        `
        )
        .gte('order_date', fromIso)
        .lte('order_date', toIso)
        .order('rs_per_km', { ascending: false });

      if (vehicleTypeId) {
        query = query.eq('vehicle_type_id', vehicleTypeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []) as Row[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
