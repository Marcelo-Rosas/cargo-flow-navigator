/**
 * Hook: useAnalyzeLoadComposition
 * Mutation to trigger the analyze-load-composition Edge Function
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalyzeLoadCompositionParams {
  shipper_id: string;
  date_window_days?: number;
  min_viable_score?: number;
}

interface AnalyzeLoadCompositionResponse {
  suggestions: unknown[];
  total_found: number;
  timestamp: string;
  message?: string;
}

export function useAnalyzeLoadComposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AnalyzeLoadCompositionParams) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }
      const data = await invokeEdgeFunction<AnalyzeLoadCompositionResponse>(
        'analyze-load-composition',
        {
          body: {
            shipper_id: params.shipper_id,
            user_id: user.id,
            date_window_days: params.date_window_days ?? 14,
            min_viable_score: params.min_viable_score ?? 60,
          },
          requireAuth: true,
        }
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['load-composition-suggestions'] });
      const count = data?.total_found ?? data?.suggestions?.length ?? 0;
      toast.success(
        count > 0
          ? `${count} sugestão(ões) gerada(s) com sucesso`
          : (data?.message ?? 'Análise concluída (nenhuma sugestão viável)')
      );
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar sugestões: ${err.message}`);
    },
  });
}
