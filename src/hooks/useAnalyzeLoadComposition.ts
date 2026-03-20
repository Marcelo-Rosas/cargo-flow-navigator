/**
 * Hook: useAnalyzeLoadComposition
 * Mutation to trigger the analyze-load-composition Edge Function.
 * Supports three trigger modes: batch, on_save, manual.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

type TriggerSource = 'batch' | 'on_save' | 'manual';

interface AnalyzeLoadCompositionParams {
  shipper_id: string;
  trigger_source?: TriggerSource;
  /** The newly saved quote (on_save mode) */
  anchor_quote_id?: string;
  /** Explicit quote selection (manual mode) */
  quote_ids?: string[];
  date_window_days?: number;
  min_viable_score?: number;
  /** If true, suppress toast notifications (for background on-save) */
  silent?: boolean;
}

interface AnalyzeLoadCompositionResponse {
  suggestions: unknown[];
  total_found: number;
  timestamp: string;
  message?: string;
  analysis_model_version?: string;
  trigger_source?: TriggerSource;
  quotes_analyzed?: number;
  quotes_total_in_window?: number;
  combinations_evaluated?: number;
  warnings?: string[];
}

export function useAnalyzeLoadComposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AnalyzeLoadCompositionParams) => {
      // Auth is handled by invokeEdgeFunction (requireAuth: true → Bearer JWT).
      // The Edge Function resolves user from JWT — no user_id in body needed.
      const data = await invokeEdgeFunction<AnalyzeLoadCompositionResponse>(
        'analyze-load-composition',
        {
          body: {
            shipper_id: params.shipper_id,
            trigger_source: params.trigger_source ?? 'batch',
            anchor_quote_id: params.anchor_quote_id,
            quote_ids: params.quote_ids,
            date_window_days: params.date_window_days ?? 14,
            min_viable_score: params.min_viable_score ?? 60,
          },
          requireAuth: true,
        }
      );
      return { ...data, _silent: params.silent };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['load-composition-suggestions'] });

      if ((data as { _silent?: boolean })._silent) return;

      const count = data?.total_found ?? data?.suggestions?.length ?? 0;
      toast.success(
        count > 0
          ? `${count} sugestão(ões) gerada(s) com sucesso`
          : (data?.message ?? 'Análise concluída (nenhuma sugestão viável)')
      );
      const truncWarnings = data?.warnings?.filter(
        (w) => w.includes('primeiras') || w.includes('capped')
      );
      if (truncWarnings?.length) {
        toast.message('Análise parcial', { description: truncWarnings.join(' ') });
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar sugestões: ${err.message}`);
    },
  });
}
