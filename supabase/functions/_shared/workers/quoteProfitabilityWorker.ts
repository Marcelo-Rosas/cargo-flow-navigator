import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_QUOTE_PROFITABILITY,
  MAX_TOKENS_QUOTE,
} from '../prompts/system_quote_profitability.ts';
import {
  validateAndParse,
  type QuoteProfitabilityResult,
  type OccurrenceDetail,
  type RealProfitabilityMetrics,
} from '../prompts/schemas.ts';

interface WorkerContext {
  entityId: string;
  model: string;
  sb: any;
  previousInsights?: string;
}

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface OrderData {
  id: string;
  value: number | null;
  carreteiro_real: number | null;
  pedagio_real: number | null;
  descarga_real: number | null;
  stage: string;
}

interface ReconciliationData {
  paid_amount: number;
  delta_amount: number;
  is_reconciled: boolean;
}

interface FetchQuoteResult {
  quote: any;
  orderData: OrderData | null;
  reconciliation: ReconciliationData | null;
}

interface HistoricalData {
  margins: number[];
  avg: number | null;
  stdDev: number | null;
  count: number;
  /** true quando o benchmark foi filtrado pela faixa de km da cotação */
  usedKmFilter: boolean;
  kmRange: { min: number; max: number } | null;
}

// ---------------------------------------------------------------------------
// Coleta de dados
// ---------------------------------------------------------------------------

async function fetchQuoteData(sb: any, entityId: string): Promise<FetchQuoteResult> {
  const { data: quote, error } = await sb.from('quotes').select('*').eq('id', entityId).single();
  if (error || !quote) throw new Error(`Quote not found: ${entityId}`);

  const { data: order } = await sb
    .from('orders')
    .select('id, value, carreteiro_real, pedagio_real, descarga_real, stage')
    .eq('quote_id', entityId)
    .maybeSingle();

  let reconciliation: ReconciliationData | null = null;
  if (order?.id) {
    const { data: recon } = await sb
      .from('v_order_payment_reconciliation')
      .select('paid_amount, delta_amount, is_reconciled')
      .eq('order_id', order.id)
      .maybeSingle();
    reconciliation = recon ?? null;
  }

  return { quote, orderData: order ?? null, reconciliation };
}

/**
 * Busca margens históricas de cotações ganhas.
 * Quando kmDistance > 0, filtra por ±20% da distância da cotação atual.
 * Se o filtro retornar menos de 5 resultados, faz fallback para o benchmark global.
 */
async function fetchHistoricalMargins(sb: any, kmDistance: number): Promise<HistoricalData> {
  const MIN_FILTERED = 5;

  async function queryMargins(filtered: boolean): Promise<any[]> {
    let q = sb
      .from('quotes')
      .select('pricing_breakdown, km_distance')
      .eq('stage', 'ganho')
      .order('created_at', { ascending: false })
      .limit(filtered ? 50 : 30);

    if (filtered && kmDistance > 0) {
      const kmMin = kmDistance * 0.8;
      const kmMax = kmDistance * 1.2;
      q = q.gte('km_distance', kmMin).lte('km_distance', kmMax);
    }

    const { data } = await q;
    return data || [];
  }

  let usedKmFilter = kmDistance > 0;
  let rows = await queryMargins(usedKmFilter);

  // Fallback para benchmark global se amostra filtrada for insuficiente
  if (usedKmFilter && rows.length < MIN_FILTERED) {
    rows = await queryMargins(false);
    usedKmFilter = false;
  }

  const margins = rows
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
          margins.reduce((sum: number, m: number) => sum + Math.pow(m - (avg ?? 0), 2), 0) /
            margins.length
        )
      : null;

  const kmRange =
    usedKmFilter && kmDistance > 0
      ? { min: Math.round(kmDistance * 0.8), max: Math.round(kmDistance * 1.2) }
      : null;

  return { margins, avg, stdDev, count: margins.length, usedKmFilter, kmRange };
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

async function fetchOccurrences(sb: any, orderId: string): Promise<OccurrenceDetail[]> {
  const { data: occurrences } = await sb
    .from('occurrences')
    .select('description, severity')
    .eq('order_id', orderId);

  return (occurrences || []).map((o: any) => ({
    description: o.description || 'Sem descrição',
    severity: o.severity || 'baixa',
  }));
}

// ---------------------------------------------------------------------------
// Cálculos locais (não delegados ao LLM)
// ---------------------------------------------------------------------------

/** Margem média das cotações do cliente (extraída de pricing_breakdown). */
function calcAvgClientMargin(clientHistory: any[]): number | null {
  const margins = clientHistory
    .map(
      (q: any) =>
        q.pricing_breakdown?.profitability?.margemPercent ??
        q.pricing_breakdown?.profitability?.margem_percent
    )
    .filter((m: any) => m != null) as number[];

  return margins.length > 0
    ? margins.reduce((a: number, b: number) => a + b, 0) / margins.length
    : null;
}

/**
 * Desvio da margem atual em relação à média histórica (pontos percentuais).
 * Positivo = acima da média; negativo = abaixo.
 */
function calcDesvioMedia(currentMargin: number | null, avg: number | null): number | null {
  if (currentMargin == null || avg == null) return null;
  return currentMargin - avg;
}

function calcRealProfitability(
  quote: any,
  orderData: OrderData,
  reconciliation: ReconciliationData | null,
  occurrences: OccurrenceDetail[]
): RealProfitabilityMetrics | null {
  const receitaBruta = Number(orderData.value);
  if (!receitaBruta || receitaBruta <= 0) return null;

  const custoCarreteiro = reconciliation?.is_reconciled
    ? Number(reconciliation.paid_amount)
    : orderData.carreteiro_real != null
      ? Number(orderData.carreteiro_real)
      : null;

  if (custoCarreteiro == null) return null;

  const custosAdicionais =
    (orderData.pedagio_real != null ? Number(orderData.pedagio_real) : 0) +
    (orderData.descarga_real != null ? Number(orderData.descarga_real) : 0);
  const resultadoLiquidoReal = receitaBruta - custoCarreteiro - custosAdicionais;
  const margemPercentReal = (resultadoLiquidoReal / receitaBruta) * 100;

  const predictedMargin =
    quote.pricing_breakdown?.profitability?.margemPercent ??
    quote.pricing_breakdown?.profitability?.margem_percent;

  const result: RealProfitabilityMetrics = {
    custo_carreteiro_real: custoCarreteiro,
    resultado_liquido_real: resultadoLiquidoReal,
    margem_percent_real: margemPercentReal,
    is_reconciled: reconciliation?.is_reconciled ?? false,
    pedagio_real: orderData.pedagio_real != null ? Number(orderData.pedagio_real) : undefined,
    descarga_real: orderData.descarga_real != null ? Number(orderData.descarga_real) : undefined,
    ocorrencias: occurrences.length > 0 ? occurrences : undefined,
  };

  if (predictedMargin != null) {
    result.desvio_margem_prevista_real = margemPercentReal - Number(predictedMargin);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Montagem do prompt
// ---------------------------------------------------------------------------

function buildPrompt(
  quote: any,
  historical: HistoricalData,
  avgClientMargin: number | null,
  desvioMediaPct: number | null,
  clientHistoryCount: number,
  clientWonCount: number,
  realProfitability: RealProfitabilityMetrics | null,
  previousInsights?: string
): string {
  const breakdown = quote.pricing_breakdown;
  const profitability = breakdown?.profitability;
  const meta = breakdown?.meta;

  const kmDistance = Number(quote.km_distance) || 0;
  const quoteValue = Number(quote.value) || 0;
  const valorPorKm = kmDistance > 0 ? (quoteValue / kmDistance).toFixed(2) : 'N/A';

  // Benchmark label: informa se foi filtrado por rota ou é global
  const benchmarkLabel =
    historical.usedKmFilter && historical.kmRange
      ? `${historical.count} cotacoes ganhas com ${historical.kmRange.min}-${historical.kmRange.max} km`
      : `${historical.count} cotacoes ganhas (benchmark global)`;

  // Posição em relação à média: calculada no worker
  const margem_vs_media_label =
    desvioMediaPct == null
      ? 'N/A'
      : Math.abs(desvioMediaPct) <= 1
        ? `na_media (${desvioMediaPct > 0 ? '+' : ''}${desvioMediaPct.toFixed(1)} pp)`
        : desvioMediaPct > 0
          ? `acima (${'+' + desvioMediaPct.toFixed(1)} pp)`
          : `abaixo (${desvioMediaPct.toFixed(1)} pp)`;

  let prompt = `Analise a rentabilidade desta cotacao de frete:

**Cotacao**: ${quote.quote_code}
**Cliente**: ${quote.client_name}
**Rota**: ${quote.origin} -> ${quote.destination}
**Distancia**: ${kmDistance || 'N/A'} km
**Valor total (Previsto)**: R$ ${quoteValue.toFixed(2)}
**Valor por km (Previsto)**: R$ ${valorPorKm}

**Breakdown de Rentabilidade (Previsto)**:
- Custos carreteiro: R$ ${profitability?.custosCarreteiro ?? profitability?.custos_carreteiro ?? 'N/A'}
- Custos diretos: R$ ${profitability?.custosDiretos ?? profitability?.custos_diretos ?? 'N/A'}
- Margem bruta: R$ ${profitability?.margemBruta ?? profitability?.margem_bruta ?? 'N/A'}
- Margem %: ${profitability?.margemPercent ?? profitability?.margem_percent ?? 'N/A'}%
- Resultado liquido: R$ ${profitability?.resultadoLiquido ?? profitability?.resultado_liquido ?? 'N/A'}

**ANTT Piso**: R$ ${meta?.antt?.total ?? meta?.antt_piso_carreteiro ?? 'N/A'}
**Status margem**: ${meta?.marginStatus ?? meta?.margin_status ?? 'N/A'}

**Benchmark historico (${benchmarkLabel})**:
- Margem media: ${historical.avg != null ? historical.avg.toFixed(1) + '%' : 'Sem dados'}
- Desvio padrao: ${historical.stdDev != null ? historical.stdDev.toFixed(1) + '%' : 'N/A'}
- Posicao desta cotacao vs media [pre-calculado]: ${margem_vs_media_label}
- Desvio_da_media_pct [pre-calculado]: ${desvioMediaPct != null ? desvioMediaPct.toFixed(2) : 'N/A'}

**Historico do cliente (${clientHistoryCount} cotacoes)**:
- Margem media deste cliente [pre-calculado]: ${avgClientMargin != null ? avgClientMargin.toFixed(2) + '%' : 'Sem historico'}
- Cotacoes ganhas: ${clientWonCount}`;

  if (realProfitability) {
    prompt += `\n\n--- Ordem de Servico Finalizada (Dados Reais) ---`;
    prompt += `\n**Custo Carreteiro (Real)**: R$ ${realProfitability.custo_carreteiro_real.toFixed(2)}`;
    if (realProfitability.pedagio_real != null || realProfitability.descarga_real != null) {
      prompt += `\n**Custos adicionais (previsto vs real)**:`;
      if (realProfitability.pedagio_real != null)
        prompt += `\n- Pedagogio real: R$ ${realProfitability.pedagio_real.toFixed(2)}`;
      if (realProfitability.descarga_real != null)
        prompt += `\n- Descarga real: R$ ${realProfitability.descarga_real.toFixed(2)}`;
    }
    prompt += `\n**Resultado Liquido (Real)**: R$ ${realProfitability.resultado_liquido_real.toFixed(2)}`;
    prompt += `\n**Margem % Real**: ${realProfitability.margem_percent_real.toFixed(1)}%`;
    prompt += `\n**Status Conciliacao**: ${realProfitability.is_reconciled ? 'CONCILIADO (custo final confirmado por comprovante)' : 'PENDENTE (custo negociado, sem comprovante)'}`;

    if (realProfitability.desvio_margem_prevista_real != null) {
      const desvio = realProfitability.desvio_margem_prevista_real;
      prompt += `\n**Desvio Previsto vs Real**: ${desvio > 0 ? '+' : ''}${desvio.toFixed(1)}%`;
    }

    if (realProfitability.ocorrencias && realProfitability.ocorrencias.length > 0) {
      prompt += `\n**Ocorrencias Operacionais (${realProfitability.ocorrencias.length})**:`;
      realProfitability.ocorrencias.forEach((o) => {
        prompt += `\n- [${o.severity.toUpperCase()}] ${o.description}`;
      });
    }
  }

  if (previousInsights) {
    prompt += `\n\n**Analises anteriores desta entidade**:\n${previousInsights}`;
  }

  prompt += realProfitability
    ? `\n\nAvalie a rentabilidade desta operacao comparando previsto vs real. Use os valores pre-calculados de desvio_da_media_pct e margem_vs_media diretamente no JSON de resposta. Identifique os fatores que causaram desvio na margem e avalie se o preco estava adequado em relacao ao piso ANTT e ao historico.`
    : `\n\nAvalie se esta cotacao e rentavel. Use os valores pre-calculados de desvio_da_media_pct e margem_vs_media diretamente no JSON de resposta. Avalie se o preco esta adequado em relacao ao piso ANTT e ao historico de ${historical.usedKmFilter ? 'rotas similares' : 'todas as rotas'}.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Worker principal
// ---------------------------------------------------------------------------

export async function executeQuoteProfitabilityWorker(ctx: WorkerContext) {
  // Fase 1: busca cotação (necessária para extrair km_distance e client_name)
  const { quote, orderData, reconciliation } = await fetchQuoteData(ctx.sb, ctx.entityId);

  // Fase 2: fetches paralelos que dependem da cotação
  const kmDistance = Number(quote.km_distance) || 0;
  const [historicalFinal, clientHistory] = await Promise.all([
    fetchHistoricalMargins(ctx.sb, kmDistance),
    fetchClientHistory(ctx.sb, quote.client_name),
  ]);

  // P2: calcular métricas de benchmark no worker (antes do prompt)
  const currentMargin =
    Number(
      quote.pricing_breakdown?.profitability?.margemPercent ??
        quote.pricing_breakdown?.profitability?.margem_percent
    ) || null;

  const avgClientMargin = calcAvgClientMargin(clientHistory);
  const desvioMediaPct = calcDesvioMedia(currentMargin, historicalFinal.avg);

  const clientWonCount = clientHistory.filter((q: any) => q.stage === 'ganho').length;

  // Ocorrências e rentabilidade real (P1)
  let occurrences: OccurrenceDetail[] = [];
  if (orderData?.id && orderData.stage === 'entregue') {
    occurrences = await fetchOccurrences(ctx.sb, orderData.id);
  }

  const realProfitability =
    orderData?.stage === 'entregue'
      ? calcRealProfitability(quote, orderData, reconciliation, occurrences)
      : null;

  const prompt = buildPrompt(
    quote,
    historicalFinal,
    avgClientMargin,
    desvioMediaPct,
    clientHistory.length,
    clientWonCount,
    realProfitability,
    ctx.previousInsights
  );

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_QUOTE_PROFITABILITY,
    maxTokens: MAX_TOKENS_QUOTE,
    modelHint: 'anthropic',
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

  // P2: sobrescreve desvio_da_media_pct com o valor calculado deterministicamente no worker
  if (desvioMediaPct != null) {
    if (!analysis.metrics) analysis.metrics = {};
    analysis.metrics.desvio_da_media_pct = Number(desvioMediaPct.toFixed(2));
  }

  // P1: anexa dados reais
  if (realProfitability) {
    analysis.real_profitability = realProfitability;
  }

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
