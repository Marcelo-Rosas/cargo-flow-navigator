/**
 * Hook: useGenerateOptimalRoute
 * Mutation to trigger the generate-optimal-route Edge Function
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

interface GenerateOptimalRouteParams {
  quote_ids: string[];
  composition_id?: string;
  use_google_maps?: boolean;
  save_to_db?: boolean;
}

interface RouteLeg {
  from_location: unknown;
  to_location: unknown;
  distance_km: number;
  duration_min: number;
  polyline: string;
  sequence_number: number;
  quote_id?: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
  estimated_arrival?: string;
}

interface GenerateOptimalRouteResponse {
  success: boolean;
  route: {
    legs: RouteLeg[];
    total_distance_km: number;
    total_duration_min: number;
    waypoints: unknown[];
    composition_id: string | null;
  };
  timestamp: string;
}

export function useGenerateOptimalRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateOptimalRouteParams) => {
      const data = await invokeEdgeFunction<GenerateOptimalRouteResponse>(
        'generate-optimal-route',
        {
          body: {
            quote_ids: params.quote_ids,
            composition_id: params.composition_id,
            use_google_maps: params.use_google_maps ?? false,
            save_to_db: params.save_to_db ?? true,
          },
          requireAuth: true,
        }
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      if (variables.composition_id) {
        queryClient.invalidateQueries({
          queryKey: ['load-composition-suggestion', variables.composition_id],
        });
        queryClient.invalidateQueries({ queryKey: ['load-composition-suggestions'] });
      }
      toast.success('Rota gerada com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar rota: ${err.message}`);
    },
  });
}
