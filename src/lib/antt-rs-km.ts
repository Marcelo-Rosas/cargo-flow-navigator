import type { StoredPricingBreakdown } from '@/lib/freightCalculator';
import { readMetaAnttPisoCarreteiro, resolvePisoAnttCarreteiroReais } from '@/lib/carreteiro-cost';

/** Piso ANTT total (R$) com fallbacks do breakdown + cálculo ao vivo. */
export function resolvePisoAnttTotalReais(params: {
  breakdown?: StoredPricingBreakdown | null;
  anttLiveTotal?: number | null;
  /** Quando o piso foi base de custo mas só `profitability` foi persistido */
  anttCostBaseFallback?: number | null;
}): number {
  const fromBreakdown = resolvePisoAnttCarreteiroReais(params.breakdown);
  if (fromBreakdown > 0) return fromBreakdown;
  const fromMeta = readMetaAnttPisoCarreteiro(params.breakdown?.meta);
  if (fromMeta > 0) return fromMeta;
  const live = Math.max(0, Number(params.anttLiveTotal ?? 0));
  if (live > 0) return live;
  const meta = params.breakdown?.meta;
  const usedAnttBase = meta?.anttCostBaseUsed === true || meta?.anttFloorApplied === true;
  if (usedAnttBase) {
    const fromProfit = Number(params.breakdown?.profitability?.custoMotoristaAntt ?? 0);
    if (fromProfit > 0) return fromProfit;
    const fallback = Math.max(0, Number(params.anttCostBaseFallback ?? 0));
    if (fallback > 0) return fallback;
  }
  return 0;
}

export function resolveAnttRsKm(params: {
  kmDistance: number;
  pisoAnttTotal: number;
  ccd?: number | null;
  cc?: number | null;
}): number | null {
  const km = Number(params.kmDistance);
  if (km <= 0) return null;
  if (params.pisoAnttTotal > 0) return Math.round((params.pisoAnttTotal / km) * 100) / 100;
  if (params.ccd != null && params.cc != null) {
    return Math.round(((km * Number(params.ccd) + Number(params.cc)) / km) * 100) / 100;
  }
  return null;
}
