import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

type Input = {
  origin_cep: string;
  destination_cep: string;
};

function sanitizeCep(v: string) {
  return (v || '').toString().replace(/\D/g, '').slice(0, 8);
}

async function geocodeCep(cep: string) {
  // Nominatim usage policy: set a valid User-Agent
  // We pass postalcode + country=Brazil for best results.
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('country', 'Brazil');
  url.searchParams.set('postalcode', cep);

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'vectra-cargo-flow/1.0 (distance-calc; contact: support@vectracargo.com.br)',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Geocode CEP failed (${res.status})`);
  }

  const json = await res.json();
  const item = Array.isArray(json) ? json[0] : null;
  if (!item?.lat || !item?.lon) return null;

  return {
    lat: Number(item.lat),
    lon: Number(item.lon),
    display_name: item.display_name as string,
  };
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
    const originCep = sanitizeCep(body.origin_cep || '');
    const destinationCep = sanitizeCep(body.destination_cep || '');

    if (originCep.length !== 8 || destinationCep.length !== 8) {
      return new Response(JSON.stringify({ success: false, error: 'CEPs inválidos' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const [from, to] = await Promise.all([geocodeCep(originCep), geocodeCep(destinationCep)]);

    if (!from || !to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível geocodificar um dos CEPs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
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
          origin: { ...from, cep: originCep },
          destination: { ...to, cep: destinationCep },
          source: 'nominatim+osrm',
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
