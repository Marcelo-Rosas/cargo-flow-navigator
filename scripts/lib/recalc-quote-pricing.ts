import type { CalculateFreightInput, CalculateFreightResponse } from '../../src/types/freight';
import { buildStoredBreakdownFromEdgeResponse } from '../../src/lib/build-stored-breakdown-from-edge';
import { mergeBreakdownWithNegotiatedDiscount } from '../../src/lib/quote-breakdown-utils';
import type { StoredPricingBreakdown } from '../../src/lib/freightCalculator';
import { inferAnttFlagsFromStoredMeta } from '../../src/lib/antt-floor-calc';
import {
  isPricingBreakdownRegimeStale,
  type ExpectedTaxRegime,
} from '../../src/lib/pricing-breakdown-stale';

export function parseCliFlag(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

export function hasCliFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export interface QuoteRecalcRow {
  id: string;
  quote_code: string | null;
  stage: string;
  value: number;
  origin: string;
  destination: string;
  km_distance: number | null;
  weight: number | null;
  volume: number | null;
  cargo_value: number | null;
  toll_value: number | null;
  vehicle_type_id: string | null;
  payment_term_id: string | null;
  vehicle_types?: { code: string } | null;
  payment_terms?: { code: string } | null;
  price_table_id: string | null;
  freight_modality: string | null;
  pricing_breakdown: Record<string, unknown> | null;
}

export function buildCalculateFreightPayload(quote: QuoteRecalcRow): CalculateFreightInput | null {
  const bd = quote.pricing_breakdown as StoredPricingBreakdown | null;
  const weightKg = Number(quote.weight) || 0;
  const volumeM3 = Number(quote.volume) || 0;
  const km = Number(quote.km_distance) || 0;

  if (!quote.origin || !quote.destination || km <= 0) return null;
  if (weightKg <= 0 && volumeM3 <= 0) return null;

  const anttFlags = inferAnttFlagsFromStoredMeta(bd?.meta?.antt);
  const base: CalculateFreightInput = {
    origin: quote.origin,
    destination: quote.destination,
    km_distance: km,
    weight_kg: weightKg > 0 ? weightKg : 1,
    volume_m3: volumeM3,
    cargo_value: Number(quote.cargo_value) || 0,
    toll_value: Number(quote.toll_value) || Number(bd?.components?.toll ?? 0),
    price_table_id: quote.price_table_id || undefined,
    vehicle_type_code: quote.vehicle_types?.code || undefined,
    payment_term_code: quote.payment_terms?.code || 'D30',
    descarga_value: bd?.profitability?.custosDescarga ?? 0,
    aluguel_maquinas_value: bd?.components?.aluguelMaquinas ?? 0,
    waiting_hours: bd?.meta?.waitingTimeHours ?? undefined,
  };

  if (quote.freight_modality === 'lotacao') {
    return {
      ...base,
      antt_composicao_veicular: anttFlags.composicaoVeicular,
      antt_alto_desempenho: anttFlags.altoDesempenho,
      antt_retorno_vazio: anttFlags.retornoVazio,
    };
  }

  return base;
}

/** Paridade com QuoteDetailModal: breakdown novo + desconto se value negociado. */
export function finalizeStoredBreakdown(
  quote: QuoteRecalcRow,
  response: CalculateFreightResponse
): StoredPricingBreakdown {
  const existing = quote.pricing_breakdown as StoredPricingBreakdown | null;
  let breakdown = buildStoredBreakdownFromEdgeResponse(
    response,
    existing
  ) as StoredPricingBreakdown;
  const formulaTotal = Number(breakdown.totals?.totalCliente ?? 0);
  const negotiated = Number(quote.value) || 0;
  if (negotiated > 0 && formulaTotal > 0 && negotiated < formulaTotal - 0.01) {
    breakdown = mergeBreakdownWithNegotiatedDiscount(breakdown, negotiated, formulaTotal);
  }
  return breakdown;
}

export function isRegimeStaleInBreakdown(
  breakdown: StoredPricingBreakdown | null,
  expected: ExpectedTaxRegime
): boolean {
  return isPricingBreakdownRegimeStale(breakdown, expected);
}
