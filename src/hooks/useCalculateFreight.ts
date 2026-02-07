import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  CalculateFreightInput,
  CalculateFreightResponse,
} from '@/types/pricing';

export function useCalculateFreight() {
  return useMutation({
    mutationFn: async (input: CalculateFreightInput): Promise<CalculateFreightResponse> => {
      const { data, error } = await supabase.functions.invoke('calculate-freight', {
        body: input,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao calcular frete');
      }

      if (!data.success) {
        throw new Error(data.errors?.join(', ') || 'Erro no cálculo do frete');
      }

      return data as CalculateFreightResponse;
    },
  });
}

// Utility function for formatting currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Utility function for formatting percentage
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

// Utility function for formatting weight
export function formatWeight(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} t`;
  }
  return `${value.toFixed(2)} kg`;
}
