import type { StoredPricingBreakdown } from '@/lib/freightCalculator';
import type { AnttOperationTable } from '@/lib/antt-floor-calc';

/** Snapshot ANTT na resposta da Edge (`meta.antt`, snake_case). */
export interface EdgeAnttMetaSnapshot {
  operation_table: AnttOperationTable;
  cargo_type: string;
  axes_count: number;
  km_distance: number;
  ccd: number;
  cc: number;
  ida: number;
  retorno_vazio: number;
  total: number;
  composicao_veicular: boolean;
  alto_desempenho: boolean;
}

export function mapEdgeAnttMetaToStored(
  edge: EdgeAnttMetaSnapshot | null | undefined,
  calculatedAt?: string | null
): StoredPricingBreakdown['meta']['antt'] | undefined {
  if (!edge || edge.ccd == null || edge.cc == null || !edge.axes_count) return undefined;
  return {
    operationTable: edge.operation_table,
    cargoType: edge.cargo_type,
    axesCount: edge.axes_count,
    kmDistance: edge.km_distance,
    ccd: Number(edge.ccd),
    cc: Number(edge.cc),
    ida: Number(edge.ida),
    retornoVazio: Number(edge.retorno_vazio ?? 0),
    total: Number(edge.total),
    calculatedAt: calculatedAt ?? new Date().toISOString(),
    composicaoVeicular: edge.composicao_veicular,
    altoDesempenho: edge.alto_desempenho,
  };
}
