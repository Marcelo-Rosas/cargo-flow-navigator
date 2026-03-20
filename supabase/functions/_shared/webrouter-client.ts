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
