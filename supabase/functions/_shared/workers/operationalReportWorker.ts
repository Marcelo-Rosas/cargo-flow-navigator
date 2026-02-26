import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_OPERATIONAL_REPORT,
  MAX_TOKENS_OPERATIONAL_REPORT,
} from '../prompts/system_operational_report.ts';
import { validateAndParse, type OperationalReportResult } from '../prompts/schemas.ts';

interface WorkerContext {
  reportType: 'daily' | 'weekly';
  model: string;
  sb: any;
}

function getPeriodStart(reportType: 'daily' | 'weekly'): string {
  const hours = reportType === 'daily' ? 24 : 7 * 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function fetchOperationalData(sb: any, periodStart: string) {
  const [
    { data: allOrders },
    { data: createdOrders },
    { data: completedOrders },
    { data: occurrences },
    { data: complianceChecks },
    { count: pendingDocsCount },
  ] = await Promise.all([
    sb.from('orders').select('stage, created_at, value'),
    sb.from('orders').select('id').gte('created_at', periodStart),
    sb
      .from('orders')
      .select('id, created_at')
      .eq('stage', 'entregue')
      .gte('created_at', periodStart),
    sb.from('occurrences').select('severity, status, created_at').gte('created_at', periodStart),
    sb
      .from('compliance_checks')
      .select('status, violation_type, created_at')
      .gte('created_at', periodStart),
    sb.from('order_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return {
    allOrders: allOrders || [],
    createdOrders: createdOrders || [],
    completedOrders: completedOrders || [],
    occurrences: occurrences || [],
    complianceChecks: complianceChecks || [],
    pendingDocsCount: pendingDocsCount || 0,
  };
}

function buildPrompt(
  data: Awaited<ReturnType<typeof fetchOperationalData>>,
  reportType: 'daily' | 'weekly'
): string {
  const ordersByStage: Record<string, number> = {};
  for (const o of data.allOrders) {
    ordersByStage[o.stage] = (ordersByStage[o.stage] || 0) + 1;
  }

  const openOccurrences = data.occurrences.filter(
    (o: any) => o.status !== 'resolved' && o.status !== 'closed'
  );
  const criticalOccurrences = data.occurrences.filter(
    (o: any) => o.severity === 'critical' || o.severity === 'alta'
  );

  const violations = data.complianceChecks.filter(
    (c: any) => c.status === 'violation' || c.status === 'failed'
  );

  const periodLabel = reportType === 'daily' ? 'últimas 24 horas' : 'últimos 7 dias';

  return `Gere um relatório operacional ${reportType === 'daily' ? 'diário' : 'semanal'} da Vectra Cargo (${periodLabel}):

**Ordens de Serviço**:
- Distribuição por estágio: ${JSON.stringify(ordersByStage)}
- Criadas no período: ${data.createdOrders.length}
- Concluídas no período: ${data.completedOrders.length}
- Total ativas: ${data.allOrders.length}

**Ocorrências (${periodLabel})**:
- Total registradas: ${data.occurrences.length}
- Em aberto: ${openOccurrences.length}
- Críticas: ${criticalOccurrences.length}
- Por severidade: ${JSON.stringify(groupBy(data.occurrences, 'severity'))}

**Compliance**:
- Verificações realizadas: ${data.complianceChecks.length}
- Violações encontradas: ${violations.length}
- Tipos de violação: ${JSON.stringify(groupBy(violations, 'violation_type'))}

**Documentos**:
- Pendentes de envio/aprovação: ${data.pendingDocsCount}

Gere um resumo executivo formatado para WhatsApp (texto simples, curto, máx 500 chars) e identifique alertas prioritários.`;
}

function groupBy(items: any[], key: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const k = String(item[key] || 'unknown');
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}

export async function executeOperationalReportWorker(ctx: WorkerContext) {
  const periodStart = getPeriodStart(ctx.reportType);
  const data = await fetchOperationalData(ctx.sb, periodStart);

  const prompt = buildPrompt(data, ctx.reportType);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_OPERATIONAL_REPORT,
    maxTokens: MAX_TOKENS_OPERATIONAL_REPORT,
    analysisType: 'operational_report',
    entityType: null,
    entityId: null,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<OperationalReportResult>(result.text, 'operational_report');
  analysis._model = ctx.model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  await ctx.sb.from('operational_reports').insert({
    report_type: ctx.reportType,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 500),
    created_at: new Date().toISOString(),
  });

  await ctx.sb.from('notification_queue').insert({
    template: 'daily_operational_report',
    channel: 'both',
    payload: {
      summary: analysis.summary,
      risk: analysis.risk,
      alerts: analysis.alerts,
    },
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  return { analysis, durationMs, provider: result.provider };
}
