/**
 * Edge Function: generate-optimal-route (v2)
 *
 * Generates route for a load composition using WebRouter (real distances + polyline).
 * Replaces the v1 mock TSP with real CEP-based routing.
 *
 * Input:
 *   - quote_ids: UUID[] — quotes to route (min 2)
 *   - composition_id: UUID (optional) — saves routings to DB
 *   - save_to_db: boolean (default: true)
 *
 * Output:
 *   - route.legs: RouteLeg[] with real km, duration, toll, polyline
 *   - route.total_distance_km, total_duration_min, total_toll_centavos
 *   - route.polyline_coords: full route coordinates for map rendering
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  calculateRouteDistanceFull,
  calculateRouteDistance,
  type RouteDistanceFullResult,
  type TollPlaza,
} from '../_shared/webrouter-client.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateRouteRequest {
  quote_ids: string[];
  composition_id?: string;
  save_to_db?: boolean;
}

interface QuoteRow {
  id: string;
  origin: string;
  destination: string;
  origin_cep: string | null;
  destination_cep: string | null;
  weight: number | null;
  km_distance: number | null;
  quote_code: string | null;
  client_name: string;
  estimated_loading_date: string | null;
}

interface RouteLeg {
  from_label: string;
  to_label: string;
  distance_km: number;
  duration_min: number;
  quote_id: string | null;
  sequence_number: number;
  toll_centavos: number;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const body = (await req.json()) as GenerateRouteRequest;
    const { quote_ids, composition_id, save_to_db = true } = body;

    if (!quote_ids || quote_ids.length < 2) {
      return jsonResponse({ error: 'At least 2 quote_ids required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase configuration');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch quotes with real columns
    const { data: quotes, error: quoteError } = await supabase
      .from('quotes')
      .select(
        'id, origin, destination, origin_cep, destination_cep, weight, km_distance, quote_code, client_name, estimated_loading_date'
      )
      .in('id', quote_ids);

    if (quoteError || !quotes || quotes.length < 2) {
      return jsonResponse(
        {
          error: `Failed to fetch quotes: ${quoteError?.message ?? 'not enough quotes found'}`,
        },
        400
      );
    }

    const typedQuotes = quotes as QuoteRow[];
    console.log(`[generate-optimal-route] Fetched ${typedQuotes.length} quotes`);

    // 2. Sort by km_distance desc — longest route = main, others = waypoints
    const sorted = [...typedQuotes].sort(
      (a, b) => (Number(b.km_distance) || 0) - (Number(a.km_distance) || 0)
    );
    const mainQuote = sorted[0];
    const secondaryQuotes = sorted.slice(1);

    // Check CEPs
    const originCep = (mainQuote.origin_cep ?? '').replace(/\D/g, '');
    const destCep = (mainQuote.destination_cep ?? '').replace(/\D/g, '');

    if (originCep.length !== 8 || destCep.length !== 8) {
      return jsonResponse(
        {
          error: 'Cotação principal sem CEPs válidos de origem/destino',
          route: buildFallbackRoute(typedQuotes),
        },
        200
      );
    }

    // 3. Build waypoints from secondary quote destinations
    const waypointCeps: string[] = [];
    for (const q of secondaryQuotes) {
      const cep = (q.destination_cep ?? '').replace(/\D/g, '');
      if (cep.length === 8) waypointCeps.push(cep);
    }

    // 4. Call WebRouter Full
    const routeResult = await calculateRouteDistanceFull(originCep, destCep, waypointCeps);

    let legs: RouteLeg[];
    let totalDistanceKm: number;
    let totalDurationMin: number;
    let totalTollCentavos: number;
    let tollPlazas: TollPlaza[] = [];
    let polylineCoords: [number, number][] = [];

    if (routeResult.success) {
      const fullResult = routeResult as RouteDistanceFullResult;
      totalDistanceKm = fullResult.km_distance;
      totalDurationMin = Math.round((totalDistanceKm / 60) * 60); // 60 km/h avg
      totalTollCentavos = fullResult.toll_total_centavos;
      tollPlazas = fullResult.toll_plazas;
      polylineCoords = fullResult.polyline_coords;

      // Build legs: origin → each waypoint → destination
      legs = buildLegsFromRoute(mainQuote, secondaryQuotes, totalDistanceKm, totalTollCentavos);

      console.log(
        `[generate-optimal-route] WebRouter OK: ${totalDistanceKm}km, toll: ${totalTollCentavos}, coords: ${polylineCoords.length}`
      );
    } else {
      // Fallback: use stored km_distance
      console.warn(
        `[generate-optimal-route] WebRouter failed: ${'error' in routeResult ? routeResult.error : 'unknown'}, using fallback`
      );
      const fallback = buildFallbackRoute(typedQuotes);
      legs = fallback.legs;
      totalDistanceKm = fallback.total_distance_km;
      totalDurationMin = fallback.total_duration_min;
      totalTollCentavos = 0;
    }

    // 5. Save to DB if composition_id provided
    if (composition_id && save_to_db) {
      await saveRoutingsToDB(supabase, composition_id, legs);
    }

    return jsonResponse({
      success: true,
      route: {
        legs,
        total_distance_km: totalDistanceKm,
        total_duration_min: totalDurationMin,
        total_toll_centavos: totalTollCentavos,
        toll_plazas: tollPlazas,
        polyline_coords: polylineCoords,
        composition_id: composition_id || null,
        route_source: routeResult.success ? 'webrouter' : 'fallback_km',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[generate-optimal-route] Error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildLegsFromRoute(
  mainQuote: QuoteRow,
  secondaryQuotes: QuoteRow[],
  totalKm: number,
  totalTollCentavos: number
): RouteLeg[] {
  const legs: RouteLeg[] = [];
  const allStops = [
    { label: mainQuote.origin.split(',')[0], quoteId: null as string | null, km: 0 },
    ...secondaryQuotes.map((q) => ({
      label: q.destination.split(',')[0],
      quoteId: q.id,
      km: Number(q.km_distance) || 0,
    })),
    {
      label: mainQuote.destination.split(',')[0],
      quoteId: mainQuote.id,
      km: Number(mainQuote.km_distance) || 0,
    },
  ];

  // Distribute km proportionally
  const totalStoredKm = allStops.reduce((s, st) => s + st.km, 0) || totalKm;
  const tollPerKm = totalStoredKm > 0 ? totalTollCentavos / totalStoredKm : 0;

  for (let i = 0; i < allStops.length - 1; i++) {
    const from = allStops[i];
    const to = allStops[i + 1];
    // Estimate leg km proportionally
    const legKm =
      totalStoredKm > 0 ? (to.km / totalStoredKm) * totalKm : totalKm / (allStops.length - 1);

    legs.push({
      from_label: from.label,
      to_label: to.label,
      distance_km: Math.round(legKm * 10) / 10,
      duration_min: Math.round((legKm / 60) * 60),
      quote_id: to.quoteId,
      sequence_number: i + 1,
      toll_centavos: Math.round(legKm * tollPerKm),
    });
  }

  return legs;
}

function buildFallbackRoute(quotes: QuoteRow[]) {
  const sorted = [...quotes].sort(
    (a, b) => (Number(b.km_distance) || 0) - (Number(a.km_distance) || 0)
  );
  const mainQuote = sorted[0];
  const secondaryQuotes = sorted.slice(1);

  const totalKm = sorted.reduce((s, q) => s + (Number(q.km_distance) || 0), 0);
  const legs = buildLegsFromRoute(mainQuote, secondaryQuotes, totalKm, 0);

  return {
    legs,
    total_distance_km: totalKm,
    total_duration_min: Math.round((totalKm / 60) * 60),
    total_toll_centavos: 0,
  };
}

async function saveRoutingsToDB(
  supabase: ReturnType<typeof createClient>,
  compositionId: string,
  legs: RouteLeg[]
): Promise<void> {
  // Clear existing
  await supabase.from('load_composition_routings').delete().eq('composition_id', compositionId);

  const legsWithQuote = legs.filter((l) => l.quote_id != null);
  if (legsWithQuote.length === 0) return;

  const rows = legsWithQuote.map((leg) => ({
    composition_id: compositionId,
    route_sequence: leg.sequence_number,
    quote_id: leg.quote_id!,
    leg_distance_km: leg.distance_km,
    leg_duration_min: leg.duration_min,
    leg_polyline: '', // polyline stored at route level, not per leg
    is_feasible: true,
  }));

  const { error } = await supabase.from('load_composition_routings').insert(rows);
  if (error) {
    console.error('[generate-optimal-route] DB insert error:', error.message);
  }
}
