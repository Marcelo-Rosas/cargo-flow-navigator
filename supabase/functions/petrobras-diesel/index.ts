import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// petrobras-diesel v2 — API JSON (combustivelapi.com.br) em vez de scraping HTML
const API_URL = 'https://combustivelapi.com.br/api/precos';

interface ApiResponse {
  error: boolean;
  message: string;
  data_coleta: string;
  precos: {
    diesel: Record<string, string>;
    gasolina: Record<string, string>;
  };
  analise: {
    estado_mais_barato_diesel: { sigla: string; preco: string };
    estado_mais_caro_diesel: { sigla: string; preco: string };
    diferenca_diesel: string;
    variacao_percentual_diesel: string;
  };
}

function parsePrice(val: string): number {
  return parseFloat(val.replace(',', '.'));
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const requestedUf = (url.searchParams.get('uf') ?? 'br').toLowerCase();

    // Fetch from API
    const apiRes = await fetch(API_URL);
    if (!apiRes.ok) {
      throw new Error(`API returned ${apiRes.status}`);
    }
    const api: ApiResponse = await apiRes.json();
    if (api.error) {
      throw new Error(`API error: ${api.message}`);
    }

    const now = new Date().toISOString();
    const periodoColeta = api.data_coleta;

    // Build rows for all UFs
    const rows = Object.entries(api.precos.diesel).map(([uf, preco]) => ({
      uf: uf.toUpperCase(),
      preco_medio: parsePrice(preco),
      parcela_petrobras: null,
      parcela_impostos_federais: null,
      parcela_icms: null,
      parcela_biodiesel: null,
      parcela_distribuicao: null,
      periodo_coleta: periodoColeta,
      fetched_at: now,
    }));

    // Upsert all UFs at once
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: upsertError } = await supabase
      .from('petrobras_diesel_prices')
      .upsert(rows, { onConflict: 'uf,periodo_coleta' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
    }

    // Find requested UF data
    const ufKey = requestedUf.toUpperCase();
    const ufPrice = api.precos.diesel[requestedUf];
    if (!ufPrice) {
      return new Response(JSON.stringify({ error: `UF não encontrada na API: ${requestedUf}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch previous record for variation
    const { data: prevRows } = await supabase
      .from('petrobras_diesel_prices')
      .select('preco_medio, periodo_coleta')
      .eq('uf', ufKey)
      .neq('periodo_coleta', periodoColeta)
      .order('fetched_at', { ascending: false })
      .limit(1);

    const prev = prevRows?.[0] as { preco_medio: number; periodo_coleta: string } | undefined;
    const precoMedio = parsePrice(ufPrice);
    const variacao_pct = prev
      ? Math.round(((precoMedio - prev.preco_medio) / prev.preco_medio) * 10000) / 100
      : null;

    return new Response(
      JSON.stringify({
        uf: ufKey,
        preco_medio: precoMedio,
        periodo_coleta: periodoColeta,
        fetched_at: now,
        variacao_pct,
        periodo_anterior: prev?.periodo_coleta ?? null,
        analise: {
          mais_barato: api.analise.estado_mais_barato_diesel,
          mais_caro: api.analise.estado_mais_caro_diesel,
          diferenca: api.analise.diferenca_diesel,
          variacao_percentual: api.analise.variacao_percentual_diesel,
        },
        ufs_atualizadas: rows.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('petrobras-diesel error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
