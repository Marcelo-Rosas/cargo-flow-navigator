/**
 * Shared WebRouter client — callable from any Edge Function.
 * Calculates route distance (km) for origin → waypoints → destination
 * using the WebRouter API (same provider as calculate-distance-webrouter).
 *
 * Returns only km_distance (no tolls/km_by_uf) to keep it lightweight
 * for composition analysis where we just need delta-km comparison.
 */

const WEBROUTER_URL = 'https://way.webrouter.com.br/RouterService/router/api/calcular';
const UA = 'vectra-cargo-flow/1.0 (webrouter; contact: support@vectracargo.com.br)';

function getEnv(key: string): string | undefined {
  try {
    if (
      typeof (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno
        ?.env?.get === 'function'
    ) {
      return (
        globalThis as { Deno: { env: { get: (k: string) => string | undefined } } }
      ).Deno.env.get(key);
    }
  } catch {
    // ignore
  }
  return undefined;
}

function sanitizeCep(v: string): string {
  return (v || '').toString().replace(/\D/g, '').slice(0, 8);
}

async function fetchCityUf(cep: string): Promise<{ cidade: string; uf: string } | null> {
  const sources = [
    {
      url: `https://viacep.com.br/ws/${cep}/json/`,
      get: (j: { erro?: unknown; localidade?: string; uf?: string }) =>
        !j.erro && j.localidade && j.uf ? { cidade: j.localidade, uf: j.uf } : null,
    },
    {
      url: `https://brasilapi.com.br/api/cep/v2/${cep}`,
      get: (j: { city?: string; state?: string }) =>
        j.city && j.state ? { cidade: j.city, uf: j.state } : null,
    },
  ];
  for (const s of sources) {
    try {
      const res = await fetch(s.url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (res.ok) {
        const j = await res.json();
        const addr = s.get(j);
        if (addr) return addr;
      }
    } catch {
      // continue
    }
  }
  return null;
}

function buildAddress(cep: string, ordemPassagem: number, opts?: { cidade?: string; uf?: string }) {
  return {
    ordemPassagem,
    codigo: '',
    logradouro: '',
    numero: '',
    cep,
    cidade: {
      pais: 'Brasil',
      uf: (opts?.uf || '').trim().toUpperCase().slice(0, 2),
      cidade: (opts?.cidade || '').trim().slice(0, 100),
      codigoIbge: 0,
    },
    latLng: { latitude: 0, longitude: 0 },
  };
}

export interface RouteDistanceResult {
  km_distance: number;
  success: true;
}

export interface RouteDistanceError {
  success: false;
  error: string;
}

/**
 * Calculate route distance via WebRouter API.
 *
 * @param originCep      Origin CEP (8 digits)
 * @param destinationCep Destination CEP (8 digits)
 * @param waypointCeps   Intermediate stop CEPs (ordered)
 * @returns km_distance or error
 */
export async function calculateRouteDistance(
  originCep: string,
  destinationCep: string,
  waypointCeps: string[] = []
): Promise<RouteDistanceResult | RouteDistanceError> {
  const apiKey = getEnv('WEBROUTER_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'WEBROUTER_API_KEY not configured' };
  }

  const origin = sanitizeCep(originCep);
  const destination = sanitizeCep(destinationCep);
  const waypoints = waypointCeps.map(sanitizeCep).filter((c) => c.length === 8);

  if (origin.length !== 8 || destination.length !== 8) {
    return { success: false, error: 'Invalid origin or destination CEP' };
  }

  // Geocode all CEPs in parallel for city/uf enrichment
  const allCeps = [origin, ...waypoints, destination];
  const addrs = await Promise.all(allCeps.map(fetchCityUf));

  const enderecos = allCeps.map((cep, i) => {
    const addr = addrs[i];
    return buildAddress(cep, i, addr ?? undefined);
  });

  const body = {
    autenticacao: { chaveAcesso: apiKey },
    rota: {
      enderecos,
      params: {
        categoriaVeiculo: '6', // trucado 4 eixos (default)
        perfilVeiculo: 'CAMINHAO',
        tipoCombustivel: 'DIESEL',
        tipoVeiculo: 'CAMINHAO',
        tipoRota: 'RAPIDA',
        priorizarRodovias: true,
      },
    },
    salvarRota: false,
  };

  try {
    const res = await fetch(WEBROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { success: false, error: data?.mensagem || `WebRouter HTTP ${res.status}` };
    }

    const status = data?.status ?? '';
    if (status !== 'SUCESSO' && status !== '') {
      return { success: false, error: data?.mensagem || `WebRouter status: ${status}` };
    }

    const rota = Array.isArray(data?.rotas) ? data.rotas[0] : null;
    const km = rota?.path?.distanciaKM;

    if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) {
      return { success: false, error: 'WebRouter did not return valid distance' };
    }

    return { success: true, km_distance: Math.round(km * 10) / 10 };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'WebRouter fetch failed' };
  }
}

// ---------------------------------------------------------------------------
// Full route result (with toll + coordinates for map rendering)
// ---------------------------------------------------------------------------

export interface TollPlaza {
  nome: string;
  cidade: string;
  uf: string;
  valor: number; // centavos
  valorTag: number; // centavos
  ordemPassagem: number;
}

export interface RouteDistanceFullResult {
  success: true;
  km_distance: number;
  toll_total_centavos: number;
  toll_tag_centavos: number;
  toll_plazas: TollPlaza[];
  /** Ordered [lat, lng] pairs from WebRouter path for Leaflet rendering */
  polyline_coords: [number, number][];
}

export interface RouteDistanceFullError {
  success: false;
  error: string;
}

/**
 * Full route calculation: km + tolls + coordinates.
 * Same API call as calculateRouteDistance but extracts more data.
 */
export async function calculateRouteDistanceFull(
  originCep: string,
  destinationCep: string,
  waypointCeps: string[] = []
): Promise<RouteDistanceFullResult | RouteDistanceFullError> {
  const apiKey = getEnv('WEBROUTER_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'WEBROUTER_API_KEY not configured' };
  }

  const origin = sanitizeCep(originCep);
  const destination = sanitizeCep(destinationCep);
  const waypoints = waypointCeps.map(sanitizeCep).filter((c) => c.length === 8);

  if (origin.length !== 8 || destination.length !== 8) {
    return { success: false, error: 'Invalid origin or destination CEP' };
  }

  const allCeps = [origin, ...waypoints, destination];
  const addrs = await Promise.all(allCeps.map(fetchCityUf));

  const enderecos = allCeps.map((cep, i) => {
    const addr = addrs[i];
    return buildAddress(cep, i, addr ?? undefined);
  });

  const body = {
    autenticacao: { chaveAcesso: apiKey },
    rota: {
      enderecos,
      params: {
        categoriaVeiculo: '6',
        perfilVeiculo: 'CAMINHAO',
        tipoCombustivel: 'DIESEL',
        tipoVeiculo: 'CAMINHAO',
        tipoRota: 'RAPIDA',
        priorizarRodovias: true,
      },
    },
    salvarRota: false,
  };

  try {
    const res = await fetch(WEBROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { success: false, error: data?.mensagem || `WebRouter HTTP ${res.status}` };
    }

    const status = data?.status ?? '';
    if (status !== 'SUCESSO' && status !== '') {
      return { success: false, error: data?.mensagem || `WebRouter status: ${status}` };
    }

    const rota = Array.isArray(data?.rotas) ? data.rotas[0] : null;
    const km = rota?.path?.distanciaKM;

    if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) {
      return { success: false, error: 'WebRouter did not return valid distance' };
    }

    // Extract tolls from individual plazas (more reliable than custos.pedagio)
    const tollPlazas = extractTollPlazas(rota);
    // Sum individual plaza values (already in reais) → convert to centavos
    const tollFromPlazas = tollPlazas.reduce((sum, p) => sum + (p.valor || 0), 0);
    const tollTagFromPlazas = tollPlazas.reduce((sum, p) => sum + (p.valorTag || 0), 0);
    // Fallback to custos.pedagio if no plazas
    const custos = rota?.custos ?? {};
    const tollTotal =
      tollFromPlazas > 0
        ? Math.round(tollFromPlazas * 100)
        : Math.round((Number(custos?.pedagio) || 0) * 100);
    const tollTag =
      tollTagFromPlazas > 0
        ? Math.round(tollTagFromPlazas * 100)
        : Math.round((Number(custos?.pedagioTag) || 0) * 100);

    console.log(
      `[webrouter-full] toll: plazas=${tollPlazas.length}, fromPlazas=${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(tollFromPlazas)}, custos.pedagio=${custos?.pedagio}`
    );

    // Extract coordinates from ordemRoteiro (waypoints with lat/lng)
    const polylineCoords = extractPolylineCoords(rota);
    console.log(
      `[webrouter-full] polyline coords: ${polylineCoords.length}, ordemRoteiro exists: ${!!rota?.ordemRoteiro}, path keys: ${rota?.path ? Object.keys(rota.path as object).join(',') : 'none'}`
    );

    return {
      success: true,
      km_distance: Math.round(km * 10) / 10,
      toll_total_centavos: tollTotal,
      toll_tag_centavos: tollTag,
      toll_plazas: tollPlazas,
      polyline_coords: polylineCoords,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'WebRouter fetch failed' };
  }
}

function extractTollPlazas(rota: Record<string, unknown> | null): TollPlaza[] {
  if (!rota) return [];
  try {
    const info = rota.informacaoPedagios as Record<string, unknown> | undefined;
    const result = info?.result as Record<string, unknown> | undefined;
    const pedagios = result?.pedagios;
    if (!Array.isArray(pedagios)) return [];

    return pedagios.map((p: Record<string, unknown>) => {
      const cidade = p.cidade as Record<string, unknown> | undefined;
      return {
        nome: String(p.nome || ''),
        cidade: String(cidade?.cidade || ''),
        uf: String(cidade?.uf || ''),
        valor: Number(p.valor) || 0,
        valorTag: Number(p.valorTag) || 0,
        ordemPassagem: Number(p.ordemPassagem) || 0,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Extract route coordinates from WebRouter response.
 * Tries ordemRoteiro (waypoints with accumulated lat/lng), then pathSegments.
 */
function extractPolylineCoords(rota: Record<string, unknown> | null): [number, number][] {
  if (!rota) return [];

  // Try ordemRoteiro — ordered waypoints with latLng nested object
  const ordemRoteiro = rota.ordemRoteiro;
  if (Array.isArray(ordemRoteiro) && ordemRoteiro.length >= 2) {
    const coords: [number, number][] = [];
    for (const ponto of ordemRoteiro) {
      const p = ponto as Record<string, unknown>;
      // WebRouter nests coords in latLng: { latitude, longitude }
      const latLngObj = p.latLng as Record<string, unknown> | undefined;
      const lat = Number(latLngObj?.latitude ?? p.latitude);
      const lng = Number(latLngObj?.longitude ?? p.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        coords.push([lat, lng]);
      }
    }
    if (coords.length >= 2) return coords;
  }

  // Try path.coordenadas (if available)
  const path = rota.path as Record<string, unknown> | undefined;
  if (path) {
    const coordenadas = path.coordenadas;
    if (Array.isArray(coordenadas) && coordenadas.length >= 2) {
      const coords: [number, number][] = [];
      for (const c of coordenadas) {
        const lat = Number((c as Record<string, unknown>)?.latitude ?? (c as number[])?.[0]);
        const lng = Number((c as Record<string, unknown>)?.longitude ?? (c as number[])?.[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          coords.push([lat, lng]);
        }
      }
      if (coords.length >= 2) return coords;
    }
  }

  return [];
}

/**
 * Haversine distance between two lat/lng points (km).
 * Used as fast proxy when WebRouter is unavailable or for pre-filtering.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
