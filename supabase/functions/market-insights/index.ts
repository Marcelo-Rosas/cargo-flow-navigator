import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

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

// Default market data (fallback when offline)
const DEFAULT_MARKET_DATA: MarketInsights = {
  gerado_em: new Date().toISOString().split('T')[0],
  periodo_referencia: 'Março/2026',
  indices: {
    inctf_mensal: 0.0037, // +0,37%
    inctf_12meses: 0.0482, // +4,82%
    inctl_mensal: 0.0136, // +1,36%
    inctl_12meses: 0.0521, // +5,21%
  },
  combustivel: {
    diesel_s10_preco: 6.11, // R$ 6,11/L
    diesel_s10_12meses: 0.0315, // +3,15%
    diesel_comum_preco: 5.87, // R$ 5,87/L
    diesel_comum_12meses: 0.028, // +2,80%
  },
  reajuste_sugerido_pct: 0.0361, // 3,61%
  alerta_nivel: 'atencao', // 🟡
  alerta_cor: 'yellow',
  aviso_importante: 'Dados em modo offline — Próxima atualização: segunda-feira às 08:00',
};

// Calculate alert level based on reajuste percentage
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

// Main handler
Deno.serve(async (req: Request) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Content-Type': 'application/json',
    'Cache-Control': 'max-age=3600', // 1 hour cache
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    // For now, return default data
    // In production, you would:
    // 1. Fetch from Portal NTC API
    // 2. Parse current indices (INCTF, INCTL)
    // 3. Fetch diesel prices
    // 4. Calculate suggested reajuste
    // 5. Store in database
    // 6. Return cached data

    const alertInfo = calculateAlertLevel(DEFAULT_MARKET_DATA.reajuste_sugerido_pct);
    const responseData: MarketInsights = {
      ...DEFAULT_MARKET_DATA,
      alerta_nivel: alertInfo.nivel,
      alerta_cor: alertInfo.cor,
    };

    return new Response(JSON.stringify(responseData), {
      headers,
      status: 200,
    });
  } catch (error) {
    console.error('Error in market-insights function:', error);

    // Return default data on error
    const alertInfo = calculateAlertLevel(DEFAULT_MARKET_DATA.reajuste_sugerido_pct);
    const fallbackData: MarketInsights = {
      ...DEFAULT_MARKET_DATA,
      alerta_nivel: alertInfo.nivel,
      alerta_cor: alertInfo.cor,
      aviso_importante: 'Erro ao buscar dados — usando valores em cache',
    };

    return new Response(JSON.stringify(fallbackData), {
      headers,
      status: 200,
    });
  }
});
