import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DieselRouteRow {
  rota: string;
  origin_uf: string;
  dest_uf: string;
  ctes: number;
  km_medio: number;
  diesel_orig: number;
  diesel_dest: number;
  media_rota: number;
  custo_por_km: number;
  diesel_total_medio: number;
  diesel_total_soma: number;
  receita_media: number;
  pct_ticket: number;
}

export function useDieselCostByRoute(from: string, to: string | null) {
  return useQuery<DieselRouteRow[]>({
    queryKey: ['diesel-cost-by-route', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_diesel_cost_by_route', {
        p_from: from,
        p_to: to ?? null,
      });
      if (error) throw error;
      return (data as DieselRouteRow[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
