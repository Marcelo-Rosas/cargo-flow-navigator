/**
 * Hook: useCalculateDiscounts
 * Mutation to calculate discount proposals for a load composition
 * Respects margin rules while maximizing competitiveness
 *
 * Usage:
 *   const { mutate: calculateDiscounts, isPending } = useCalculateDiscounts();
 *   calculateDiscounts({
 *     composition_id: 'abc-123',
 *     minimum_margin_percent: 30,
 *     discount_strategy: 'proportional_to_original'
 *   });
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DiscountProposal } from './useLoadCompositionSuggestions';

export interface CalculateDiscountsRequest {
  composition_id: string;
  discount_strategy?: 'equal_share' | 'proportional_to_original' | 'weighted_by_weight';
  minimum_margin_percent?: number; // default: 30
  simulate_only?: boolean; // if true, don't save to DB
}

export interface DiscountSummary {
  total_original_price: number;
  total_discount_offered: number;
  total_final_price: number;
  avg_final_margin_percent: number;
  min_final_margin_percent: number;
  // Toll economy breakdown (centavos)
  antt_economy_centavos?: number;
  toll_economy_centavos?: number;
  total_economy_centavos?: number;
  individual_toll_sum_centavos?: number;
  composed_toll_centavos?: number;
}

export interface CalculateDiscountsResponse {
  success: boolean;
  composition_id: string;
  discount_breakdown: DiscountProposal[];
  summary: DiscountSummary;
}

/**
 * Mutation hook to calculate discount proposals for a composition
 */
export function useCalculateDiscounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: CalculateDiscountsRequest) => {
      const { data, error } = await supabase.functions.invoke('calculate-discount-breakdown', {
        body: {
          composition_id: req.composition_id,
          discount_strategy: req.discount_strategy || 'proportional_to_original',
          minimum_margin_percent: req.minimum_margin_percent || 30,
          simulate_only: req.simulate_only || false,
        },
      });

      if (error) {
        throw new Error(`Failed to calculate discounts: ${error.message}`);
      }

      return data as CalculateDiscountsResponse;
    },

    onSuccess: (response, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['load-composition-suggestion', variables.composition_id],
      });

      // Toast feedback
      const totalDiscount = (response.summary.total_discount_offered / 100).toLocaleString(
        'pt-BR',
        { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }
      );
      const avgMargin = response.summary.avg_final_margin_percent.toFixed(1);

      toast.success(`Descontos calculados! Total: ${totalDiscount} • Margem média: ${avgMargin}%`, {
        duration: 5000,
      });
    },

    onError: (error: Error) => {
      toast.error(`Erro ao calcular descontos: ${error.message}`, {
        duration: 5000,
      });
    },
  });
}
