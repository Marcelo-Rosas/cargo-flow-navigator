import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_OPERATIONAL_REPORT,
  MAX_TOKENS_OPERATIONAL_REPORT,
} from '../prompts/system_operational_report.ts';
import { validateAndParse, type OperationalReportResult } from '../prompts/schemas.ts';

export interface OperationalReportData {
  allOrders: any[];
  createdOrders: any[];
  completedOrders: any[];
  occurrences: any[];
  complianceChecks: any[];
  pendingDocsCount: number;
}

export interface OperationalReportWorkerContext {
  operationalData: OperationalReportData;
  reportType: 'daily' | 'weekly';
  model: string;
}

export interface OperationalReportWorkerResult {
  analysis: OperationalReportResult;
  durationMs: number;
  provider: string;
  notifications: Array<{
    template: string;
    channel: string;
    payload: Record<string, unknown>;
    status: string;
    created_at: string;
  }>;
  operational_report_data: Record<string, unknown>;
}

function groupBy(items: any[], key: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const k = String(item[key] || 'unknown');
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}

function buildPrompt(data: OperationalReportData, reportType: 'daily' | 'weekly'): string {
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

export async function executeOperationalReportWorker(
  ctx: OperationalReportWorkerContext
): Promise<OperationalReportWorkerResult> {
  const { operationalData, reportType, model } = ctx;

  const prompt = buildPrompt(operationalData, reportType);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_OPERATIONAL_REPORT,
    maxTokens: MAX_TOKENS_OPERATIONAL_REPORT,
    modelHint: 'gemini',
    analysisType: 'operational_report',
    entityType: null,
    entityId: null,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<OperationalReportResult>(result.text, 'operational_report');
  analysis._model = model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const operational_report_data = {
    report_type: reportType,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 500),
    created_at: new Date().toISOString(),
  };

  const notifications: OperationalReportWorkerResult['notifications'] = [
    {
      template: 'daily_operational_report',
      channel: 'both',
      payload: {
        summary: analysis.summary,
        risk: analysis.risk,
        alerts: analysis.alerts,
      },
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  ];

  return {
    analysis,
    durationMs,
    provider: result.provider,
    notifications,
    operational_report_data,
  };
}
