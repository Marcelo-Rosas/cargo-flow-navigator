/**
 * Shared utilities for data quality validation and enrichment
 * Used by analyze-load-composition and related functions
 *
 * Phase 1: Data Quality Gate
 * Phase 2: KM Data Enrichment
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateRouteDistance } from './webrouter-client.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteRow {
  id: string;
  shipper_id: string | null;
  origin: string;
  destination: string;
  origin_cep: string | null;
  destination_cep: string | null;
  km_distance: number | null;
  weight: number | null;
  value: number;
  estimated_loading_date: string | null;
  stage: string;
  quote_code: string | null;
  client_name: string;
  route_stops?: RouteStopRow[];
}

export interface RouteStopRow {
  cep: string | null;
  city_uf: string | null;
  sequence: number;
}

export interface DataQualityCheck {
  hasKmData: boolean;
  hasCepData: boolean;
  hasLoadingDates: boolean;
  totalScore: number; // 0-100
  details: {
    withKm: number;
    totalQuotes: number;
    withCep: number;
    withDate: number;
  };
}

export interface EnrichmentResult {
  enriched: QuoteRow[];
  updated: number;
  failed: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Phase 1: Data Quality Check
// ---------------------------------------------------------------------------

/**
 * Check data quality of a quote combination.
 * Returns quality score and feasibility flags.
 *
 * Quality Score = (40% km_data) + (30% cep_data) + (30% loading_dates)
 */
export function checkDataQuality(quotes: QuoteRow[]): DataQualityCheck {
  if (quotes.length === 0) {
    return {
      hasKmData: false,
      hasCepData: false,
      hasLoadingDates: false,
      totalScore: 0,
      details: { withKm: 0, totalQuotes: 0, withCep: 0, withDate: 0 },
    };
  }

  const withKm = quotes.filter((q) => q.km_distance && q.km_distance > 0).length;
  const withCep = quotes.filter(
    (q) =>
      q.origin_cep && q.destination_cep && isValidCep(q.origin_cep) && isValidCep(q.destination_cep)
  ).length;
  const withDate = quotes.filter((q) => q.estimated_loading_date).length;

  const totalQuotes = quotes.length;
  const kmPercent = (withKm / totalQuotes) * 100;
  const cepPercent = (withCep / totalQuotes) * 100;
  const datePercent = (withDate / totalQuotes) * 100;

  const totalScore = kmPercent * 0.4 + cepPercent * 0.3 + datePercent * 0.3;

  return {
    hasKmData: withKm >= Math.ceil(totalQuotes * 0.7), // 70% minimum
    hasCepData: withCep >= Math.floor(totalQuotes * 0.5), // 50% ideal
    hasLoadingDates: withDate === totalQuotes, // 100% required
    totalScore: Math.round(totalScore),
    details: { withKm, totalQuotes, withCep, withDate },
  };
}

/**
 * Validate if CEP string is properly formatted (8 digits)
 */
function isValidCep(cep: string | null): boolean {
  if (!cep) return false;
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.length === 8;
}

/**
 * Generate human-readable reason why quality gate failed
 */
export function getQualityGateReason(check: DataQualityCheck): string {
  const reasons = [];

  if (!check.hasLoadingDates) {
    const missing = check.details.totalQuotes - check.details.withDate;
    reasons.push(`${missing} cotação(ões) sem data de carregamento`);
  }

  if (!check.hasKmData) {
    const missing = check.details.totalQuotes - check.details.withKm;
    const needed = Math.ceil(check.details.totalQuotes * 0.7);
    reasons.push(`Apenas ${check.details.withKm}/${needed} cotações com distância (km)`);
  }

  if (!check.hasCepData) {
    reasons.push(`CEPs insuficientes (${check.details.withCep}/${check.details.totalQuotes})`);
  }

  return reasons.length > 0 ? reasons.join('; ') : 'Score: ' + check.totalScore + '%';
}

// ---------------------------------------------------------------------------
// Phase 2: KM Data Enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich quotes with missing km_distance by calling WebRouter API.
 * If a quote has valid CEPs but no km_distance, calculate it.
 *
 * @param supabase Supabase client
 * @param quotes Array of quotes to enrich
 * @param dryRun If true, don't save to DB (just calculate)
 * @returns Enriched quotes + metrics
 */
export async function enrichQuoteKmData(
  supabase: SupabaseClient,
  quotes: QuoteRow[],
  dryRun = false
): Promise<EnrichmentResult> {
  const enriched: QuoteRow[] = [];
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const quote of quotes) {
    try {
      // If already has km_distance, skip
      if (quote.km_distance && quote.km_distance > 0) {
        enriched.push(quote);
        continue;
      }

      // If has valid CEPs, try to calculate
      if (quote.origin_cep && quote.destination_cep) {
        const originCep = quote.origin_cep.replace(/\D/g, '');
        const destCep = quote.destination_cep.replace(/\D/g, '');

        if (originCep.length === 8 && destCep.length === 8) {
          console.log(
            `[enrichment] Calculating km for quote ${quote.id} (${originCep} → ${destCep})`
          );

          const result = await calculateRouteDistance(originCep, destCep, []);

          if (result.success && result.km_distance) {
            const enrichedQuote = {
              ...quote,
              km_distance: result.km_distance,
            };

            // Save to DB if not dry run
            if (!dryRun) {
              const { error } = await supabase
                .from('quotes')
                .update({ km_distance: result.km_distance })
                .eq('id', quote.id);

              if (error) {
                throw new Error(`Failed to save km: ${error.message}`);
              }
            }

            enriched.push(enrichedQuote);
            updated++;
            console.log(`[enrichment] ✓ Updated quote ${quote.id} with ${result.km_distance}km`);
          } else {
            errors.push(`Quote ${quote.id}: WebRouter failed (${result.error || 'unknown error'})`);
            enriched.push(quote); // Keep original
            failed++;
          }
        } else {
          enriched.push(quote);
        }
      } else {
        enriched.push(quote);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Quote ${quote.id}: ${msg}`);
      enriched.push(quote);
      failed++;
    }
  }

  return { enriched, updated, failed, errors };
}

// ---------------------------------------------------------------------------
// Phase 3: Validation Gate
// ---------------------------------------------------------------------------

/**
 * Determine if a combination is viable for consolidation analysis.
 * Returns true if data is sufficient to proceed.
 *
 * Gate checks:
 * - All quotes must have estimated_loading_date (100%)
 * - Min 70% of quotes must have km_distance
 * - Min 50% should have valid CEPs (ideal, not required)
 */
export function shouldProceedWithAnalysis(check: DataQualityCheck): boolean {
  return check.hasLoadingDates && check.hasKmData;
}

/**
 * Model that should be used if data quality insufficient
 */
export const INSUFFICIENT_DATA_MODEL = 'insufficient_data' as const;

/**
 * Generate explanation for insufficient data rejection
 */
export function getInsufficientDataExplanation(
  check: DataQualityCheck,
  quotes: QuoteRow[]
): string {
  const details = check.details;

  let explanation = `Dados insuficientes para análise de consolidação:\n`;

  if (!check.hasLoadingDates) {
    const missing = details.totalQuotes - details.withDate;
    explanation += `• ${missing} cotação(ões) sem data de carregamento (obrigatório: 100%)\n`;
  }

  if (!check.hasKmData) {
    const missing = details.totalQuotes - details.withKm;
    const needed = Math.ceil(details.totalQuotes * 0.7);
    explanation += `• Apenas ${details.withKm}/${needed} cotações com distância em km (necessário: 70%)\n`;

    const missingKmQuotes = quotes
      .filter((q) => !q.km_distance || q.km_distance <= 0)
      .map((q) => q.quote_code || q.id.slice(0, 8))
      .join(', ');

    explanation += `  Preencha km nas cotações: ${missingKmQuotes}`;
  }

  return explanation;
}
