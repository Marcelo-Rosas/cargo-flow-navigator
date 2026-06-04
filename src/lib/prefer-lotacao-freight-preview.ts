import type { FreightCalculationOutput } from '@/lib/freightCalculator';
import type { CalculateFreightResponse } from '@/types/freight';

/**
 * Wizard lotação: prefere motor local quando a Edge ainda usa max(tabela, piso)
 * ou não envia piso, mas o cliente já tem piso ANTT para gross-up.
 */
export function shouldPreferLocalLotacaoFreightPreview(params: {
  local: FreightCalculationOutput;
  edge: FreightCalculationOutput;
  edgeRaw?: CalculateFreightResponse | null;
  localPiso: number;
}): boolean {
  const { local, edge, edgeRaw, localPiso } = params;
  if (local.status !== 'OK' || localPiso <= 0) return false;

  const edgeBase = edge.components?.baseCost ?? 0;
  const localBase = local.components?.baseCost ?? 0;
  const edgeUsesAnttBase = edgeRaw?.meta?.antt_cost_base_used === true;
  const localUsesAnttBase = local.meta?.anttCostBaseUsed === true;
  const edgePiso = edgeRaw?.meta?.antt_piso_carreteiro ?? 0;

  if (localUsesAnttBase && !edgeUsesAnttBase) return true;
  if (edgePiso <= 0) return true;
  if (localBase > edgeBase + 0.01) return true;
  if (localBase < edgeBase - 0.01 && localUsesAnttBase) return true;

  return false;
}
