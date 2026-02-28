import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_OPERATIONAL_REPORT,
  MAX_TOKENS_OPERATIONAL_REPORT,
} from '../prompts/system_operational_report.ts';
import { validateAndParse, type OperationalReportResult } from '../prompts/schemas.ts';

// Nova interface para o contexto do worker refatorado
interface RefactoredWorkerContext {
  operationalData: {
    // Dados operacionais já pré-buscados pelo orquestrador
    allOrders: any[];
    createdOrders: any[];
    completedOrders: any[];
    occurrences: any[];
    complianceChecks: any[];
    pendingDocsCount: number;
  };
  reportType: 'daily' | 'weekly';
  model: string;
}

// Nova interface para o retorno do worker refatorado
interface RefactoredWorkerResult {
  analysis: OperationalReportResult;
  durationMs: number;
  provider: string;
  notifications: Array<{
    template: string;
    channel: string;
    payload: any;
    status: string;
    created_at: string;
  }>;
  operational_report_data: any; // Dados para inserção na tabela operational_reports
}

function groupBy(items: any[], key: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const k = String(item[key] || 'unknown');
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}

function buildPrompt(
  data: RefactoredWorkerContext['operationalData'],
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

  return (
    `Gere um relatório operacional ${reportType === 'daily' ? 'diário' : 'semanal'} da Vectra Cargo (${periodLabel}):\n\n` +
    `**Ordens de Serviço**:\n` +
    `- Distribuição por estágio: ${JSON.stringify(ordersByStage)}\n` +
    `- Criadas no período: ${data.createdOrders.length}\n` +
    `- Concluídas no período: ${data.completedOrders.length}\n` +
    `- Total ativas: ${data.allOrders.length}\n\n` +
    `**Ocorrências (${periodLabel})**:\n` +
    `- Total registradas: ${data.occurrences.length}\n` +
    `- Em aberto: ${openOccurrences.length}\n` +
    `- Críticas: ${criticalOccurrences.length}\n` +
    `- Por severidade: ${JSON.stringify(groupBy(data.occurrences, 'severity'))}\n\n` +
    `**Compliance**:\n` +
    `- Verificações realizadas: ${data.complianceChecks.length}\n` +
    `- Violações encontradas: ${violations.length}\n` +
    `- Tipos de violação: ${JSON.stringify(groupBy(violations, 'violation_type'))}\n\n` +
    `**Documentos**:\n` +
    `- Pendentes de envio/aprovação: ${data.pendingDocsCount}\n\n` +
    `Gere um resumo executivo formatado para WhatsApp (texto simples, curto, máx 500 chars) e identifique alertas prioritários.`
  );
}

export async function executeOperationalReportWorker(
  ctx: RefactoredWorkerContext
): Promise<RefactoredWorkerResult> {
  const { operationalData, reportType, model } = ctx;

  const prompt = buildPrompt(operationalData, reportType);

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
  analysis._model = model;
  analysis._cost_usd = 0; // O custo real será calculado pelo orquestrador
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const operationalReportData = {
    report_type: reportType,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 500),
    created_at: new Date().toISOString(),
  };

  const notifications: Array<{
    template: string;
    channel: string;
    payload: any;
    status: string;
    created_at: string;
  }> = [
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
    operational_report_data: operationalReportData,
  };
}
