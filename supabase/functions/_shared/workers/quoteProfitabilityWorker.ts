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
// Tipos internos de dados brutos
// ---------------------------------------------------------------------------

interface OrderData {
  id: string;
  value: number | null;
  carreteiro_real: number | null;
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

// ---------------------------------------------------------------------------
// Coleta de dados
// ---------------------------------------------------------------------------

async function fetchQuoteData(sb: any, entityId: string): Promise<FetchQuoteResult> {
  const { data: quote, error } = await sb.from('quotes').select('*').eq('id', entityId).single();
  if (error || !quote) throw new Error(`Quote not found: ${entityId}`);

  // Busca OS associada à cotação (pode não existir)
  const { data: order } = await sb
    .from('orders')
    .select('id, value, carreteiro_real, stage')
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
// Cálculo da rentabilidade real
// ---------------------------------------------------------------------------

function calcRealProfitability(
  quote: any,
  orderData: OrderData,
  reconciliation: ReconciliationData | null,
  occurrences: OccurrenceDetail[]
): RealProfitabilityMetrics | null {
  const receitaBruta = Number(orderData.value);
  if (!receitaBruta || receitaBruta <= 0) return null;

  // Prioriza o valor pago conciliado (comprovante real); fallback para negociado
  const custoCarreteiro = reconciliation?.is_reconciled
    ? Number(reconciliation.paid_amount)
    : orderData.carreteiro_real != null
      ? Number(orderData.carreteiro_real)
      : null;

  if (custoCarreteiro == null) return null;

  const resultadoLiquidoReal = receitaBruta - custoCarreteiro;
  const margemPercentReal = (resultadoLiquidoReal / receitaBruta) * 100;

  const predictedMargin =
    quote.pricing_breakdown?.profitability?.margemPercent ??
    quote.pricing_breakdown?.profitability?.margem_percent;

  const result: RealProfitabilityMetrics = {
    custo_carreteiro_real: custoCarreteiro,
    resultado_liquido_real: resultadoLiquidoReal,
    margem_percent_real: margemPercentReal,
    is_reconciled: reconciliation?.is_reconciled ?? false,
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
  historical: any,
  clientHistory: any[],
  realProfitability: RealProfitabilityMetrics | null,
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

**Comparativo historico (${historical.count} cotacoes ganhas)**:
- Margem media: ${historical.avg ? historical.avg.toFixed(1) + '%' : 'Sem dados'}
- Desvio padrao: ${historical.stdDev ? historical.stdDev.toFixed(1) + '%' : 'N/A'}

**Historico do cliente (${clientHistory.length} cotacoes)**:
- Margem media deste cliente: ${avgClientMargin ? avgClientMargin.toFixed(1) + '%' : 'Sem historico'}
- Cotacoes ganhas: ${clientHistory.filter((q: any) => q.stage === 'ganho').length}`;

  // Bloco de rentabilidade real — só presente quando a OS está finalizada
  if (realProfitability) {
    prompt += `\n\n--- Ordem de Servico Finalizada (Dados Reais) ---`;
    prompt += `\n**Custo Carreteiro (Real)**: R$ ${realProfitability.custo_carreteiro_real.toFixed(2)}`;
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

  if (realProfitability) {
    prompt += `\n\nAvalie a rentabilidade desta operacao comparando previsto vs real. Identifique os fatores que causaram desvio na margem e avalie se o preco estava adequado em relacao ao piso ANTT e ao historico.`;
  } else {
    prompt += `\n\nAvalie se esta cotacao e rentavel, se esta acima ou abaixo da media, e se o preco esta adequado em relacao ao piso ANTT.`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Worker principal
// ---------------------------------------------------------------------------

export async function executeQuoteProfitabilityWorker(ctx: WorkerContext) {
  const [{ quote, orderData, reconciliation }, historical] = await Promise.all([
    fetchQuoteData(ctx.sb, ctx.entityId),
    fetchHistoricalMargins(ctx.sb),
  ]);

  const clientHistory = await fetchClientHistory(ctx.sb, quote.client_name);

  // Busca ocorrências da OS (se existir e estiver entregue)
  let occurrences: OccurrenceDetail[] = [];
  if (orderData?.id && orderData.stage === 'entregue') {
    occurrences = await fetchOccurrences(ctx.sb, orderData.id);
  }

  // Calcula rentabilidade real (só quando OS entregue e custo disponível)
  const realProfitability =
    orderData?.stage === 'entregue'
      ? calcRealProfitability(quote, orderData, reconciliation, occurrences)
      : null;

  const prompt = buildPrompt(
    quote,
    historical,
    clientHistory,
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

  // Anexa dados reais calculados no worker (não delegados ao LLM)
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
