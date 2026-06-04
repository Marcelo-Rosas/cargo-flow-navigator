import type { StoredPricingBreakdown } from '@/lib/freightCalculator';
import { resolvePisoAnttCarreteiroReais } from '@/lib/carreteiro-cost';

/** Piso ANTT total (R$) com fallbacks do breakdown + cálculo ao vivo. */
export function resolvePisoAnttTotalReais(params: {
  breakdown?: StoredPricingBreakdown | null;
  anttLiveTotal?: number | null;
}): number {
  const fromBreakdown = resolvePisoAnttCarreteiroReais(params.breakdown);
  if (fromBreakdown > 0) return fromBreakdown;
  const meta = params.breakdown?.meta;
  const fromMeta =
    Number(meta?.antt?.total ?? 0) ||
    Number(meta?.anttPisoCarreteiro ?? 0) ||
    Number(meta?.lotacaoPisoComOver ?? 0);
  if (fromMeta > 0) return fromMeta;
  return Math.max(0, Number(params.anttLiveTotal ?? 0));
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
