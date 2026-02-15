import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

type CepInput = {
  origin_cep: string;
  destination_cep: string;
};
type CoordInput = {
  origin: { lat: number; lon: number };
  destination: { lat: number; lon: number };
};
type Input = CepInput | CoordInput;

function sanitizeCep(v: string) {
  return (v || '').toString().replace(/\D/g, '').slice(0, 8);
}

const UA = 'vectra-cargo-flow/1.0 (distance-calc; contact: support@vectracargo.com.br)';

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

/** BrasilAPI v2 retorna coordenadas em location.coordinates */
async function geocodeBrasilApi(
  cep: string
): Promise<{ lat: number; lon: number; display_name: string } | null> {
  try {
    const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!res?.ok) return null;
    const j = await res.json();
    const coords = j?.location?.coordinates;
    if (coords && coords.latitude != null && coords.longitude != null) {
      const lat = Number(coords.latitude);
      const lon = Number(coords.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const city = j.city || '';
        const state = j.state || '';
        return { lat, lon, display_name: `${city}, ${state}` };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchAddressFromCep(
  cep: string
): Promise<{ localidade: string; uf: string } | null> {
  const sources = [
    {
      url: `https://viacep.com.br/ws/${cep}/json/`,
      get: (j: { erro?: unknown; localidade?: string; uf?: string }) =>
        !j.erro && j.localidade && j.uf ? { localidade: j.localidade, uf: j.uf } : null,
    },
    {
      url: `https://brasilapi.com.br/api/cep/v2/${cep}`,
      get: (j: { city?: string; state?: string }) =>
        j.city && j.state ? { localidade: j.city, uf: j.state } : null,
    },
    {
      url: `https://opencep.com/v1/${cep}.json`,
      get: (j: { localidade?: string; uf?: string }) =>
        j.localidade && j.uf ? { localidade: j.localidade, uf: j.uf } : null,
    },
  ];
  for (const s of sources) {
    try {
      const res = await fetchWithTimeout(s.url);
      if (res?.ok) {
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

async function geocodeNominatim(params: {
  q?: string;
  postalcode?: string;
}): Promise<{ lat: number; lon: number; display_name: string } | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('country', 'Brazil');
    if (params.postalcode) url.searchParams.set('postalcode', params.postalcode);
    if (params.q) url.searchParams.set('q', params.q);

    const res = await fetchWithTimeout(url.toString(), 5000);
    if (!res?.ok) return null;
    const json = await res.json();
    const item = Array.isArray(json) ? json[0] : null;
    if (!item?.lat || !item?.lon) return null;
    return {
      lat: Number(item.lat),
      lon: Number(item.lon),
      display_name: (item.display_name as string) || '',
    };
  } catch {
    return null;
  }
}

async function geocodeCep(cep: string) {
  // 1) BrasilAPI v2 (coordenadas nativas)
  let r = await geocodeBrasilApi(cep);
  if (r) return r;

  // 2) ViaCEP/BrasilAPI/OpenCEP → Nominatim por "Cidade, UF, Brazil"
  const addr = await fetchAddressFromCep(cep);
  if (addr) {
    r = await geocodeNominatim({ q: `${addr.localidade}, ${addr.uf}, Brazil` });
    if (r) return r;
  }

  // 3) Nominatim por CEP
  return await geocodeNominatim({ postalcode: cep });
}

async function routeKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'vectra-cargo-flow/1.0 (distance-calc; contact: support@vectracargo.com.br)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`OSRM route failed (${res.status})`);
  }

  const data = await res.json();
  const meters = data?.routes?.[0]?.distance;
  if (typeof meters !== 'number') return null;
  return meters / 1000;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<Input>;
    let from: { lat: number; lon: number; display_name: string };
    let to: { lat: number; lon: number; display_name: string };
    let originCep = '';
    let destinationCep = '';

    if ('origin' in body && 'destination' in body && body.origin && body.destination) {
      const o = body.origin as { lat?: number; lon?: number };
      const d = body.destination as { lat?: number; lon?: number };
      if (
        typeof o?.lat === 'number' &&
        typeof o?.lon === 'number' &&
        typeof d?.lat === 'number' &&
        typeof d?.lon === 'number'
      ) {
        from = { lat: o.lat, lon: o.lon, display_name: '' };
        to = { lat: d.lat, lon: d.lon, display_name: '' };
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Coordenadas inválidas' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    } else {
      originCep = sanitizeCep((body as Partial<CepInput>).origin_cep || '');
      destinationCep = sanitizeCep((body as Partial<CepInput>).destination_cep || '');
      if (originCep.length !== 8 || destinationCep.length !== 8) {
        return new Response(JSON.stringify({ success: false, error: 'CEPs inválidos' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      const [fromRes, toRes] = await Promise.all([
        geocodeCep(originCep),
        geocodeCep(destinationCep),
      ]);
      if (!fromRes || !toRes) {
        return new Response(
          JSON.stringify({ success: false, error: 'Não foi possível geocodificar um dos CEPs' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
        );
      }
      from = fromRes;
      to = toRes;
    }

    const km = await routeKm(from, to);
    if (!km) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível calcular a rota' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          km_distance: Math.round(km * 10) / 10, // 1 casa
          origin: { ...from, cep: originCep || undefined },
          destination: { ...to, cep: destinationCep || undefined },
          source: originCep ? 'brasilapi+osrm' : 'client+osrm',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
