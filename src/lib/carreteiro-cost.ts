import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

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
  const fromMeta =
    Number(m?.antt?.total ?? 0) ||
    Number(m?.anttPisoCarreteiro ?? 0) ||
    Number(m?.lotacaoPisoComOver ?? 0);
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
