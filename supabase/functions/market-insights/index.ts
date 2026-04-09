import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

// Market Insights data type
interface MarketInsights {
  gerado_em: string;
  periodo_referencia: string;
  indices: {
    inctf_mensal: number;
    inctf_12meses: number;
    inctl_mensal: number;
    inctl_12meses: number;
  };
  combustivel: {
    diesel_s10_preco: number;
    diesel_s10_12meses: number;
    diesel_comum_preco: number;
    diesel_comum_12meses: number;
  };
  reajuste_sugerido_pct: number;
  alerta_nivel: 'estavel' | 'atencao' | 'urgente';
  alerta_cor: 'green' | 'yellow' | 'red';
  aviso_importante?: string;
}

// Fallback quando o banco ainda não tem dados
const DEFAULT_MARKET_DATA: MarketInsights = {
  gerado_em: new Date().toISOString().split('T')[0],
  periodo_referencia: 'Março/2026',
  indices: {
    inctf_mensal: 0.0037,
    inctf_12meses: 0.0482,
    inctl_mensal: 0.0136,
    inctl_12meses: 0.0521,
  },
  combustivel: {
    diesel_s10_preco: 6.11,
    diesel_s10_12meses: 0.0315,
    diesel_comum_preco: 5.87,
    diesel_comum_12meses: 0.028,
  },
  reajuste_sugerido_pct: 0.0361,
  alerta_nivel: 'atencao',
  alerta_cor: 'yellow',
  aviso_importante: 'Dados em modo offline — valores de referência de Março/2026',
};

function calculateAlertLevel(pct: number): {
  nivel: 'estavel' | 'atencao' | 'urgente';
  cor: 'green' | 'yellow' | 'red';
} {
  if (pct < 0.03) {
    return { nivel: 'estavel', cor: 'green' };
  } else if (pct < 0.06) {
    return { nivel: 'atencao', cor: 'yellow' };
  } else {
    return { nivel: 'urgente', cor: 'red' };
  }
}

// Mapeia uma linha de market_indices (schema DB) → MarketInsights (schema frontend)
// Colunas DB:  inctf_acumulado, inctl_acumulado, diesel_s10, diesel_s500,
//              diesel_variacao_anual, reajuste_sugerido, alerta_reajuste
function rowToMarketInsights(row: Record<string, unknown>): MarketInsights {
  const reajuste = Number(row.reajuste_sugerido ?? 0);
  const alerta = calculateAlertLevel(reajuste);

  return {
    gerado_em: String(row.gerado_em ?? DEFAULT_MARKET_DATA.gerado_em),
    periodo_referencia: String(row.periodo_referencia ?? DEFAULT_MARKET_DATA.periodo_referencia),
    indices: {
      inctf_mensal: Number(row.inctf_mensal ?? DEFAULT_MARKET_DATA.indices.inctf_mensal),
      inctf_12meses: Number(row.inctf_acumulado ?? DEFAULT_MARKET_DATA.indices.inctf_12meses),
      inctl_mensal: Number(row.inctl_mensal ?? DEFAULT_MARKET_DATA.indices.inctl_mensal),
      inctl_12meses: Number(row.inctl_acumulado ?? DEFAULT_MARKET_DATA.indices.inctl_12meses),
    },
    combustivel: {
      diesel_s10_preco: Number(row.diesel_s10 ?? DEFAULT_MARKET_DATA.combustivel.diesel_s10_preco),
      diesel_s10_12meses: Number(
        row.diesel_variacao_anual ?? DEFAULT_MARKET_DATA.combustivel.diesel_s10_12meses
      ),
      diesel_comum_preco: Number(
        row.diesel_s500 ?? DEFAULT_MARKET_DATA.combustivel.diesel_comum_preco
      ),
      diesel_comum_12meses: Number(
        row.diesel_variacao_mensal ?? DEFAULT_MARKET_DATA.combustivel.diesel_comum_12meses
      ),
    },
    reajuste_sugerido_pct: reajuste,
    alerta_nivel: (row.alerta_reajuste as MarketInsights['alerta_nivel']) ?? alerta.nivel,
    alerta_cor: alerta.cor,
  };
}

// Main handler
Deno.serve(async (req: Request) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Content-Type': 'application/json',
    'Cache-Control': 'max-age=3600',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (supabaseUrl && serviceRoleKey) {
      const sb = createClient(supabaseUrl, serviceRoleKey);

      const { data, error } = await sb
        .from('market_indices')
        .select(
          'periodo_referencia, gerado_em, inctf_mensal, inctf_acumulado, inctl_mensal, inctl_acumulado, diesel_s10, diesel_s500, diesel_variacao_mensal, diesel_variacao_anual, reajuste_sugerido, alerta_reajuste'
        )
        .order('gerado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const responseData = rowToMarketInsights(data as Record<string, unknown>);
        return new Response(JSON.stringify(responseData), { headers, status: 200 });
      }

      console.warn('market-insights: nenhum dado no banco, usando fallback.', error?.message);
    } else {
      console.warn('market-insights: env vars ausentes, usando fallback.');
    }

    // Banco vazio ou env ausente → retorna DEFAULT com alerta recalculado
    const alertInfo = calculateAlertLevel(DEFAULT_MARKET_DATA.reajuste_sugerido_pct);
    return new Response(
      JSON.stringify({
        ...DEFAULT_MARKET_DATA,
        alerta_nivel: alertInfo.nivel,
        alerta_cor: alertInfo.cor,
      }),
      { headers, status: 200 }
    );
  } catch (error) {
    console.error('market-insights error:', error);

    // Mesmo em erro crítico, sempre retorna objeto válido com indices
    const alertInfo = calculateAlertLevel(DEFAULT_MARKET_DATA.reajuste_sugerido_pct);
    return new Response(
      JSON.stringify({
        ...DEFAULT_MARKET_DATA,
        alerta_nivel: alertInfo.nivel,
        alerta_cor: alertInfo.cor,
        aviso_importante: 'Erro ao buscar dados — usando valores de referência',
      }),
      { headers, status: 200 }
    );
  }
});
