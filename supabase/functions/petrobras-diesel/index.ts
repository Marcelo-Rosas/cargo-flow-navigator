import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const PETROBRAS_BASE = 'https://precos.petrobras.com.br/w/diesel';

interface DieselPrice {
  uf: string;
  preco_medio: number;
  parcela_petrobras: number | null;
  parcela_impostos_federais: number | null;
  parcela_icms: number | null;
  parcela_biodiesel: number | null;
  parcela_distribuicao: number | null;
  periodo_coleta: string | null;
  fetched_at: string;
}

/**
 * Scrape diesel price from Petrobras HTML page.
 * The page is server-side rendered (Liferay CMS) with these key elements:
 *   - .espacodosvalores-descricao > p  → preço médio
 *   - .quadro-petrob .quadro-valor-abso → parcela Petrobras
 *   - Footnote "Período de coleta de DD/MM/YYYY a DD/MM/YYYY"
 */
async function scrapeDieselPrice(uf: string): Promise<DieselPrice> {
  const url = `${PETROBRAS_BASE}/${uf.toLowerCase()}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Petrobras returned ${res.status} for UF=${uf}`);
  }

  const html = await res.text();

  // Extract value by Liferay editable ID: data-lfr-editable-id="X">value<
  const byId = (id: string): number | null => {
    const re = new RegExp(`data-lfr-editable-id="${id}"[^>]*>\\s*([\\d]+[.,]?[\\d]*)\\s*<`, 'i');
    const m = html.match(re);
    if (!m) return null;
    return parseFloat(m[1].replace(',', '.'));
  };

  // Preço médio final
  const precoMedio = byId('telafinal-precofinal');
  if (precoMedio == null) {
    throw new Error(`Could not extract preço médio from HTML (UF=${uf})`);
  }

  // Parcelas via editable IDs (with fallback aliases)
  const parcelaPetrobras = byId('tarifa5-numero');
  const parcelaImpostos = byId('descri3-valor1') ?? byId('tarifa4-numero');
  const parcelaIcms = byId('descri3-valor2') ?? byId('tarifa3-numero');
  const parcelaBiodiesel = byId('descri4-valor1') ?? byId('tarifa2-numero');
  const parcelaDistribuicao = byId('descri5-valor1') ?? byId('tarifa1-numero');

  // Período de coleta
  const periodoMatch = html.match(
    /Per[ií]odo\s+de\s+coleta\s+de\s+(\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4})/i
  );
  const periodoColeta = periodoMatch ? periodoMatch[1] : null;

  return {
    uf: uf.toUpperCase(),
    preco_medio: precoMedio,
    parcela_petrobras: parcelaPetrobras,
    parcela_impostos_federais: parcelaImpostos,
    parcela_icms: parcelaIcms,
    parcela_biodiesel: parcelaBiodiesel,
    parcela_distribuicao: parcelaDistribuicao,
    periodo_coleta: periodoColeta,
    fetched_at: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const uf = (url.searchParams.get('uf') ?? 'br').toLowerCase();
    const debug = url.searchParams.get('debug') === '1';

    // Validate UF
    const validUFs = [
      'br',
      'ac',
      'al',
      'am',
      'ap',
      'ba',
      'ce',
      'df',
      'es',
      'go',
      'ma',
      'mg',
      'ms',
      'mt',
      'pa',
      'pb',
      'pe',
      'pi',
      'pr',
      'rj',
      'rn',
      'ro',
      'rr',
      'rs',
      'sc',
      'se',
      'sp',
      'to',
    ];
    if (!validUFs.includes(uf)) {
      return new Response(JSON.stringify({ error: `UF inválida: ${uf}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Debug mode: return raw HTML snippet
    if (debug) {
      const debugUrl = `${PETROBRAS_BASE}/${uf}`;
      const debugRes = await fetch(debugUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        redirect: 'follow',
      });
      const debugHtml = await debugRes.text();
      // Return first 3000 chars + any matches for price patterns
      const priceMatches = [...debugHtml.matchAll(/(\d+[.,]\d{2,3})/g)]
        .slice(0, 20)
        .map((m) => m[1]);
      const realValueMatches = [...debugHtml.matchAll(/real-value[^>]*>[^<]*</g)]
        .slice(0, 10)
        .map((m) => m[0]);
      const espacoMatches = [...debugHtml.matchAll(/espacodosvalores[^>]*>[\s\S]{0,300}/g)]
        .slice(0, 5)
        .map((m) => m[0]);
      return new Response(
        JSON.stringify({
          status: debugRes.status,
          htmlLength: debugHtml.length,
          first2000: debugHtml.slice(0, 2000),
          priceMatches,
          realValueMatches,
          espacoMatches,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scrape
    const data = await scrapeDieselPrice(uf);

    // Upsert into Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: upsertError } = await supabase.from('petrobras_diesel_prices').upsert(
      {
        uf: data.uf,
        preco_medio: data.preco_medio,
        parcela_petrobras: data.parcela_petrobras,
        parcela_impostos_federais: data.parcela_impostos_federais,
        parcela_icms: data.parcela_icms,
        parcela_biodiesel: data.parcela_biodiesel,
        parcela_distribuicao: data.parcela_distribuicao,
        periodo_coleta: data.periodo_coleta,
        fetched_at: data.fetched_at,
      },
      { onConflict: 'uf,periodo_coleta' }
    );

    if (upsertError) {
      console.error('Upsert error:', upsertError);
    }

    // Also fetch previous record to compute variation
    const { data: prevRows } = await supabase
      .from('petrobras_diesel_prices')
      .select('preco_medio, periodo_coleta')
      .eq('uf', data.uf)
      .neq('periodo_coleta', data.periodo_coleta ?? '')
      .order('fetched_at', { ascending: false })
      .limit(1);

    const prev = prevRows?.[0] as { preco_medio: number; periodo_coleta: string } | undefined;
    const variacao_pct = prev
      ? Math.round(((data.preco_medio - prev.preco_medio) / prev.preco_medio) * 10000) / 100
      : null;

    return new Response(
      JSON.stringify({
        ...data,
        variacao_pct,
        periodo_anterior: prev?.periodo_coleta ?? null,
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
