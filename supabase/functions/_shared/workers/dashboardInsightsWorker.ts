import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_DASHBOARD,
  MAX_TOKENS_DASHBOARD,
} from '../prompts/system_dashboard_insights.ts';
import { validateAndParse, type DashboardInsightsResult } from '../prompts/schemas.ts';

interface WorkerContext {
  model: string;
  sb: any;
  crossEntityContext?: string;
}

async function fetchOperationalData(sb: any) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: quotes }, { data: orders }, { data: financialDocs }, { count: pendingApprovals }] =
    await Promise.all([
      sb
        .from('quotes')
        .select('stage, value, created_at, client_name, pricing_breakdown')
        .gte('created_at', thirtyDaysAgo),
      sb.from('orders').select('stage, value, created_at').gte('created_at', thirtyDaysAgo),
      sb
        .from('financial_documents')
        .select('type, status, total_amount, created_at')
        .gte('created_at', thirtyDaysAgo),
      sb
        .from('approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

  return {
    quotes: quotes || [],
    orders: orders || [],
    financialDocs: financialDocs || [],
    pendingApprovals: pendingApprovals || 0,
  };
}

async function fetchRecentAiInsights(sb: any) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentInsights } = await sb
    .from('ai_insights')
    .select('insight_type, analysis, created_at')
    .in('insight_type', ['quote_profitability', 'financial_anomaly'])
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!recentInsights || recentInsights.length === 0) return '';

  const highRiskQuotes = recentInsights.filter(
    (i: any) => i.insight_type === 'quote_profitability' && i.analysis?.risk === 'alto'
  ).length;
  const anomalies = recentInsights.filter(
    (i: any) => i.insight_type === 'financial_anomaly' && i.analysis?.anomaly_detected
  ).length;
  const lowMarginQuotes = recentInsights.filter(
    (i: any) =>
      i.insight_type === 'quote_profitability' && (i.analysis?.metrics?.margem_percent ?? 100) < 10
  ).length;

  return `\n**Padroes recentes identificados por outros agentes (7 dias)**:
- Cotacoes com risco alto: ${highRiskQuotes}
- Documentos com anomalia detectada: ${anomalies}
- Cotacoes com margem < 10%: ${lowMarginQuotes}
- Total de analises realizadas: ${recentInsights.length}`;
}

function buildPrompt(
  data: Awaited<ReturnType<typeof fetchOperationalData>>,
  crossEntityContext: string
): string {
  const quotesByStage: Record<string, number> = {};
  let totalQuoteValue = 0;
  const margins: number[] = [];

  for (const q of data.quotes) {
    quotesByStage[q.stage] = (quotesByStage[q.stage] || 0) + 1;
    totalQuoteValue += Number(q.value) || 0;
    const m =
      q.pricing_breakdown?.profitability?.margemPercent ??
      q.pricing_breakdown?.profitability?.margem_percent;
    if (m != null) margins.push(m);
  }

  const ordersByStage: Record<string, number> = {};
  for (const o of data.orders) {
    ordersByStage[o.stage] = (ordersByStage[o.stage] || 0) + 1;
  }

  const totalQuotes = data.quotes.length;
  const wonQuotes = quotesByStage['ganho'] || 0;
  const conversionRate = totalQuotes > 0 ? ((wonQuotes / totalQuotes) * 100).toFixed(1) : '0';

  const avgMargin =
    margins.length > 0 ? (margins.reduce((a, b) => a + b, 0) / margins.length).toFixed(1) : 'N/A';

  let totalReceivable = 0;
  let totalPayable = 0;
  for (const fd of data.financialDocs) {
    if (fd.type === 'FAT') totalReceivable += Number(fd.total_amount) || 0;
    if (fd.type === 'PAG') totalPayable += Number(fd.total_amount) || 0;
  }

  return `Analise os dados operacionais dos ultimos 30 dias da Vectra Cargo e gere insights executivos:

**Pipeline Comercial (30 dias)**:
- Total de cotacoes: ${totalQuotes}
- Cotacoes por stage: ${JSON.stringify(quotesByStage)}
- Valor total das cotacoes: R$ ${totalQuoteValue.toFixed(2)}
- Taxa de conversao: ${conversionRate}%
- Margem media das cotacoes: ${avgMargin}%

**Operacoes**:
- Total de ordens: ${data.orders.length}
- Ordens por stage: ${JSON.stringify(ordersByStage)}

**Financeiro**:
- Total a receber (FAT): R$ ${totalReceivable.toFixed(2)}
- Total a pagar (PAG): R$ ${totalPayable.toFixed(2)}
- Resultado bruto estimado: R$ ${(totalReceivable - totalPayable).toFixed(2)}
- Documentos financeiros gerados: ${data.financialDocs.length}

**Aprovacoes pendentes**: ${data.pendingApprovals}
${crossEntityContext}

Gere 3-5 insights acionaveis. Foque em oportunidades de melhoria, gargalos operacionais e alertas importantes. Cada insight deve ter uma acao concreta sugerida.`;
}

export async function executeDashboardInsightsWorker(ctx: WorkerContext) {
  const [operationalData, crossContext] = await Promise.all([
    fetchOperationalData(ctx.sb),
    fetchRecentAiInsights(ctx.sb),
  ]);

  const fullCrossContext = [crossContext, ctx.crossEntityContext].filter(Boolean).join('\n');
  const prompt = buildPrompt(operationalData, fullCrossContext);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_DASHBOARD,
    maxTokens: MAX_TOKENS_DASHBOARD,
    modelHint: 'anthropic',
    analysisType: 'dashboard_insights',
    entityType: null,
    entityId: null,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<DashboardInsightsResult>(result.text, 'dashboard_insights');
  analysis._model = ctx.model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  await ctx.sb.from('ai_insights').insert({
    insight_type: 'dashboard_insights',
    entity_type: null,
    entity_id: null,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return { analysis, durationMs, provider: result.provider };
}
