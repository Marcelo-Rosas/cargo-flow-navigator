/**
 * Edge Function: analyze-load-composition
 * Analyzes pending quotes and suggests consolidation opportunities
 *
 * Input:
 *   - shipper_id: UUID of the shipper
 *   - date_window_days: number (default: 14) — max days between pickups
 *
 * Output:
 *   - suggestions: array of composition suggestions with scores and savings
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface CompositionRequest {
  shipper_id: string;
  user_id?: string; // UUID of requesting user (for created_by audit)
  date_window_days?: number;
  min_viable_score?: number;
}

interface Quote {
  id: string;
  shipper_id: string;
  origin: string;
  destination: string;
  pickup_address: string;
  destination_address: string;
  weight_kg: number;
  volume_m3?: number;
  pickup_date: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
  estimated_cost: number; // in centavos
  status: string;
}

interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  weight_kg?: number;
}

interface ConsolidationSuggestion {
  quote_ids: string[];
  consolidation_score: number;
  estimated_savings_brl: number;
  distance_increase_percent: number;
  validation_warnings: string[];
  is_feasible: boolean;
}

// Constants
const MIN_VIABLE_SCORE = 60;
const MIN_SAVINGS_BRL = 50000; // R$ 500
const DEFAULT_DATE_WINDOW_DAYS = 14;
const MAX_TRUCK_CAPACITY_KG = 30000;
const MAX_DEVIATION_PERCENT = 15;

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const body = (await req.json()) as CompositionRequest;
    const shipperId = body.shipper_id;
    const userId = body.user_id; // From client for created_by audit
    const dateWindowDays = body.date_window_days || DEFAULT_DATE_WINDOW_DAYS;
    const minViableScore = body.min_viable_score || MIN_VIABLE_SCORE;

    if (!shipperId) {
      return new Response(JSON.stringify({ error: 'Missing shipper_id' }), { status: 400 });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing user_id (required for audit)' }), {
        status: 400,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch quotes in pipeline for this shipper (stage: precificacao, enviado, negociacao)
    const { data: quotes, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('shipper_id', shipperId)
      .in('stage', ['precificacao', 'enviado', 'negociacao'])
      .gte('pickup_date', new Date().toISOString().split('T')[0])
      .lte(
        'pickup_date',
        new Date(Date.now() + dateWindowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );

    if (quoteError || !quotes || quotes.length < 2) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          message: 'Insufficient quotes for consolidation (minimum 2 required)',
        }),
        { status: 200 }
      );
    }

    console.log(`[analyze-load-composition] Found ${quotes.length} quotes for consolidation`);

    // 2. Generate all viable combinations (2+)
    const combinations = generateCombinations(quotes as Quote[], 2);
    console.log(`[analyze-load-composition] Generated ${combinations.length} combinations`);

    // 3. Analyze each combination
    const suggestions: ConsolidationSuggestion[] = [];

    for (const combo of combinations) {
      try {
        const suggestion = await analyzeCombo(combo);

        // Filter by score and savings thresholds
        if (
          suggestion.consolidation_score >= minViableScore &&
          suggestion.estimated_savings_brl >= MIN_SAVINGS_BRL
        ) {
          suggestions.push(suggestion);
        }
      } catch (e) {
        console.error(`[analyze-load-composition] Error analyzing combo:`, e);
        // Continue with next combination
      }
    }

    // 4. Sort by score descending
    suggestions.sort((a, b) => b.consolidation_score - a.consolidation_score);

    // 5. Save suggestions to DB
    for (const sugg of suggestions) {
      const { error: insertError } = await supabase.from('load_composition_suggestions').insert({
        shipper_id: shipperId,
        quote_ids: sugg.quote_ids,
        consolidation_score: sugg.consolidation_score,
        estimated_savings_brl: sugg.estimated_savings_brl,
        distance_increase_percent: sugg.distance_increase_percent,
        validation_warnings: sugg.validation_warnings,
        is_feasible: sugg.is_feasible,
        created_by: userId,
        status: 'pending',
      });

      if (insertError) {
        console.error(`[analyze-load-composition] Error saving suggestion:`, insertError);
      }
    }

    console.log(
      `[analyze-load-composition] Saved ${suggestions.length} suggestions for ${shipperId}`
    );

    return new Response(
      JSON.stringify({
        suggestions: suggestions.slice(0, 5), // Return top 5
        total_found: suggestions.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[analyze-load-composition] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Generate all combinations of N quotes (C(n, 2), C(n, 3), etc.)
 */
function generateCombinations(quotes: Quote[], minSize: number): Quote[][] {
  const combinations: Quote[][] = [];

  // Generate 2-quote combinations (most common)
  for (let i = 0; i < quotes.length; i++) {
    for (let j = i + 1; j < quotes.length; j++) {
      combinations.push([quotes[i], quotes[j]]);
    }
  }

  // Generate 3-quote combinations if we have enough
  if (quotes.length >= 3) {
    for (let i = 0; i < quotes.length; i++) {
      for (let j = i + 1; j < quotes.length; j++) {
        for (let k = j + 1; k < quotes.length; k++) {
          combinations.push([quotes[i], quotes[j], quotes[k]]);
        }
      }
    }
  }

  return combinations;
}

/**
 * Analyze a single combination
 */
async function analyzeCombo(quotes: Quote[]): Promise<ConsolidationSuggestion> {
  const warnings: string[] = [];

  // 1. Basic validations
  let totalWeight = 0;
  let totalOriginalCost = 0;

  for (const q of quotes) {
    totalWeight += q.weight_kg;
    totalOriginalCost += q.estimated_cost;
  }

  // Check weight
  if (totalWeight > MAX_TRUCK_CAPACITY_KG) {
    warnings.push(`Total weight ${totalWeight}kg exceeds truck capacity`);
  }

  // Check date proximity (warning if too spread out)
  const dates = quotes.map((q) => new Date(q.pickup_date).getTime());
  const daySpread = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
  if (daySpread > 7) {
    warnings.push(`Pickup dates spread across ${daySpread.toFixed(0)} days (>7 is suboptimal)`);
  }

  // 2. Calculate consolidation metrics
  // Estimated consolidated cost: 70% of individual costs (rough estimate)
  const estimatedConsolidatedCost = totalOriginalCost * 0.7;
  const estimatedSavings = totalOriginalCost - estimatedConsolidatedCost;

  // 3. Distance efficiency (mock calculation)
  // In production, use Google Maps Distance Matrix API
  const estimatedExtraDistance = totalWeight > 5000 ? 8 : 5; // % extra km for consolidation
  const distanceEfficiency = Math.max(0, 100 - estimatedExtraDistance);

  // 4. Calculate composite score
  const score = calculateScore({
    dateProximity: 100 - daySpread * 5, // decrease by 5 per day
    costSavings: (estimatedSavings / totalOriginalCost) * 100,
    routeEfficiency: distanceEfficiency,
    weightUtilization: (totalWeight / MAX_TRUCK_CAPACITY_KG) * 100,
  });

  // 5. Validate feasibility
  const isFeasible =
    totalWeight <= MAX_TRUCK_CAPACITY_KG && estimatedExtraDistance <= MAX_DEVIATION_PERCENT;

  return {
    quote_ids: quotes.map((q) => q.id),
    consolidation_score: Math.min(100, Math.max(0, score)),
    estimated_savings_brl: Math.round(estimatedSavings),
    distance_increase_percent: estimatedExtraDistance,
    validation_warnings: warnings,
    is_feasible: isFeasible,
  };
}

/**
 * Calculate composite viability score (0-100)
 */
function calculateScore(metrics: {
  dateProximity: number;
  costSavings: number;
  routeEfficiency: number;
  weightUtilization: number;
}): number {
  // Weighted scoring
  return (
    metrics.dateProximity * 0.4 +
    metrics.costSavings * 0.3 +
    metrics.routeEfficiency * 0.2 +
    metrics.weightUtilization * 0.1
  );
}
