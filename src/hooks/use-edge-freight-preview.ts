import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { adaptToLocalFormat } from '@/hooks/useCalculateFreight';
import type { CalculateFreightInput, CalculateFreightResponse } from '@/types/freight';
import type { FreightCalculationOutput } from '@/lib/freightCalculator';

export interface EdgeFreightPreviewResult {
  output: FreightCalculationOutput;
  raw: CalculateFreightResponse;
}

/**
 * Prévia de frete via Edge calculate-freight (paridade com persistência e modal de detalhe).
 * O wizard/formulário deve preferir este resultado ao cálculo local em freightCalculator.ts.
 */
export function useEdgeFreightPreview(input: CalculateFreightInput | null, enabled: boolean) {
  return useQuery({
    queryKey: ['edge-freight-preview', input],
    queryFn: async (): Promise<EdgeFreightPreviewResult | null> => {
      try {
        const data = await invokeEdgeFunction<CalculateFreightResponse>('calculate-freight', {
          body: input!,
        });
        if (!data.success) {
          console.warn(
            '[edge-freight-preview] calculate-freight retornou erro:',
            data.errors ?? data.error
          );
          return null;
        }
        return {
          output: adaptToLocalFormat(data) as FreightCalculationOutput,
          raw: data,
        };
      } catch (error) {
        console.warn('[edge-freight-preview] falha na Edge Function — usando cálculo local', error);
        return null;
      }
    },
    enabled:
      enabled &&
      !!input &&
      !!input.origin?.trim() &&
      !!input.destination?.trim() &&
      (input.km_distance ?? 0) > 0 &&
      (input.weight_kg ?? 0) > 0,
    staleTime: 15_000,
    retry: 1,
  });
}
