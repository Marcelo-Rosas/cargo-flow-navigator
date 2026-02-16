import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

type Input = {
  origin_cep: string;
  destination_cep: string;
};

function sanitizeCep(v: string) {
  return (v || '').toString().replace(/\D/g, '').slice(0, 8);
}

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

const WEBROUTER_URL = 'https://way.webrouter.com.br/RouterService/router/api/calcular';

function buildAddress(cep: string, ordemPassagem: number) {
  return {
    ordemPassagem,
    codigo: '',
    logradouro: '',
    numero: '',
    cep,
    cidade: { pais: 'Brasil', uf: '', cidade: '', codigoIbge: 0 },
    latLng: { latitude: 0, longitude: 0 },
  };
}

const ERROR_MAP: Record<string, { status: number; message: string }> = {
  LICENCA_INVALIDA: { status: 403, message: 'Chave de acesso inválida' },
  API_NAO_AUTORIZADA: { status: 403, message: 'API não autorizada' },
  LIMITE_CONSUMO_ATINGIDO: { status: 429, message: 'Limite de consumo atingido' },
  ERRO_CALCULO_ROTEIRO: { status: 422, message: 'Erro ao calcular rota' },
};

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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = getEnv('WEBROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'WEBROUTER_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webRouterBody = {
      autenticacao: { chaveAcesso: apiKey },
      rota: {
        enderecos: [buildAddress(originCep, 0), buildAddress(destinationCep, 1)],
        params: {
          tipoVeiculo: 'CAMINHAO',
          tipoRota: 'RAPIDA',
          priorizarRodovias: true,
        },
      },
      salvarRota: false,
    };

    const res = await fetch(WEBROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(webRouterBody),
    });

    const data = await res.json().catch(() => ({}));

    const wrStatus = data?.status ?? data?.codigo ?? '';
    const wrMsg = data?.mensagem ?? data?.message ?? '';

    if (!res.ok) {
      const err = ERROR_MAP[wrStatus] || {
        status: res.status,
        message: wrMsg || 'Erro ao consultar WebRouter',
      };
      const detail =
        wrStatus || wrMsg ? ` (WebRouter: ${[wrStatus, wrMsg].filter(Boolean).join(' - ')})` : '';
      return new Response(JSON.stringify({ success: false, error: err.message + detail }), {
        status: err.status >= 400 ? err.status : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (wrStatus !== 'SUCESSO' && wrStatus !== '') {
      const err = ERROR_MAP[wrStatus] || {
        status: 422,
        message: wrMsg || 'Erro ao calcular rota',
      };
      const detail =
        wrStatus || wrMsg ? ` (WebRouter: ${[wrStatus, wrMsg].filter(Boolean).join(' - ')})` : '';
      return new Response(JSON.stringify({ success: false, error: err.message + detail }), {
        status: err.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rotas = data?.rotas;
    const rota = Array.isArray(rotas) ? rotas[0] : null;
    const distanciaKM = rota?.path?.distanciaKM;
    const km = typeof distanciaKM === 'number' ? distanciaKM : null;

    if (km == null || !Number.isFinite(km) || km < 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'WebRouter não retornou distância válida' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const custos = rota?.custos ?? {};
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          km_distance: Math.round(km * 10) / 10,
          toll: custos.pedagio ?? undefined,
          toll_tag: custos.pedagioTag ?? undefined,
          source: 'webrouter',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
