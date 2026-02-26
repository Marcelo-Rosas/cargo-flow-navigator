import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_QUOTE_PROFITABILITY,
  MAX_TOKENS_QUOTE,
} from '../prompts/system_quote_profitability.ts';
import { validateAndParse, type QuoteProfitabilityResult } from '../prompts/schemas.ts';

interface WorkerContext {
  entityId: string;
  model: string;
  sb: any;
  previousInsights?: string;
}

async function fetchQuoteData(sb: any, entityId: string) {
  const { data: quote, error } = await sb.from('quotes').select('*').eq('id', entityId).single();
  if (error || !quote) throw new Error(`Quote not found: ${entityId}`);
  return quote;
}

async function fetchHistoricalMargins(sb: any) {
  const { data: recentQuotes } = await sb
    .from('quotes')
    .select('value, pricing_breakdown, client_name, origin, destination')
    .eq('stage', 'ganho')
    .order('created_at', { ascending: false })
    .limit(30);

  const margins = (recentQuotes || [])
    .map(
      (q: any) =>
        q.pricing_breakdown?.profitability?.margemPercent ??
        q.pricing_breakdown?.profitability?.margem_percent
    )
    .filter((m: any) => m != null) as number[];

  const avg =
    margins.length > 0 ? margins.reduce((a: number, b: number) => a + b, 0) / margins.length : null;

  const stdDev =
    margins.length > 1
      ? Math.sqrt(
          margins.reduce((sum: number, m: number) => sum + Math.pow(m - (avg || 0), 2), 0) /
            margins.length
        )
      : null;

  return { margins, avg, stdDev, count: margins.length };
}

async function fetchClientHistory(sb: any, clientName: string) {
  const { data: clientQuotes } = await sb
    .from('quotes')
    .select('value, pricing_breakdown, stage, created_at')
    .eq('client_name', clientName)
    .order('created_at', { ascending: false })
    .limit(10);

  return clientQuotes || [];
}

function buildPrompt(
  quote: any,
  historical: any,
  clientHistory: any[],
  previousInsights?: string
): string {
  const breakdown = quote.pricing_breakdown;
  const profitability = breakdown?.profitability;
  const meta = breakdown?.meta;

  const clientMargins = clientHistory
    .map(
      (q: any) =>
        q.pricing_breakdown?.profitability?.margemPercent ??
        q.pricing_breakdown?.profitability?.margem_percent
    )
    .filter((m: any) => m != null);
  const avgClientMargin =
    clientMargins.length > 0
      ? clientMargins.reduce((a: number, b: number) => a + b, 0) / clientMargins.length
      : null;

  const kmDistance = Number(quote.km_distance) || 0;
  const quoteValue = Number(quote.value) || 0;
  const valorPorKm = kmDistance > 0 ? (quoteValue / kmDistance).toFixed(2) : 'N/A';

  let prompt = `Analise a rentabilidade desta cotacao de frete:

**Cotacao**: ${quote.quote_code}
**Cliente**: ${quote.client_name}
**Rota**: ${quote.origin} -> ${quote.destination}
**Distancia**: ${kmDistance || 'N/A'} km
**Valor total**: R$ ${quoteValue.toFixed(2)}
**Valor por km**: R$ ${valorPorKm}

**Breakdown de Rentabilidade**:
- Custos carreteiro: R$ ${profitability?.custosCarreteiro ?? profitability?.custos_carreteiro ?? 'N/A'}
- Custos diretos: R$ ${profitability?.custosDiretos ?? profitability?.custos_diretos ?? 'N/A'}
- Margem bruta: R$ ${profitability?.margemBruta ?? profitability?.margem_bruta ?? 'N/A'}
- Margem %: ${profitability?.margemPercent ?? profitability?.margem_percent ?? 'N/A'}%
- Resultado liquido: R$ ${profitability?.resultadoLiquido ?? profitability?.resultado_liquido ?? 'N/A'}

**ANTT Piso**: R$ ${meta?.antt?.total ?? meta?.antt_piso_carreteiro ?? 'N/A'}
**Status margem**: ${meta?.marginStatus ?? meta?.margin_status ?? 'N/A'}

**Comparativo historico (${historical.count} cotacoes ganhas)**:
- Margem media: ${historical.avg ? historical.avg.toFixed(1) + '%' : 'Sem dados'}
- Desvio padrao: ${historical.stdDev ? historical.stdDev.toFixed(1) + '%' : 'N/A'}

**Historico do cliente (${clientHistory.length} cotacoes)**:
- Margem media deste cliente: ${avgClientMargin ? avgClientMargin.toFixed(1) + '%' : 'Sem historico'}
- Cotacoes ganhas: ${clientHistory.filter((q: any) => q.stage === 'ganho').length}`;

  if (previousInsights) {
    prompt += `\n\n**Analises anteriores desta entidade**:\n${previousInsights}`;
  }

  prompt += `\n\nAvalie se esta cotacao e rentavel, se esta acima ou abaixo da media, e se o preco esta adequado em relacao ao piso ANTT.`;

  return prompt;
}

export async function executeQuoteProfitabilityWorker(ctx: WorkerContext) {
  const [quote, historical] = await Promise.all([
    fetchQuoteData(ctx.sb, ctx.entityId),
    fetchHistoricalMargins(ctx.sb),
  ]);

  const clientHistory = await fetchClientHistory(ctx.sb, quote.client_name);
  const prompt = buildPrompt(quote, historical, clientHistory, ctx.previousInsights);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_QUOTE_PROFITABILITY,
    maxTokens: MAX_TOKENS_QUOTE,
    analysisType: 'quote_profitability',
    entityType: 'quote',
    entityId: ctx.entityId,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<QuoteProfitabilityResult>(result.text, 'quote_profitability');
  analysis._model = ctx.model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  await ctx.sb.from('ai_insights').insert({
    insight_type: 'quote_profitability',
    entity_type: 'quote',
    entity_id: ctx.entityId,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { analysis, durationMs, provider: result.provider };
}
