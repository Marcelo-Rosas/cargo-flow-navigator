import { calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import type { AnttFloorRate } from '@/hooks/useAnttFloorRate';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';
import { readMetaAnttPisoCarreteiro } from '@/lib/carreteiro-cost';

export interface EnrichBreakdownAnttMetaInput {
  axesCount?: number | null;
  kmDistance?: number | null;
  anttRate?: AnttFloorRate | null;
  retornoVazio?: boolean;
  composicaoVeicular?: boolean;
  altoDesempenho?: boolean;
  pisoFromResponse?: number;
}

/** Persiste bloco `meta.antt` quando o edge só devolveu `anttPisoCarreteiro` sem coeficientes. */
export function enrichStoredBreakdownAnttMeta(
  breakdown: StoredPricingBreakdown | Record<string, unknown>,
  input: EnrichBreakdownAnttMetaInput
): StoredPricingBreakdown {
  const base = breakdown as StoredPricingBreakdown;
  if (base.meta?.antt?.ccd != null && base.meta?.antt?.cc != null) {
    return base;
  }
  const km = Number(input.kmDistance ?? 0);
  const axes = input.axesCount;
  const rate = input.anttRate;
  if (!rate || !axes || km <= 0) return base;

  const calc = calculateAnttMinimum({
    kmDistance: km,
    ccd: Number(rate.ccd),
    cc: Number(rate.cc),
    retornoVazio: input.retornoVazio ?? false,
  });
  const piso =
    readMetaAnttPisoCarreteiro(base.meta) ||
    Math.max(0, Number(input.pisoFromResponse ?? 0)) ||
    calc.total;

  return {
    ...base,
    meta: {
      ...base.meta,
      anttPisoCarreteiro: base.meta.anttPisoCarreteiro ?? piso,
      antt: {
        operationTable: rate.operation_table,
        cargoType: rate.cargo_type,
        axesCount: axes,
        kmDistance: km,
        ccd: Number(rate.ccd),
        cc: Number(rate.cc),
        ida: calc.ida,
        retornoVazio: calc.retornoVazio,
        total: piso,
        calculatedAt: new Date().toISOString(),
        composicaoVeicular: input.composicaoVeicular,
        altoDesempenho: input.altoDesempenho,
      },
    },
  };
}
