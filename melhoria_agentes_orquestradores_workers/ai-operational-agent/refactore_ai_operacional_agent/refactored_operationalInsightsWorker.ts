import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_DASHBOARD,
  MAX_TOKENS_DASHBOARD,
} from '../prompts/system_dashboard_insights.ts';
import { validateAndParse, type DashboardInsightsResult } from '../prompts/schemas.ts';

// Nova interface para o contexto do worker refatorado
interface RefactoredWorkerContext {
  operationalData: {
    // Dados operacionais já pré-buscados e agregados pelo orquestrador
    orders: any[];
    occurrences: any[];
    complianceChecks: any[];
    driverQualifications: any[];
  };
  model: string;
}

// Nova interface para o retorno do worker refatorado
interface RefactoredWorkerResult {
  analysis: DashboardInsightsResult;
  durationMs: number;
  provider: string;
  ai_insight_data: any; // Dados para inserção na tabela ai_insights
}

function identifyBottlenecks(orders: any[]): Record<string, number> {
  const byStage: Record<string, number> = {};
  for (const o of orders) {
    byStage[o.stage] = (byStage[o.stage] || 0) + 1;
  }
  return byStage;
}

function computeAvgResolutionTime(occurrences: any[]): number {
  const resolved = occurrences.filter((o: any) => o.resolved_at);
  if (resolved.length === 0) return 0;

  const totalHours = resolved.reduce((sum: number, o: any) => {
    const created = new Date(o.created_at).getTime();
    const resolvedAt = new Date(o.resolved_at).getTime();
    return sum + (resolvedAt - created) / (1000 * 60 * 60);
  }, 0);

  return Math.round((totalHours / resolved.length) * 10) / 10;
}

function computeRouteIssues(orders: any[], occurrences: any[]): Record<string, number> {
  const orderRoutes: Record<string, string> = {};
  for (const o of orders) {
    if (o.origin && o.destination) {
      orderRoutes[o.id] = `${o.origin} → ${o.destination}`;
    }
  }

  const routeIssues: Record<string, number> = {};
  for (const occ of occurrences) {
    const route = orderRoutes[occ.order_id];
    if (route) {
      routeIssues[route] = (routeIssues[route] || 0) + 1;
    }
  }

  return Object.fromEntries(
    Object.entries(routeIssues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  );
}

function computeCarreteiroTrends(orders: any[]): {
  avg_real: number;
  avg_antt: number;
  deviation_pct: number;
} {
  const withValues = orders.filter(
    (o: any) => o.carreteiro_real != null && o.carreteiro_antt != null
  );
  if (withValues.length === 0) return { avg_real: 0, avg_antt: 0, deviation_pct: 0 };

  const avgReal =
    withValues.reduce((s: number, o: any) => s + Number(o.carreteiro_real), 0) / withValues.length;
  const avgAntt =
    withValues.reduce((s: number, o: any) => s + Number(o.carreteiro_antt), 0) / withValues.length;
  const deviationPct = avgAntt > 0 ? ((avgReal - avgAntt) / avgAntt) * 100 : 0;

  return {
    avg_real: Math.round(avgReal * 100) / 100,
    avg_antt: Math.round(avgAntt * 100) / 100,
    deviation_pct: Math.round(deviationPct * 10) / 10,
  };
}

function buildPrompt(data: RefactoredWorkerContext['operationalData']): string {
  const bottlenecks = identifyBottlenecks(data.orders);
  const avgResolution = computeAvgResolutionTime(data.occurrences);
  const routeIssues = computeRouteIssues(data.orders, data.occurrences);
  const carreteiroTrends = computeCarreteiroTrends(data.orders);

  const criticalOccurrences = data.occurrences.filter(
    (o: any) => o.severity === 'critical' || o.severity === 'alta'
  ).length;
  const openOccurrences = data.occurrences.filter(
    (o: any) => o.status !== 'resolved' && o.status !== 'closed'
  ).length;

  const expiringQualifications = data.driverQualifications.filter((q: any) => {
    if (!q.expires_at) return false;
    const daysUntilExpiry = (new Date(q.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }).length;

  const complianceViolations = data.complianceChecks.filter(
    (c: any) => c.status === 'violation' || c.status === 'failed'
  ).length;

  return (
    `Analise os dados operacionais dos últimos 30 dias da Vectra Cargo e gere insights operacionais acionáveis:\n\n` +
    `**Ordens de Serviço (30 dias)**:\n` +
    `- Total: ${data.orders.length}\n` +
    `- Distribuição por estágio (gargalos): ${JSON.stringify(bottlenecks)}\n\n` +
    `**Ocorrências**:\n` +
    `- Total: ${data.occurrences.length}\n` +
    `- Em aberto: ${openOccurrences}\n` +
    `- Críticas: ${criticalOccurrences}\n` +
    `- Tempo médio de resolução: ${avgResolution}h\n` +
    `- Rotas com mais problemas: ${JSON.stringify(routeIssues)}\n\n` +
    `**Compliance**:\n` +
    `- Verificações: ${data.complianceChecks.length}\n` +
    `- Violações: ${complianceViolations}\n` +
    `- Habilitações vencendo em 30 dias: ${expiringQualifications}\n\n` +
    `**Carreteiro (Real vs ANTT)**:\n` +
    `- Valor médio real: R$ ${carreteiroTrends.avg_real}\n` +
    `- Valor médio ANTT: R$ ${carreteiroTrends.avg_antt}\n` +
    `- Desvio: ${carreteiroTrends.deviation_pct}%\n\n` +
    `Gere 3-5 insights acionáveis focados em:\n` +
    `1. Estágios onde ordens acumulam (gargalos operacionais)\n` +
    `2. Padrões de ocorrências e tempos de resolução\n` +
    `3. Rotas problemáticas\n` +
    `4. Tendências de carreteiro real vs ANTT\n` +
    `5. Riscos de compliance e habilitações\n\n` +
    `Cada insight deve ter uma ação concreta sugerida.`
  );
}

export async function executeOperationalInsightsWorker(
  ctx: RefactoredWorkerContext
): Promise<RefactoredWorkerResult> {
  const { operationalData, model } = ctx;
  const prompt = buildPrompt(operationalData);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_DASHBOARD,
    maxTokens: MAX_TOKENS_DASHBOARD,
    analysisType: 'operational_insights',
    entityType: null,
    entityId: null,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<DashboardInsightsResult>(result.text, 'operational_insights');
  analysis._model = model;
  analysis._cost_usd = 0; // O custo real será calculado pelo orquestrador
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const aiInsightData = {
    insight_type: 'operational_insights',
    entity_type: null,
    entity_id: null,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  return {
    analysis,
    durationMs,
    provider: result.provider,
    ai_insight_data: aiInsightData,
  };
}
