import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

/** Lê piso ANTT do meta (camelCase ou legado snake_case no JSONB). */
export function readMetaAnttPisoCarreteiro(
  meta: StoredPricingBreakdown['meta'] | null | undefined
): number {
  if (!meta) return 0;
  const legacy = meta as { antt_piso_carreteiro?: number };
  // Não usar lotacaoPisoComOver aqui — inclui over % sobre o piso, não é o carreteiro base.
  return (
    Number(meta.antt?.total ?? 0) ||
    Number(meta.anttPisoCarreteiro ?? 0) ||
    Number(legacy.antt_piso_carreteiro ?? 0)
  );
}

/**
 * Piso ANTT (carreteiro) em R$ a partir do breakdown — prioriza meta.antt (calculadora).
 * Corrige snapshots onde custoMotoristaAntt foi gravado igual ao frete peso (tabela NTC).
 */
export function resolvePisoAnttCarreteiroReais(
  breakdown: StoredPricingBreakdown | null | undefined
): number {
  if (!breakdown) return 0;

  const m = breakdown.meta;
  const p = breakdown.profitability;
  const fromMeta = readMetaAnttPisoCarreteiro(m);
  const fromProfit = Number(p?.custoMotoristaAntt ?? 0);
  const contratado =
    Number(p?.custoMotoristaContratado) ||
    Number(p?.custosCarreteiro) ||
    Number(p?.custoMotorista) ||
    Number(breakdown.components?.baseCost) ||
    0;

  if (
    fromProfit > 0 &&
    contratado > 0 &&
    fromProfit >= contratado * 0.99 &&
    fromMeta > 0 &&
    fromMeta < fromProfit
  ) {
    return fromMeta;
  }

  return fromProfit > 0 ? fromProfit : fromMeta;
}

/** Frete peso contratado (NTC golden) — base do gross-up quando tabela > piso. */
export function resolveFretePesoContratadoReais(
  breakdown: StoredPricingBreakdown | null | undefined
): number {
  if (!breakdown) return 0;
  const p = breakdown.profitability;
  return (
    Number(p?.custoMotoristaContratado) ||
    Number(p?.custosCarreteiro) ||
    Number(p?.custoMotorista) ||
    Number(breakdown.components?.baseCost) ||
    0
  );
}
