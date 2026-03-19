/**
 * Edge Function: generate-optimal-route
 * Calculates optimal route for a set of quotes using TSP solver
 *
 * Input:
 *   - quote_ids: UUID[] — quotes to route
 *   - composition_id: UUID (optional) — if creating/updating suggestion
 *   - use_google_maps: boolean (default: false) — use real distances vs haversine
 *
 * Output:
 *   - routings: array of legs with distance, duration, polyline, arrival times
 *   - total_distance_km: number
 *   - total_duration_min: number
 *   - waypoints: ordered list of pickup locations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface GenerateRouteRequest {
  quote_ids: string[];
  composition_id?: string;
  use_google_maps?: boolean;
  save_to_db?: boolean;
}

interface Quote {
  id: string;
  pickup_address: string;
  destination_address: string;
  pickup_date: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
  weight_kg: number;
  origin: string;
  destination: string;
}

interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  weight_kg?: number;
  address?: string;
}

interface RouteLeg {
  from_location: Location;
  to_location: Location;
  distance_km: number;
  duration_min: number;
  polyline: string;
  sequence_number: number;
  quote_id?: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
  estimated_arrival?: string;
}

// Mock warehouse coordinates (São Bernardo do Campo)
const WAREHOUSE_ORIGIN = {
  id: 'warehouse_origin',
  name: 'Warehouse (Origin)',
  latitude: -23.6955,
  longitude: -46.5639,
};

const WAREHOUSE_DESTINATION = {
  id: 'warehouse_dest',
  name: 'Warehouse (Destination)',
  latitude: -23.6955,
  longitude: -46.5639,
};

const EARTH_RADIUS_KM = 6371;

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const body = (await req.json()) as GenerateRouteRequest;
    const { quote_ids, composition_id, use_google_maps = false, save_to_db = true } = body;

    if (!quote_ids || quote_ids.length < 2) {
      return new Response(JSON.stringify({ error: 'At least 2 quote_ids required' }), {
        status: 400,
      });
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch quotes
    const { data: quotes, error: quoteError } = await supabase
      .from('quotes')
      .select(
        'id, pickup_address, destination_address, pickup_date, pickup_window_start, pickup_window_end, weight_kg, origin, destination'
      )
      .in('id', quote_ids);

    if (quoteError || !quotes) {
      throw new Error(`Failed to fetch quotes: ${quoteError?.message}`);
    }

    console.log(`[generate-optimal-route] Fetched ${quotes.length} quotes`);

    // 2. Convert to locations
    const locations = buildLocations(quotes as Quote[]);

    // 3. Solve TSP
    const solution = solveTSP(locations);

    // 4. Build route legs with arrival times
    const legs = buildRoutingLegs(solution, quotes as Quote[]);

    // 5. Save to DB if composition_id provided
    if (composition_id && save_to_db) {
      await saveRoutingsToDB(supabase, composition_id, legs);
    }

    console.log(
      `[generate-optimal-route] Generated route: ${solution.totalDistance.toFixed(1)}km, ${solution.totalDuration}min`
    );

    return new Response(
      JSON.stringify({
        success: true,
        route: {
          legs,
          total_distance_km: solution.totalDistance,
          total_duration_min: solution.totalDuration,
          waypoints: solution.path.map((idx) => locations[idx]),
          composition_id: composition_id || null,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[generate-optimal-route] Error:', error);
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
 * Convert quotes to locations with coordinates
 */
function buildLocations(quotes: Quote[]): Location[] {
  const locations: Location[] = [WAREHOUSE_ORIGIN];

  for (const quote of quotes) {
    const coords = approximateCoordinates(quote.pickup_address);
    locations.push({
      id: quote.id,
      name: `${quote.origin} - Coleta`,
      latitude: coords.latitude,
      longitude: coords.longitude,
      weight_kg: quote.weight_kg,
      address: quote.pickup_address,
    });
  }

  locations.push(WAREHOUSE_DESTINATION);
  return locations;
}

/**
 * Approximate coordinates from address (mock)
 * In production: use Google Geocoding API
 */
function approximateCoordinates(address: string): { latitude: number; longitude: number } {
  const mockCoordinates: Record<string, { latitude: number; longitude: number }> = {
    barueri: { latitude: -23.5059, longitude: -46.8681 },
    'são bernardo': { latitude: -23.6955, longitude: -46.5639 },
    itapevi: { latitude: -23.5947, longitude: -46.95 },
    diadema: { latitude: -23.6733, longitude: -46.6179 },
    'santo andré': { latitude: -23.6637, longitude: -46.5277 },
    guarulhos: { latitude: -23.4569, longitude: -46.4346 },
    osasco: { latitude: -23.5308, longitude: -46.7937 },
  };

  const normalized = address.toLowerCase();
  for (const [key, coords] of Object.entries(mockCoordinates)) {
    if (normalized.includes(key)) {
      return coords;
    }
  }

  return { latitude: -23.6955, longitude: -46.5639 }; // Default
}

/**
 * Simple TSP solver using Nearest Neighbor + 2-opt
 */
function solveTSP(locations: Location[]): {
  path: number[];
  totalDistance: number;
  totalDuration: number;
} {
  const n = locations.length;
  const distances = buildDistanceMatrix(locations);

  // Nearest neighbor
  const visited = Array(n).fill(false);
  let path: number[] = [0]; // Start at warehouse
  visited[0] = true;
  let totalDistance = 0;
  let current = 0;

  for (let i = 1; i < n - 1; i++) {
    let nearest = -1;
    let minDist = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited[j] && distances[current][j] < minDist) {
        minDist = distances[current][j];
        nearest = j;
      }
    }

    if (nearest === -1) break;
    path.push(nearest);
    visited[nearest] = true;
    totalDistance += minDist;
    current = nearest;
  }

  // Add end warehouse
  path.push(n - 1);
  totalDistance += distances[current][n - 1];

  // 2-opt optimization (simplified)
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 50) {
    improved = false;
    iterations++;

    for (let i = 1; i < path.length - 2; i++) {
      for (let j = i + 1; j < path.length - 1; j++) {
        const a = path[i - 1];
        const b = path[i];
        const c = path[j];
        const d = path[j + 1];

        const currentDist = distances[a][b] + distances[c][d];
        const newDist = distances[a][c] + distances[b][d];

        if (newDist < currentDist) {
          path = [...path.slice(0, i), ...path.slice(i, j + 1).reverse(), ...path.slice(j + 1)];
          totalDistance = totalDistance - currentDist + newDist;
          improved = true;
        }
      }
    }
  }

  const totalDuration = Math.round((totalDistance / 60) * 60); // avg 60 km/h

  return { path, totalDistance, totalDuration };
}

/**
 * Build distance matrix using haversine
 */
function buildDistanceMatrix(locations: Location[]): number[][] {
  const n = locations.length;
  const distances = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distances[i][j] = 0;
      } else {
        distances[i][j] = haversineDistance(
          locations[i].latitude,
          locations[i].longitude,
          locations[j].latitude,
          locations[j].longitude
        );
      }
    }
  }

  return distances;
}

/**
 * Haversine distance in km
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Build routing legs from solution
 */
function buildRoutingLegs(
  solution: { path: number[]; totalDistance: number; totalDuration: number },
  quotes: Quote[]
): RouteLeg[] {
  const legs: RouteLeg[] = [];
  const locations = buildLocations(quotes);

  for (let i = 0; i < solution.path.length - 1; i++) {
    const fromIdx = solution.path[i];
    const toIdx = solution.path[i + 1];
    const from = locations[fromIdx];
    const to = locations[toIdx];

    const distKm = haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    const durationMin = Math.round((distKm / 60) * 60);

    // Find quote if it's a pickup
    let quoteId: string | undefined;
    let pickupWindow: { start?: string; end?: string } = {};

    if (toIdx > 0 && toIdx < quotes.length + 1) {
      quoteId = quotes[toIdx - 1]?.id;
      pickupWindow.start = quotes[toIdx - 1]?.pickup_window_start;
      pickupWindow.end = quotes[toIdx - 1]?.pickup_window_end;
    }

    legs.push({
      from_location: from,
      to_location: to,
      distance_km: parseFloat(distKm.toFixed(1)),
      duration_min: durationMin,
      polyline: encodeSimplePolyline(from.latitude, from.longitude, to.latitude, to.longitude),
      sequence_number: i + 1,
      quote_id: quoteId,
      pickup_window_start: pickupWindow.start,
      pickup_window_end: pickupWindow.end,
      estimated_arrival: calculateArrivalTime(i, legs, durationMin),
    });
  }

  return legs;
}

/**
 * Encode polyline (simplified)
 */
function encodeSimplePolyline(lat1: number, lon1: number, lat2: number, lon2: number): string {
  return `[(${lat1.toFixed(4)},${lon1.toFixed(4)}),(${lat2.toFixed(4)},${lon2.toFixed(4)})]`;
}

/**
 * Calculate estimated arrival time
 */
function calculateArrivalTime(
  legIndex: number,
  previousLegs: RouteLeg[],
  currentDuration: number
): string {
  const startHour = 9; // Start at 9 AM
  let totalMinutes = currentDuration;

  for (const leg of previousLegs) {
    totalMinutes += leg.duration_min;
  }

  const hours = startHour + Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Save routings to DB (replaces existing legs for this composition)
 */
async function saveRoutingsToDB(
  supabase: ReturnType<typeof createClient>,
  compositionId: string,
  legs: RouteLeg[]
): Promise<void> {
  // Delete existing routings for this composition before inserting
  const { error: deleteError } = await supabase
    .from('load_composition_routings')
    .delete()
    .eq('composition_id', compositionId);

  if (deleteError) {
    throw new Error(`Failed to clear existing routings: ${deleteError.message}`);
  }

  // Filter to legs with quote_id for schema compliance (depot legs may have null)
  const legsToInsert = legs.filter((leg) => leg.quote_id != null);
  if (legsToInsert.length === 0) {
    return;
  }

  const routingData = legsToInsert.map((leg) => ({
    composition_id: compositionId,
    route_sequence: leg.sequence_number,
    quote_id: leg.quote_id!,
    leg_distance_km: leg.distance_km,
    leg_duration_min: leg.duration_min,
    leg_polyline: leg.polyline,
    pickup_window_start: leg.pickup_window_start,
    pickup_window_end: leg.pickup_window_end,
    estimated_arrival: leg.estimated_arrival,
    is_feasible: true,
  }));

  const { error } = await supabase.from('load_composition_routings').insert(routingData);

  if (error) {
    throw new Error(`Failed to save routings: ${error.message}`);
  }
}
