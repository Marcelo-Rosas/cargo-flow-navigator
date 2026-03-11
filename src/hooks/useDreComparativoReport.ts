import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OrderDreInput, DreComparativoRow, DreGroupBy } from '@/modules/dre';
import { groupDreRows } from '@/modules/dre';

export interface UseDreComparativoReportParams {
  year?: number | null;
  month?: number | null;
  vehicleTypeId?: string | null;
  groupBy: DreGroupBy;
  enabled?: boolean;
}

export function useDreComparativoReport({
  year,
  month,
  vehicleTypeId,
  groupBy,
  enabled = true,
}: UseDreComparativoReportParams) {
  return useQuery({
    queryKey: ['dre-comparativo', year, month, vehicleTypeId, groupBy],
    queryFn: async (): Promise<DreComparativoRow[]> => {
      let q = supabase
        .from('orders')
        .select(
          `id, os_number, quote_id, trip_id, value, created_at, pricing_breakdown,
           carreteiro_real, pedagio_real, descarga_real,
           quote:quotes(quote_code), trip:trips(trip_number)`
        )
        .not('carreteiro_real', 'is', null)
        .not('value', 'is', null)
        .gt('value', 0);

      if (vehicleTypeId) {
        q = q.eq('vehicle_type_id', vehicleTypeId);
      }

      const { data, error } = await q;
      if (error) throw error;

      type OrderRow = {
        id: string;
        os_number: string;
        quote_id: string | null;
        trip_id: string | null;
        value: number;
        created_at: string;
        pricing_breakdown: unknown;
        carreteiro_real: number | null;
        pedagio_real: number | null;
        descarga_real: number | null;
        quote?: { quote_code?: string | null } | null;
        trip?: { trip_number?: string | null } | null;
      };

      const rawOrders = (data ?? []) as OrderRow[];

      const quoteCodes = new Map<string, string>();
      const tripNumbers = new Map<string, string>();
      for (const o of rawOrders) {
        if (o.quote_id && o.quote?.quote_code) quoteCodes.set(o.quote_id, o.quote.quote_code);
        if (o.trip_id && o.trip?.trip_number) tripNumbers.set(o.trip_id, o.trip.trip_number);
      }

      let filtered = rawOrders;
      if (year != null) {
        filtered = filtered.filter((o) => {
          const d = new Date(o.created_at);
          if (d.getFullYear() !== year) return false;
          if (month != null && d.getMonth() + 1 !== month) return false;
          return true;
        });
      }

      const orders: OrderDreInput[] = filtered.map((o) => ({
        id: o.id,
        os_number: o.os_number,
        quote_id: o.quote_id,
        trip_id: o.trip_id,
        value: o.value,
        created_at: o.created_at,
        pricing_breakdown: o.pricing_breakdown,
        carreteiro_real: o.carreteiro_real,
        pedagio_real: o.pedagio_real,
        descarga_real: o.descarga_real,
        quote_code: o.quote?.quote_code ?? null,
        trip_number: o.trip?.trip_number ?? null,
      }));

      return groupDreRows(orders, groupBy, { quoteCodes, tripNumbers });
    },
    enabled: enabled ?? true,
  });
}
