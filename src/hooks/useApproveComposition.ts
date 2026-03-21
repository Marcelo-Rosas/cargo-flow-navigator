/**
 * Hook: useApproveComposition
 * Mutation to approve and execute a load composition suggestion
 * Creates consolidated order and notifies embarcador via WhatsApp
 *
 * Usage:
 *   const { mutate, isPending } = useApproveComposition();
 *   mutate(
 *     { composition_id: 'abc-123', notes: 'Aprovado' },
 *     { onSuccess: () => { refetch(); } }
 *   );
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ApproveCompositionRequest {
  composition_id: string;
  user_id?: string; // optional, will use current auth user if not provided
  notes?: string;
}

export interface ApproveCompositionResponse {
  success: boolean;
  order_id: string;
  status: 'executed';
  summary: {
    quotes_consolidated: number;
    estimated_savings_brl: number;
    estimated_km: number;
    order_status: string;
  };
}

/**
 * Mutation hook to approve a load composition suggestion
 * Orchestrates: create order, update quotes, update suggestion, send notification
 */
export function useApproveComposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: ApproveCompositionRequest) => {
      // Get current user if not provided
      let userId = req.user_id;
      if (!userId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }
        userId = user.id;
      }

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('approve-composition', {
        body: {
          composition_id: req.composition_id,
          user_id: userId,
          notes: req.notes,
        },
      });

      if (error) {
        throw new Error(`Failed to approve composition: ${error.message}`);
      }

      return data as ApproveCompositionResponse;
    },

    onSuccess: (response, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['load-composition-suggestions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['load-composition-suggestion', variables.composition_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['quotes'],
      });
      queryClient.invalidateQueries({
        queryKey: ['orders'],
      });

      // Toast feedback
      const savings = (response.summary.estimated_savings_brl / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
      });

      toast.success(
        `Consolidação aprovada! Ordem ${response.order_id} criada. Economia: ${savings}`,
        {
          duration: 5000,
        }
      );
    },

    onError: (error: Error) => {
      toast.error(`Erro ao aprovar consolidação: ${error.message}`, {
        duration: 5000,
      });
    },
  });
}

/**
 * Hook to approve composition with automatic user context
 * Convenience wrapper if composition_id is the only required input
 */
export function useApproveCompositionSimple() {
  const mutation = useApproveComposition();

  return {
    approve: (compositionId: string, notes?: string) => {
      return mutation.mutate({ composition_id: compositionId, notes });
    },
    ...mutation,
  };
}
