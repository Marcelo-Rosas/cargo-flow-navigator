/// <reference path="../_shared/deno.d.ts" />
/**
 * Edge Function: analyze-load-composition  (v2 — route-fit evaluation)
 *
 * Analyzes pending quotes and suggests consolidation opportunities.
 * Supports three trigger modes: batch, on_save, manual.
 *
 * All three share the SAME discovery + route-fit evaluation engine.
 *
 * Input:
 *   - shipper_id:        UUID (required for batch/on_save; inferred for manual)
 *   - trigger_source:    'batch' | 'on_save' | 'manual'  (default: 'batch')
 *   - anchor_quote_id:   UUID — the newly saved quote (on_save only)
 *   - quote_ids:         UUID[] — explicit selection (manual only)
 *   - date_window_days:  number (default: 14)
 *   - min_viable_score:  number (default: 60)
 *
 * Auth: Bearer JWT required. created_by = JWT sub.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { calculateRouteDistance } from '../_shared/webrouter-client.ts';
import {
  inferAxesFromWeight,
  getAnttFloorRate,
  calculateSeparateCost,
  calculateConsolidatedCost,
} from './antt-utils.ts';
import {
  checkDataQuality,
  enrichQuoteKmData,
  shouldProceedWithAnalysis,
  getQualityGateReason,
  INSUFFICIENT_DATA_MODEL,
} from '../_shared/composition-data-quality.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TriggerSource = 'batch' | 'on_save' | 'manual';

interface CompositionRequest {
  shipper_id?: string;
  /** @deprecated Ignored — use JWT only. Kept for backwards compat. */
  user_id?: string;
  trigger_source?: TriggerSource;
  anchor_quote_id?: string;
  quote_ids?: string[];
  date_window_days?: number;
  min_viable_score?: number;
}

/** Columns actually present on the quotes table */
interface QuoteRow {
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
  /** Populated from quote_route_stops join */
  route_stops?: RouteStopRow[];
}

interface RouteStopRow {
  cep: string | null;
  city_uf: string | null;
  sequence: number;
}

interface SuggestionRow {
  quote_ids: string[];
  consolidation_score: number;
  estimated_savings_brl: number;
  distance_increase_percent: number;
  validation_warnings: string[];
  is_feasible: boolean;
  trigger_source: TriggerSource;
  anchor_quote_id: string | null;
  technical_explanation: string;
  delta_km_abs: number | null;
  delta_km_percent: number | null;
  base_km_total: number | null;
  composed_km_total: number | null;
  route_evaluation_model: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_VIABLE_SCORE = 60;
const MIN_SAVINGS_CENTAVOS = 0; // Mostrar todas sugestões viáveis (removido mínimo R$500)
const DEFAULT_DATE_WINDOW_DAYS = 14;
const MAX_TRUCK_CAPACITY_KG = 30000;
/** Hard rule: max days between loading dates for feasibility */
const MAX_DATE_SPREAD_DAYS = 3;
const MAX_QUOTES_FOR_COMBINATORICS = 25;
const MAX_COMBINATION_EVALUATIONS = 8000;
/** How many top candidates get real WebRouter evaluation */
const MAX_WEBROUTER_EVALUATIONS = 10;
/** Max delta-km % to consider the stop a natural corridor fit */
const MAX_CORRIDOR_DELTA_PERCENT = 20;
/** Min fraction of quotes that must have km_distance for route evaluation */
const KM_DATA_THRESHOLD = 0.7;
/** Eligible stages for composition analysis */
const ELIGIBLE_STAGES = ['precificacao', 'enviado', 'negociacao'];

/** Check if a route evaluation model should be rejected from results.
 *  insufficient_data agora é mantido como feasible=false (não descartado). */
function shouldSkipResult(routeModel: string): boolean {
  return routeModel === 'mock_v1'; // Apenas mock_v1 é descartado; insufficient_data mantido
}

const QUOTE_SELECT =
  'id, shipper_id, origin, destination, origin_cep, destination_cep, km_distance, weight, value, estimated_loading_date, stage, quote_code, client_name, route_stops:quote_route_stops(cep, city_uf, sequence)';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, x-api-key, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function resolveUserIdFromJwt(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) return { error: 'Missing JWT', status: 401 };

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(jwt);

  if (error || !user?.id) {
    return { error: error?.message ?? 'Invalid or expired session', status: 401 };
  }
  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// A) Discovery Engine
// ---------------------------------------------------------------------------

async function discoverCandidates(
  supabase: SupabaseClient,
  shipperId: string,
  dateWindowDays: number,
  excludeQuoteIds?: string[]
): Promise<QuoteRow[]> {
  // Strategy: fetch ALL eligible quotes for this shipper, then filter in-memory.
  // This handles quotes with NULL estimated_loading_date (included with warning)
  // and avoids the rigid 14-day window excluding valid candidates.

  // Hard filter: only quotes WITH estimated_loading_date are eligible for consolidation
  let query = supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .eq('shipper_id', shipperId)
    .in('stage', ELIGIBLE_STAGES)
    .not('estimated_loading_date', 'is', null)
    .order('estimated_loading_date', { ascending: true });

  if (excludeQuoteIds && excludeQuoteIds.length > 0) {
    query = query.not('id', 'in', `(${excludeQuoteIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[discovery] Query error:', error);
    return [];
  }

  const allEligible = (data ?? []) as QuoteRow[];

  // Filter: recent past (up to 3 days ago) AND within dateWindowDays into the future.
  // This ensures shippers with date_window_days: 7 don't miss nearby loads,
  // while excluding loads too far in the future that wouldn't be combinable.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lowerBound = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const upperBound = new Date(today.getTime() + dateWindowDays * 24 * 60 * 60 * 1000);

  const result = allEligible.filter((q) => {
    const loadDate = new Date(q.estimated_loading_date! + 'T12:00:00');
    return loadDate >= lowerBound && loadDate <= upperBound;
  });

  console.log(
    `[discovery] ${allEligible.length} eligible for shipper, ${result.length} after date filter (past=3d, future=${dateWindowDays}d)`
  );

  return result;
}

function generatePairTripleCombinations(quotes: QuoteRow[]): QuoteRow[][] {
  const combinations: QuoteRow[][] = [];
  const n = quotes.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      combinations.push([quotes[i], quotes[j]]);
    }
  }

  if (n >= 3) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          combinations.push([quotes[i], quotes[j], quotes[k]]);
        }
      }
    }
  }

  return combinations;
}

// ---------------------------------------------------------------------------
// B) Route Fit Evaluator
// ---------------------------------------------------------------------------

interface RouteEvaluation {
  base_km_total: number;
  composed_km_total: number;
  delta_km_abs: number;
  delta_km_percent: number;
  is_corridor_fit: boolean;
  model: 'webrouter_v1' | 'stored_km_v1' | 'mock_v1' | 'insufficient_data';
  explanation: string;
}

/**
 * Evaluate route fit using stored km_distance values.
 * Logic: if quotes share origin, the composed route goes
 * origin → intermediate destinations → final destination.
 * Compare sum(individual_km) vs composed_km.
 *
 * If CEPs are available, try WebRouter for top candidates.
 */
async function evaluateRouteFit(
  quotes: QuoteRow[],
  useWebRouter: boolean
): Promise<RouteEvaluation> {
  // Sort by km_distance descending — longest route is the "main" route
  const sorted = [...quotes].sort((a, b) => (b.km_distance ?? 0) - (a.km_distance ?? 0));
  const mainQuote = sorted[0];
  const secondaryQuotes = sorted.slice(1);

  const baseKmTotal = quotes.reduce((sum, q) => sum + (q.km_distance ?? 0), 0);

  // Phase 3: Check minimum km data threshold before route evaluation
  const quotesWithKm = quotes.filter((q) => q.km_distance && q.km_distance > 0).length;
  const kmDataAvailable = quotesWithKm / quotes.length >= KM_DATA_THRESHOLD;

  if (!kmDataAvailable) {
    const needed = Math.ceil(quotes.length * KM_DATA_THRESHOLD);
    return {
      base_km_total: 0,
      composed_km_total: 0,
      delta_km_abs: 0,
      delta_km_percent: 0,
      is_corridor_fit: false,
      model: INSUFFICIENT_DATA_MODEL,
      explanation: `Dados insuficientes de distância. ${quotesWithKm}/${needed} cotações com km preenchido. Preencha o campo "Distância (km)" nas cotações.`,
    };
  }

  // Check if all quotes share the same origin CEP
  const originCeps = quotes
    .map((q) => q.origin_cep?.replace(/\D/g, '') ?? '')
    .filter((c) => c.length === 8);
  const sharedOriginCep =
    originCeps.length === quotes.length && new Set(originCeps).size === 1 ? originCeps[0] : null;

  // Collect all intermediate waypoints: route_stops from each quote + secondary destinations
  function collectWaypointCeps(mainQ: QuoteRow, secondaryQs: QuoteRow[]): string[] {
    const ceps: string[] = [];
    // 1. Add route_stops from the main quote (intermediate stops already part of its route)
    if (mainQ.route_stops && mainQ.route_stops.length > 0) {
      const stopsSorted = [...mainQ.route_stops].sort((a, b) => a.sequence - b.sequence);
      for (const stop of stopsSorted) {
        const cep = (stop.cep ?? '').replace(/\D/g, '');
        if (cep.length === 8) ceps.push(cep);
      }
    }
    // 2. Add secondary quote destinations as waypoints
    for (const q of secondaryQs) {
      const destCep = (q.destination_cep ?? '').replace(/\D/g, '');
      if (destCep.length === 8) ceps.push(destCep);
      // Also add route_stops from secondary quotes
      if (q.route_stops && q.route_stops.length > 0) {
        const stopsSorted = [...q.route_stops].sort((a, b) => a.sequence - b.sequence);
        for (const stop of stopsSorted) {
          const cep = (stop.cep ?? '').replace(/\D/g, '');
          if (cep.length === 8) ceps.push(cep);
        }
      }
    }
    // Deduplicate preserving order
    const seen: Record<string, boolean> = {};
    return ceps.filter((c) => {
      if (seen[c]) return false;
      seen[c] = true;
      return true;
    });
  }

  // Try WebRouter if CEPs available and flag is set
  if (useWebRouter && sharedOriginCep && mainQuote.destination_cep) {
    const waypointCeps = collectWaypointCeps(mainQuote, secondaryQuotes);

    if (waypointCeps.length > 0) {
      const result = await calculateRouteDistance(
        sharedOriginCep,
        mainQuote.destination_cep.replace(/\D/g, ''),
        waypointCeps
      );

      if (result.success) {
        const composedKm = result.km_distance;
        const deltaAbs = composedKm - (mainQuote.km_distance ?? composedKm);
        const deltaPercent =
          (mainQuote.km_distance ?? 0) > 0 ? (deltaAbs / (mainQuote.km_distance ?? 1)) * 100 : 0;
        const isFit = deltaPercent <= MAX_CORRIDOR_DELTA_PERCENT;

        const cities = secondaryQuotes.map((q) => q.destination.split(' - ')[0]).join(', ');
        const mainDest = mainQuote.destination.split(' - ')[0];

        const explanation = isFit
          ? `Parada(s) em ${cities} ${deltaPercent <= 5 ? 'estão no corredor natural' : 'são aderentes'} da rota ${mainQuote.origin.split(' - ')[0]} → ${mainDest}. Desvio de ${deltaAbs.toFixed(0)}km (${deltaPercent.toFixed(1)}%) sobre a rota principal de ${(mainQuote.km_distance ?? 0).toFixed(0)}km.`
          : `Parada(s) em ${cities} desviam ${deltaAbs.toFixed(0)}km (${deltaPercent.toFixed(1)}%) da rota principal ${mainQuote.origin.split(' - ')[0]} → ${mainDest}. Desvio acima do limite de ${MAX_CORRIDOR_DELTA_PERCENT}%.`;

        return {
          base_km_total: Math.round(baseKmTotal * 100) / 100,
          composed_km_total: Math.round(composedKm * 100) / 100,
          delta_km_abs: Math.round(deltaAbs * 100) / 100,
          delta_km_percent: Math.round(deltaPercent * 100) / 100,
          is_corridor_fit: isFit,
          model: 'webrouter_v1',
          explanation,
        };
      }
      console.warn(
        '[route-fit] WebRouter failed, falling back to stored_km:',
        'error' in result ? result.error : 'unknown'
      );
    }
  }

  // Fallback: use stored km_distance values for estimation
  if (baseKmTotal > 0 && mainQuote.km_distance && mainQuote.km_distance > 0) {
    // Heuristic: composed route ≈ longest individual route + small delta for each extra stop
    // The delta depends on whether origins match (shared origin = smaller delta)
    const originsMatch = sharedOriginCep !== null;
    let estimatedComposedKm: number;

    if (originsMatch) {
      // Shared origin: composed ≈ main route + fraction of secondary distances
      // because secondary destinations may be along the same corridor
      const secondaryKmSum = secondaryQuotes.reduce((s, q) => s + (q.km_distance ?? 0), 0);
      // Estimate: 30% of secondary km as extra (70% is shared corridor)
      estimatedComposedKm = (mainQuote.km_distance ?? 0) + secondaryKmSum * 0.3;
    } else {
      // Different origins: composed ≈ main route + 40% of secondary distances
      // More conservative than shared origin (less corridor overlap)
      const secondaryKmSum = secondaryQuotes.reduce((s, q) => s + (q.km_distance ?? 0), 0);
      estimatedComposedKm = (mainQuote.km_distance ?? 0) + secondaryKmSum * 0.4;
    }

    // Delta = how much longer the composed route is vs the main route alone
    // This represents the additional km needed to pick up secondary loads
    const deltaAbs = estimatedComposedKm - (mainQuote.km_distance ?? 0);
    const deltaPercent =
      (mainQuote.km_distance ?? 0) > 0 ? (deltaAbs / (mainQuote.km_distance ?? 1)) * 100 : 0;
    const isFit = deltaPercent <= MAX_CORRIDOR_DELTA_PERCENT;

    const cities = secondaryQuotes.map((q) => q.destination.split(' - ')[0]).join(', ');
    const mainDest = mainQuote.destination.split(' - ')[0];
    const explanation = isFit
      ? `Estimativa: parada(s) em ${cities} adicionam ~${deltaAbs.toFixed(0)}km (${deltaPercent.toFixed(1)}%) à rota ${mainQuote.origin.split(' - ')[0]} → ${mainDest} (${(mainQuote.km_distance ?? 0).toFixed(0)}km). ${originsMatch ? 'Origem compartilhada favorece consolidação.' : 'Origens distintas — verificar viabilidade com rota real.'}`
      : `Estimativa: parada(s) em ${cities} desviam ~${deltaAbs.toFixed(0)}km (${deltaPercent.toFixed(1)}%) da rota principal. ${originsMatch ? '' : 'Origens distintas.'}`;

    return {
      base_km_total: Math.round(baseKmTotal * 100) / 100,
      composed_km_total: Math.round(estimatedComposedKm * 100) / 100,
      delta_km_abs: Math.round(deltaAbs * 100) / 100,
      delta_km_percent: Math.round(deltaPercent * 100) / 100,
      is_corridor_fit: isFit,
      model: 'stored_km_v1',
      explanation,
    };
  }

  // Last resort: no km data available
  const cities = quotes.map((q) => q.destination.split(' - ')[0]).join(' → ');
  return {
    base_km_total: 0,
    composed_km_total: 0,
    delta_km_abs: 0,
    delta_km_percent: 0,
    is_corridor_fit: false,
    model: INSUFFICIENT_DATA_MODEL,
    explanation: `Sem dados de distância para avaliar rota ${cities}. Preencha CEPs e calcule km nas cotações para análise precisa.`,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function calculateScore(metrics: {
  dateProximity: number;
  routeFit: number;
  weightUtilization: number;
  kmSavingsPercent: number;
}): number {
  const safe = (n: number) => (Number.isFinite(n) ? n : 0);
  // Weights: route fit is now the dominant factor
  const raw =
    safe(metrics.routeFit) * 0.35 +
    safe(metrics.dateProximity) * 0.25 +
    safe(metrics.kmSavingsPercent) * 0.25 +
    safe(metrics.weightUtilization) * 0.15;
  return Number.isFinite(raw) ? raw : 0;
}

async function analyzeCombo(
  quotes: QuoteRow[],
  useWebRouter: boolean,
  supabase: SupabaseClient
): Promise<SuggestionRow & { _preScore: number }> {
  const warnings: string[] = [];

  let totalWeight = 0;
  let totalValueCentavos = 0;

  for (const q of quotes) {
    totalWeight += Number(q.weight) || 0;
    // value is stored as BRL decimal (e.g. 1500.50), convert to centavos
    totalValueCentavos += Math.round((Number(q.value) || 0) * 100);
  }

  if (totalWeight > MAX_TRUCK_CAPACITY_KG) {
    warnings.push(
      `Peso total ${totalWeight.toFixed(0)}kg excede capacidade de ${MAX_TRUCK_CAPACITY_KG}kg`
    );
  }

  // Date proximity — hard rule: all quotes must have date, max spread = MAX_DATE_SPREAD_DAYS
  const quotesWithDate = quotes.filter((q) => !!q.estimated_loading_date);
  const quotesWithoutDate = quotes.filter((q) => !q.estimated_loading_date);
  let dateFeasible = true;

  if (quotesWithoutDate.length > 0) {
    dateFeasible = false;
    const codes = quotesWithoutDate.map((q) => q.quote_code || q.id.slice(0, 8)).join(', ');
    warnings.push(
      `${quotesWithoutDate.length === 1 ? 'Cotação' : 'Cotações'} sem data de carregamento: ${codes}. Consolidação requer datas definidas.`
    );
  }

  const dates = quotesWithDate.map((q) =>
    new Date(q.estimated_loading_date! + 'T12:00:00').getTime()
  );
  const daySpread =
    dates.length >= 2 ? (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) : 0;

  if (daySpread > MAX_DATE_SPREAD_DAYS) {
    dateFeasible = false;
    warnings.push(
      `Datas de carregamento espaçadas em ${daySpread.toFixed(0)} dias (máximo: ${MAX_DATE_SPREAD_DAYS} dias)`
    );
  }

  const dateProximity = dateFeasible ? Math.max(0, Math.min(100, 100 - daySpread * 15)) : 0;

  // Route evaluation
  const routeEval = await evaluateRouteFit(quotes, useWebRouter);

  // Km savings: compare base (separate) vs composed
  const kmSavings =
    routeEval.base_km_total > 0
      ? ((routeEval.base_km_total - routeEval.composed_km_total) / routeEval.base_km_total) * 100
      : 0;
  const kmSavingsPercent = Math.max(0, Math.min(100, kmSavings));

  // --- ANTT-based savings: real cost difference (separated vs consolidated) ---
  let estimatedSavings = 0;
  let anttExplanation = '';

  const vehicle = await inferAxesFromWeight(supabase, totalWeight);
  const rate = await getAnttFloorRate(supabase, vehicle.axes_count);

  if (rate) {
    // Cost if each quote is shipped separately (N trucks, N × CC)
    // IMPORTANT: Only include quotes WITH valid km_distance. Quotes with km=0 or null
    // would be treated as free trips, systematically overstating savings.
    const quotesWithValidKm = quotes.filter((q) => q.km_distance != null && q.km_distance > 0);

    if (quotesWithValidKm.length === 0) {
      warnings.push('Nenhuma cotação com km_distance preenchido — economia ANTT não calculada');
    }

    const separateTrips = quotesWithValidKm.map((q) => ({ km: Number(q.km_distance)! }));
    const separated = calculateSeparateCost(separateTrips, rate);

    // Cost if consolidated (1 truck, 1 × CC, composed km)
    const consolidated = calculateConsolidatedCost(routeEval.composed_km_total, rate);

    estimatedSavings = Math.max(0, separated.total_centavos - consolidated);

    const quotesWithoutKm = quotes.length - quotesWithValidKm.length;
    if (quotesWithoutKm > 0) {
      warnings.push(
        `${quotesWithoutKm} cotação(ões) sem km_distance — excluída(s) do cálculo ANTT separado`
      );
    }

    const separadoBrl = (separated.total_centavos / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const consolidadoBrl = (consolidated / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    anttExplanation =
      ` Veículo: ${vehicle.vehicle_code} (${vehicle.axes_count} eixos). ` +
      `Custo ANTT separado: R$ ${separadoBrl} (${quotes.length} viagens). ` +
      `Custo ANTT consolidado: R$ ${consolidadoBrl} (1 viagem). ` +
      `Tabela A, Carga Geral, Res. 6.076/2026.`;
  } else {
    // Fallback: old heuristic if ANTT rates not available
    const ESTIMATED_COST_RATIO = 0.6;
    const estimatedTotalCostCentavos = Math.round(totalValueCentavos * ESTIMATED_COST_RATIO);
    const savingsRatio = kmSavingsPercent / 100;
    estimatedSavings = Math.round(estimatedTotalCostCentavos * savingsRatio);
    anttExplanation = ` Economia estimada por heurística (sem tabela ANTT).`;
    warnings.push('Tabela ANTT não disponível — economia estimada por heurística de km.');
  }

  // Route fit score (0-100)
  const routeFitScore = routeEval.is_corridor_fit
    ? Math.max(0, 100 - routeEval.delta_km_percent * 3)
    : Math.max(0, 50 - routeEval.delta_km_percent);

  const weightUtil = Math.min(100, (totalWeight / MAX_TRUCK_CAPACITY_KG) * 100);

  let score = calculateScore({
    dateProximity,
    routeFit: routeFitScore,
    weightUtilization: weightUtil,
    kmSavingsPercent,
  });
  if (!Number.isFinite(score)) score = 0;
  score = Math.min(100, Math.max(0, score));

  const isFeasible =
    totalWeight <= MAX_TRUCK_CAPACITY_KG && routeEval.is_corridor_fit && dateFeasible;

  // Build technical explanation
  let explanation = routeEval.explanation;
  if (warnings.length > 0) {
    explanation += ` Alertas: ${warnings.join('; ')}.`;
  }
  explanation +=
    ` Economia: R$ ${(estimatedSavings / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` +
    anttExplanation;

  return {
    quote_ids: quotes.map((q) => q.id).sort(), // sort for dedup
    consolidation_score: Math.round(score * 100) / 100,
    estimated_savings_brl: Number.isFinite(estimatedSavings) ? estimatedSavings : 0,
    distance_increase_percent: Math.round(routeEval.delta_km_percent * 100) / 100,
    validation_warnings: warnings,
    is_feasible: isFeasible,
    trigger_source: 'batch', // overridden by caller
    anchor_quote_id: null,
    technical_explanation: explanation,
    delta_km_abs: routeEval.delta_km_abs,
    delta_km_percent: routeEval.delta_km_percent,
    base_km_total: routeEval.base_km_total,
    composed_km_total: routeEval.composed_km_total,
    route_evaluation_model: routeEval.model,
    _preScore: score, // internal: used for sorting before WebRouter pass
  };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

async function findExistingQuoteIdSets(
  supabase: SupabaseClient,
  shipperId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from('load_composition_suggestions')
    .select('quote_ids')
    .eq('shipper_id', shipperId)
    .not('status', 'in', '("rejected","executed")');

  const existing = new Set<string>();
  if (data) {
    for (const row of data) {
      const ids = (row.quote_ids as string[]).slice().sort().join(',');
      existing.add(ids);
    }
  }
  return existing;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const body = (await req.json()) as CompositionRequest;
    const triggerSource: TriggerSource = body.trigger_source ?? 'batch';
    const dateWindowDays = body.date_window_days || DEFAULT_DATE_WINDOW_DAYS;
    const minViableScore = body.min_viable_score || MIN_VIABLE_SCORE;

    // Auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase configuration');

    const authResult = await resolveUserIdFromJwt(req, supabaseUrl, supabaseKey);
    if ('error' in authResult) return jsonResponse({ error: authResult.error }, authResult.status);
    const userId = authResult.userId;

    // Compat: if legacy caller sends user_id, log mismatch but don't block
    if (body.user_id != null && body.user_id !== userId) {
      console.warn(
        `[analyze] body.user_id (${body.user_id}) differs from JWT (${userId}) — ignoring body value`
      );
    }

    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

    // -----------------------------------------------------------------------
    // Environment / schema health check
    // -----------------------------------------------------------------------
    {
      // 1. Verify required env vars
      const webrouterKey = Deno.env.get('WEBROUTER_API_KEY');
      if (!webrouterKey) {
        console.warn(
          '[analyze] WEBROUTER_API_KEY not set — route evaluation will fall back to stored km'
        );
      }

      // 2. Verify v2 columns exist (trigger_source) via lightweight probe
      const { error: schemaProbe } = await supabase
        .from('load_composition_suggestions')
        .select('trigger_source')
        .limit(0);
      if (schemaProbe) {
        console.error('[analyze] Schema probe failed:', schemaProbe.message);
        return jsonResponse(
          {
            error:
              'Ambiente desatualizado: execute a migration 20260605000000_load_composition_v2_columns.sql antes de usar esta versão.',
            env_error: true,
            detail: schemaProbe.message,
          },
          503
        );
      }

      // 3. Verify quotes table has expected columns
      const { error: quotesProbe } = await supabase
        .from('quotes')
        .select('estimated_loading_date, origin_cep, destination_cep')
        .limit(0);
      if (quotesProbe) {
        console.error('[analyze] Quotes schema probe failed:', quotesProbe.message);
        return jsonResponse(
          {
            error:
              'Esquema de cotações desatualizado: colunas estimated_loading_date, origin_cep ou destination_cep não encontradas.',
            env_error: true,
            detail: quotesProbe.message,
          },
          503
        );
      }
    }

    // -----------------------------------------------------------------------
    // Resolve quotes based on trigger mode
    // -----------------------------------------------------------------------
    let allQuotes: QuoteRow[] = [];
    let anchorQuoteId: string | null = null;
    let shipperId: string | null = body.shipper_id ?? null;

    if (triggerSource === 'manual' && Array.isArray(body.quote_ids) && body.quote_ids.length >= 2) {
      // Manual: fetch specific quotes
      const { data, error } = await supabase
        .from('quotes')
        .select(QUOTE_SELECT)
        .in('id', body.quote_ids);
      if (error || !data || data.length < 2) {
        return jsonResponse({
          suggestions: [],
          total_found: 0,
          message: 'Cotações insuficientes ou não encontradas',
        });
      }
      allQuotes = data as QuoteRow[];
      shipperId = allQuotes[0].shipper_id;
    } else if (triggerSource === 'on_save' && body.anchor_quote_id) {
      // On-save: fetch the anchor quote + candidates from same shipper
      anchorQuoteId = body.anchor_quote_id;
      const { data: anchorData } = await supabase
        .from('quotes')
        .select(QUOTE_SELECT)
        .eq('id', anchorQuoteId)
        .single();

      if (!anchorData) {
        return jsonResponse({ suggestions: [], total_found: 0, message: 'Anchor quote not found' });
      }
      const anchor = anchorData as QuoteRow;
      shipperId = anchor.shipper_id;

      if (!shipperId) {
        return jsonResponse({
          suggestions: [],
          total_found: 0,
          message: 'Quote has no shipper_id',
        });
      }

      const candidates = await discoverCandidates(supabase, shipperId, dateWindowDays, [
        anchorQuoteId,
      ]);
      // Build combos: anchor paired with each candidate (and triples)
      allQuotes = [anchor, ...candidates];
    } else {
      // Batch: discover all candidates for the shipper
      if (!shipperId) {
        return jsonResponse({ error: 'Missing shipper_id' }, 400);
      }
      allQuotes = await discoverCandidates(supabase, shipperId, dateWindowDays);
    }

    if (!shipperId) {
      return jsonResponse({ error: 'Could not determine shipper_id' }, 400);
    }

    if (allQuotes.length < 2) {
      return jsonResponse({
        suggestions: [],
        total_found: 0,
        message: 'Cotações insuficientes para consolidação (mínimo 2)',
      });
    }

    const quotesTotalInWindow = allQuotes.length;
    let quotesForAnalysis = allQuotes.slice(0, MAX_QUOTES_FOR_COMBINATORICS);
    const truncated = quotesTotalInWindow > MAX_QUOTES_FOR_COMBINATORICS;

    // Phase 2: Enrich km_distance from WebRouter if missing
    console.log(`[phase-2] Enriching km_distance for quotes without it...`);
    const enrichmentResult = await enrichQuoteKmData(supabase, quotesForAnalysis, false);
    quotesForAnalysis = enrichmentResult.enriched;

    if (enrichmentResult.updated > 0) {
      console.log(`[phase-2] ✓ Updated ${enrichmentResult.updated} quotes with km_distance`);
    }

    if (enrichmentResult.errors.length > 0) {
      console.warn(`[phase-2] Enrichment errors:`, enrichmentResult.errors);
    }

    console.log(
      `[analyze] ${triggerSource} — ${quotesForAnalysis.length}/${quotesTotalInWindow} quotes analyzed`
    );

    // -----------------------------------------------------------------------
    // Generate combinations
    // -----------------------------------------------------------------------
    let combinations: QuoteRow[][];

    if (triggerSource === 'on_save' && anchorQuoteId) {
      // On-save: only combos that include the anchor quote
      const anchor = quotesForAnalysis.find((q) => q.id === anchorQuoteId)!;
      const others = quotesForAnalysis.filter((q) => q.id !== anchorQuoteId);
      combinations = [];
      for (const other of others) {
        combinations.push([anchor, other]);
      }
      // Triples with anchor
      if (others.length >= 2) {
        for (let i = 0; i < others.length; i++) {
          for (let j = i + 1; j < others.length; j++) {
            combinations.push([anchor, others[i], others[j]]);
          }
        }
      }
    } else if (triggerSource === 'manual') {
      // Manual: single combination of all provided quotes
      combinations = [quotesForAnalysis];
    } else {
      combinations = generatePairTripleCombinations(quotesForAnalysis);
    }

    if (combinations.length > MAX_COMBINATION_EVALUATIONS) {
      combinations = combinations.slice(0, MAX_COMBINATION_EVALUATIONS);
    }

    console.log(`[analyze] Evaluating ${combinations.length} combinations`);

    // -----------------------------------------------------------------------
    // Phase 1: Quick evaluation (no WebRouter) for all combos
    // -----------------------------------------------------------------------
    const allResults: (SuggestionRow & { _preScore: number })[] = [];

    for (const combo of combinations) {
      try {
        // Phase 1: Data Quality Gate
        const qualityCheck = checkDataQuality(combo);

        if (!shouldProceedWithAnalysis(qualityCheck)) {
          const reason = getQualityGateReason(qualityCheck);
          console.log(`[phase-1] Combo rejected (quality=${qualityCheck.totalScore}%): ${reason}`);
          continue;
        }

        const result = await analyzeCombo(combo, false, supabase);
        result.trigger_source = triggerSource;
        result.anchor_quote_id = anchorQuoteId;

        // Phase 3: Filter out insufficient_data / mock_v1 results
        if (shouldSkipResult(result.route_evaluation_model)) {
          console.warn(
            `[phase-3] Rejecting ${result.route_evaluation_model} result for combo: ${combo.map((q) => q.id).join(',')}`
          );
          continue;
        }

        if (
          result.consolidation_score >= minViableScore * 0.7 && // looser threshold for phase 1
          result.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS * 0.5
        ) {
          allResults.push(result);
        }
      } catch (e) {
        console.error('[analyze] Combo error:', e);
      }
    }

    // Sort by pre-score descending
    allResults.sort((a, b) => b._preScore - a._preScore);

    // -----------------------------------------------------------------------
    // Phase 2: WebRouter evaluation for top N candidates
    // -----------------------------------------------------------------------
    const topCandidates = allResults.slice(0, MAX_WEBROUTER_EVALUATIONS);
    const refinedResults: SuggestionRow[] = [];

    for (const candidate of topCandidates) {
      // Re-evaluate with WebRouter
      const quoteIds = candidate.quote_ids;
      const quotes = quoteIds
        .map((id) => quotesForAnalysis.find((q) => q.id === id)!)
        .filter(Boolean);

      if (quotes.length < 2) continue;

      try {
        const refined = await analyzeCombo(quotes, true, supabase);
        refined.trigger_source = triggerSource;
        refined.anchor_quote_id = anchorQuoteId;

        // Phase 3: Filter insufficient_data results
        if (shouldSkipResult(refined.route_evaluation_model)) {
          console.warn(
            `[phase-3] Skipping ${refined.route_evaluation_model} result in WebRouter pass`
          );
          continue;
        }

        if (
          refined.consolidation_score >= minViableScore &&
          refined.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _preScore, ...row } = refined;
          refinedResults.push(row);
        }
      } catch (e) {
        console.error('[analyze] WebRouter refinement error:', e);
        // Keep the pre-scored version if it passes thresholds, but skip bad models
        if (
          !shouldSkipResult(candidate.route_evaluation_model) &&
          candidate.consolidation_score >= minViableScore &&
          candidate.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _preScore, ...row } = candidate;
          refinedResults.push(row);
        }
      }
    }

    // Also keep non-top candidates that passed final thresholds (phase 1 only)
    for (const candidate of allResults.slice(MAX_WEBROUTER_EVALUATIONS)) {
      // Phase 3: Skip insufficient_data/mock results
      if (shouldSkipResult(candidate.route_evaluation_model)) {
        continue;
      }

      if (
        candidate.consolidation_score >= minViableScore &&
        candidate.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _preScore, ...row } = candidate;
        refinedResults.push(row);
      }
    }

    refinedResults.sort((a, b) => b.consolidation_score - a.consolidation_score);

    // -----------------------------------------------------------------------
    // Deduplication: skip suggestions that already exist
    // -----------------------------------------------------------------------
    const existingKeys = await findExistingQuoteIdSets(supabase, shipperId);
    const newSuggestions = refinedResults.filter((s) => {
      const key = s.quote_ids.join(',');
      return !existingKeys.has(key);
    });

    console.log(
      `[analyze] ${refinedResults.length} passed thresholds, ${refinedResults.length - newSuggestions.length} duplicates skipped, ${newSuggestions.length} new`
    );

    // -----------------------------------------------------------------------
    // Persist
    // -----------------------------------------------------------------------
    if (newSuggestions.length > 0) {
      const rows = newSuggestions.map((s) => ({
        shipper_id: shipperId,
        quote_ids: s.quote_ids,
        consolidation_score: s.consolidation_score,
        estimated_savings_brl: s.estimated_savings_brl,
        distance_increase_percent: s.distance_increase_percent,
        validation_warnings: s.validation_warnings,
        is_feasible: s.is_feasible,
        trigger_source: s.trigger_source,
        anchor_quote_id: s.anchor_quote_id,
        technical_explanation: s.technical_explanation,
        delta_km_abs: s.delta_km_abs,
        delta_km_percent: s.delta_km_percent,
        base_km_total: s.base_km_total,
        composed_km_total: s.composed_km_total,
        route_evaluation_model: s.route_evaluation_model,
        created_by: userId,
        status: 'pending',
      }));

      const { error: insertError } = await supabase
        .from('load_composition_suggestions')
        .insert(rows);

      if (insertError) {
        console.error('[analyze] Insert error:', insertError);
        // Dedup index conflict — concurrent request may have inserted first
        if (insertError.code === '23505') {
          // Duplicate key conflict expected with concurrent requests
        } else {
          return jsonResponse(
            {
              error: 'Falha ao persistir sugestões no banco de dados',
              details: insertError.message,
              code: insertError.code,
              hint: insertError.hint ?? undefined,
              persist_failed: true,
              computed_suggestion_count: newSuggestions.length,
            },
            500
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    const warnings: string[] = [];
    if (truncated) {
      warnings.push(
        `Apenas as ${MAX_QUOTES_FOR_COMBINATORICS} primeiras cotações (por data) foram analisadas; ${quotesTotalInWindow} no total.`
      );
    }

    return jsonResponse({
      suggestions: newSuggestions.slice(0, 5),
      total_found: newSuggestions.length,
      timestamp: new Date().toISOString(),
      analysis_model_version: 'v2_route_fit',
      trigger_source: triggerSource,
      quotes_analyzed: quotesForAnalysis.length,
      quotes_total_in_window: quotesTotalInWindow,
      combinations_evaluated: combinations.length,
      warnings,
    });
  } catch (error) {
    console.error('[analyze-load-composition] Error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
