import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_DRIVER_QUALIFICATION,
  MAX_TOKENS_DRIVER_QUALIFICATION,
} from '../prompts/system_driver_qualification.ts';
import { validateAndParse, type DriverQualificationResult } from '../prompts/schemas.ts';

export interface DriverQualificationWorkerContext {
  orderData: any;
  model: string;
  previousInsights?: string;
}

export interface DriverQualificationWorkerResult {
  analysis: DriverQualificationResult;
  durationMs: number;
  provider: string;
  notifications: Array<{
    template_key: string;
    channel: string;
    recipient_phone?: string;
    entity_type: string;
    entity_id: string;
    status: string;
    payload: Record<string, unknown>;
  }>;
  ai_insight_data: Record<string, unknown>;
  driver_qualification_data: Record<string, unknown>;
}

function buildPrompt(order: any, previousInsights?: string): string {
  const boolLabel = (v: unknown) => (v ? 'Sim' : 'Não');

  let prompt = `Avalie a qualificação do motorista para esta Ordem de Serviço e calcule o risk_score conforme as regras de dedução:

**Ordem de Serviço**: ${order.os_number || 'N/A'}

**Dados do Motorista**:
- Nome: ${order.driver_name || 'Não informado'}
- Telefone: ${order.driver_phone || 'Não informado'}
- CNH: ${order.driver_cnh || 'Não informado'}
- ANTT/RNTRC: ${order.driver_antt || 'Não informado'}

**Dados do Veículo**:
- Placa: ${order.vehicle_plate || 'Não informada'}
- Marca: ${order.vehicle_brand || 'N/A'}
- Modelo: ${order.vehicle_model || 'N/A'}
- Tipo: ${order.vehicle_type_name || 'N/A'}

**Proprietário**:
- Nome: ${order.owner_name || 'Não informado'}
- Telefone: ${order.owner_phone || 'Não informado'}

**Documentos apresentados**:
- CNH em mãos: ${boolLabel(order.has_cnh)}
- CRLV em mãos: ${boolLabel(order.has_crlv)}
- Comprovante de residência: ${boolLabel(order.has_comp_residencia)}
- ANTT/RNTRC do motorista: ${boolLabel(order.has_antt_motorista)}`;

  if (previousInsights) {
    prompt += `\n\n**Análises anteriores desta OS**:\n${previousInsights}`;
  }

  prompt += `\n\nVerifique cada item do checklist, aplique as deduções de pontuação, identifique risk_flags com severidade e referência regulatória, e determine o qualification_status.`;

  return prompt;
}

function mapQualificationStatus(
  status: string | undefined
): 'pendente' | 'em_analise' | 'aprovado' | 'bloqueado' {
  if (status === 'aprovado') return 'aprovado';
  if (status === 'bloqueado') return 'bloqueado';
  return 'em_analise';
}

export async function executeDriverQualificationWorker(
  ctx: DriverQualificationWorkerContext
): Promise<DriverQualificationWorkerResult> {
  const { orderData, model, previousInsights } = ctx;
  const prompt = buildPrompt(orderData, previousInsights);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_DRIVER_QUALIFICATION,
    maxTokens: MAX_TOKENS_DRIVER_QUALIFICATION,
    modelHint: 'gemini',
    analysisType: 'driver_qualification',
    entityType: 'order',
    entityId: orderData.id,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<DriverQualificationResult>(result.text, 'driver_qualification');
  analysis._model = model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const dbStatus = mapQualificationStatus(analysis.qualification_status);

  const driver_qualification_data = {
    order_id: orderData.id,
    driver_name: orderData.driver_name || null,
    status: dbStatus,
    checklist: analysis.checklist || {},
    risk_flags: analysis.risk_flags || [],
    risk_score: analysis.risk_score ?? 50,
    ai_analysis: analysis,
  };

  const ai_insight_data = {
    insight_type: 'driver_qualification',
    entity_type: 'order',
    entity_id: orderData.id,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const notifications: DriverQualificationWorkerResult['notifications'] = [];
  const riskScore = Number(analysis.risk_score) || 0;
  if (riskScore < 70 && orderData.driver_phone) {
    notifications.push({
      template_key: 'driver_qualification_alert',
      channel: 'whatsapp',
      recipient_phone: orderData.driver_phone,
      entity_type: 'order',
      entity_id: orderData.id,
      status: 'pending',
      payload: {
        summary: analysis.summary,
        risk_score: analysis.risk_score,
        qualification_status: analysis.qualification_status,
      },
    });
  }

  return {
    analysis,
    durationMs,
    provider: result.provider,
    notifications,
    ai_insight_data,
    driver_qualification_data,
  };
}
