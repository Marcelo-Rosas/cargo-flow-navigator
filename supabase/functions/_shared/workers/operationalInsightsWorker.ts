import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_OPERATIONAL_INSIGHTS,
  MAX_TOKENS_OPERATIONAL_INSIGHTS,
} from '../prompts/system_operational_insights.ts';
import { validateAndParse, type DashboardInsightsResult } from '../prompts/schemas.ts';

export interface OperationalInsightsData {
  orders: any[];
  occurrences: any[];
  complianceChecks: any[];
  driverQualifications: any[];
}

export interface OperationalInsightsWorkerContext {
  operationalData: OperationalInsightsData;
  model: string;
}

export interface OperationalInsightsWorkerResult {
  analysis: DashboardInsightsResult;
  durationMs: number;
  provider: string;
  ai_insight_data: Record<string, unknown>;
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
    if (route) routeIssues[route] = (routeIssues[route] || 0) + 1;
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

function buildPrompt(data: OperationalInsightsData): string {
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

  return `Analise os dados operacionais dos últimos 30 dias da Vectra Cargo e gere insights operacionais acionáveis:

**Ordens de Serviço (30 dias)**:
- Total: ${data.orders.length}
- Distribuição por estágio (gargalos): ${JSON.stringify(bottlenecks)}

**Ocorrências**:
- Total: ${data.occurrences.length}
- Em aberto: ${openOccurrences}
- Críticas: ${criticalOccurrences}
- Tempo médio de resolução: ${avgResolution}h
- Rotas com mais problemas: ${JSON.stringify(routeIssues)}

**Compliance**:
- Verificações: ${data.complianceChecks.length}
- Violações: ${complianceViolations}
- Habilitações vencendo em 30 dias: ${expiringQualifications}

**Carreteiro (Real vs ANTT)**:
- Valor médio real: R$ ${carreteiroTrends.avg_real}
- Valor médio ANTT: R$ ${carreteiroTrends.avg_antt}
- Desvio: ${carreteiroTrends.deviation_pct}%

Gere 3-5 insights acionáveis focados em:
1. Estágios onde ordens acumulam (gargalos operacionais)
2. Padrões de ocorrências e tempos de resolução
3. Rotas problemáticas
4. Tendências de carreteiro real vs ANTT
5. Riscos de compliance e habilitações

Cada insight deve ter uma ação concreta sugerida.`;
}

export async function executeOperationalInsightsWorker(
  ctx: OperationalInsightsWorkerContext
): Promise<OperationalInsightsWorkerResult> {
  const { operationalData, model } = ctx;
  const prompt = buildPrompt(operationalData);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_OPERATIONAL_INSIGHTS,
    maxTokens: MAX_TOKENS_OPERATIONAL_INSIGHTS,
    modelHint: 'openai',
    analysisType: 'operational_insights',
    entityType: null,
    entityId: null,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<DashboardInsightsResult>(result.text, 'operational_insights');
  analysis._model = model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const ai_insight_data = {
    insight_type: 'operational_insights',
    entity_type: null,
    entity_id: null,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  return { analysis, durationMs, provider: result.provider, ai_insight_data };
}
