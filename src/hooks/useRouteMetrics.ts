import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type RouteMetricsType = 'OS' | 'VG' | 'COT';

export interface RouteMetricRow {
  route_key: string; // "SC->MG"
  origin_uf: string;
  destination_uf: string;
  vehicle_type_id: string | null;
  vehicle_type_name: string | null;
  orders_count: number;
  avg_rs_per_km: number | null;
  p50_rs_per_km: number | null;
  p90_rs_per_km: number | null;
  avg_km: number | null;
  avg_paid: number | null;
}

export interface RouteMetricsConfigRow {
  id: string;
  origin_uf: string;
  destination_uf: string;
  vehicle_type_id: string | null;
  is_active: boolean;
  target_rs_per_km: number | null;
  min_rs_per_km: number | null;
  max_rs_per_km: number | null;
  notes: string | null;
  updated_at: string;
}

export interface UseRouteMetricsParams {
  fromIso: string;
  toIso: string;
  vehicleTypeId?: string | null;
}

export function useRouteMetrics(
  params: UseRouteMetricsParams
): UseQueryResult<RouteMetricRow[], Error> {
  const { fromIso, toIso, vehicleTypeId } = params;

  return useQuery({
    queryKey: ['route-metrics', fromIso, toIso, vehicleTypeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_route_metrics' as never,
        {
          p_from: fromIso,
          p_to: toIso,
          p_vehicle_type_id: vehicleTypeId ?? null,
        } as never
      );

      if (error) throw error;
      return (data ?? []) as RouteMetricRow[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useRouteMetricsConfig(
  vehicleTypeId?: string | null
): UseQueryResult<RouteMetricsConfigRow[], Error> {
  return useQuery({
    queryKey: ['route-metrics-config', vehicleTypeId ?? null],
    queryFn: async () => {
      let query = supabase
        .from('route_metrics_config' as never)
        .select(
          'id, origin_uf, destination_uf, vehicle_type_id, is_active, target_rs_per_km, min_rs_per_km, max_rs_per_km, notes, updated_at'
        )
        .order('updated_at', { ascending: false });

      if (vehicleTypeId) {
        query = query.eq('vehicle_type_id', vehicleTypeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RouteMetricsConfigRow[];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export type UpsertRouteMetricsConfigInput = Omit<RouteMetricsConfigRow, 'id' | 'updated_at'> & {
  id?: string;
};

export function useUpsertRouteMetricsConfig(): UseMutationResult<
  RouteMetricsConfigRow,
  Error,
  UpsertRouteMetricsConfigInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const { id, ...payload } = input;

      if (id) {
        const { data, error } = await supabase
          .from('route_metrics_config' as never)
          .update(payload as never)
          .eq('id', id)
          .select(
            'id, origin_uf, destination_uf, vehicle_type_id, is_active, target_rs_per_km, min_rs_per_km, max_rs_per_km, notes, updated_at'
          )
          .single();
        if (error) throw error;
        return data as RouteMetricsConfigRow;
      }

      const { data, error } = await supabase
        .from('route_metrics_config' as never)
        .insert(payload as never)
        .select(
          'id, origin_uf, destination_uf, vehicle_type_id, is_active, target_rs_per_km, min_rs_per_km, max_rs_per_km, notes, updated_at'
        )
        .single();
      if (error) throw error;
      return data as RouteMetricsConfigRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-metrics-config'] });
    },
  });
}

export function useDeleteRouteMetricsConfig(): UseMutationResult<void, Error, { id: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase
        .from('route_metrics_config' as never)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-metrics-config'] });
    },
  });
}
