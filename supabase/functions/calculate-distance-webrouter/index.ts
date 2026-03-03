import { getCorsHeaders } from '../_shared/cors.ts';

type Input = {
  origin_cep: string;
  destination_cep: string;
  axes_count?: number;
  /** Categoria AILOG/WebRouter (ex: "2","4","6","7","8","12"). Preferida sobre axes_count. */
  categoria_veiculo?: string;
};

interface TollPlaza {
  nome: string;
  cidade: string;
  uf: string;
  valor: number;
  valorTag: number;
  ordemPassagem: number;
}

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

/**
 * Map axes_count (number of axles) to WebRouter categoriaVeiculo code.
 * See WebRouter API docs — Tabela de Categorias:
 *   "2" = Comercial 2 eixos, "4" = Comercial 3 eixos,
 *   "6" = Comercial 4 eixos, "7" = Comercial 5 eixos,
 *   "8" = Comercial 6 eixos, "10" = Comercial 7 eixos,
 *   "11" = Comercial 8 eixos, "12" = Comercial 9 eixos.
 * Default: "6" (4 eixos — caminhão trucado, perfil mais comum).
 */
function axesToCategoria(axes?: number): string {
  if (!axes || axes < 2) return '6'; // default: trucado 4 eixos
  const map: Record<number, string> = {
    2: '2',
    3: '4',
    4: '6',
    5: '7',
    6: '8',
    7: '10',
    8: '11',
    9: '12',
  };
  return map[axes] ?? '8'; // 6+ eixos fallback to comercial 6 eixos
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

/**
 * Extract toll plazas from WebRouter response.
 * WebRouter returns: rotas[0].informacaoPedagios.result.pedagios[]
 * Each plaza has: nome, cidade { uf, cidade }, valor, valorTag, ordemPassagem
 */
function extractTollPlazas(rota: Record<string, unknown>): TollPlaza[] {
  try {
    const info = rota?.informacaoPedagios as Record<string, unknown> | undefined;
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

Deno.serve(async (req) => {
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

    const axesCount = body.axes_count;
    const categoriaVeiculo = body.categoria_veiculo;
    const categoria =
      categoriaVeiculo && /^\d+$/.test(String(categoriaVeiculo))
        ? String(categoriaVeiculo)
        : axesToCategoria(axesCount);

    const webRouterBody = {
      autenticacao: { chaveAcesso: apiKey },
      rota: {
        enderecos: [buildAddress(originCep, 0), buildAddress(destinationCep, 1)],
        params: {
          categoriaVeiculo: categoria,
          perfilVeiculo: 'CAMINHAO',
          tipoCombustivel: 'DIESEL',
          tipoVeiculo: 'CAMINHAO',
          tipoRota: 'RAPIDA',
          priorizarRodovias: true,
        },
      },
      salvarRota: false,
    };

    console.log(
      `[webrouter] CEPs: ${originCep} → ${destinationCep}, categoria: ${categoria}${categoriaVeiculo ? ' (AILOG)' : ` (axes: ${axesCount ?? 'default'})`}`
    );

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
    const tollPlazas = rota ? extractTollPlazas(rota as Record<string, unknown>) : [];

    console.log(
      `[webrouter] Resultado: ${km} km, pedágio: ${custos.pedagio}, tag: ${custos.pedagioTag}, praças: ${tollPlazas.length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          km_distance: Math.round(km * 10) / 10,
          toll: custos.pedagio ?? undefined,
          toll_tag: custos.pedagioTag ?? undefined,
          toll_plazas: tollPlazas,
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
