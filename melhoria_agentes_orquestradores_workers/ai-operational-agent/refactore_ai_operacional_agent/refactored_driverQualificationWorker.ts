import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_DRIVER_QUALIFICATION,
  MAX_TOKENS_DRIVER_QUALIFICATION,
} from '../prompts/system_driver_qualification.ts';
import { validateAndParse, type DriverQualificationResult } from '../prompts/schemas.ts';

// Nova interface para o contexto do worker refatorado
interface RefactoredWorkerContext {
  orderData: any; // Dados da ordem já pré-buscados pelo orquestrador
  model: string;
  previousInsights?: string; // Insights anteriores, se houver
}

// Nova interface para o retorno do worker refatorado
interface RefactoredWorkerResult {
  analysis: DriverQualificationResult;
  durationMs: number;
  provider: string;
  notifications: Array<{ template_key: string; channel: string; recipient_phone?: string; payload: any }>;
  ai_insight_data: any; // Dados para inserção na tabela ai_insights
  driver_qualification_data: any; // Dados para inserção/atualização na tabela driver_qualifications
}

function buildPrompt(order: any, previousInsights?: string): string {
  const boolLabel = (v: unknown) => (v ? 'Sim' : 'Não');

  let prompt = `Avalie a qualificação do motorista para esta Ordem de Serviço e calcule o risk_score conforme as regras de dedução:\n\n` +
             `**Ordem de Serviço**: ${order.os_number || 'N/A'}\n\n` +
             `**Dados do Motorista**:\n` +
             `- Nome: ${order.driver_name || 'Não informado'}\n` +
             `- Telefone: ${order.driver_phone || 'Não informado'}\n` +
             `- CNH: ${order.driver_cnh || 'Não informado'}\n` +
             `- ANTT/RNTRC: ${order.driver_antt || 'Não informado'}\n\n` +
             `**Dados do Veículo**:\n` +
             `- Placa: ${order.vehicle_plate || 'Não informada'}\n` +
             `- Marca: ${order.vehicle_brand || 'N/A'}\n` +
             `- Modelo: ${order.vehicle_model || 'N/A'}\n` +
             `- Tipo: ${order.vehicle_type_name || 'N/A'}\n\n` +
             `**Proprietário**:\n` +
             `- Nome: ${order.owner_name || 'Não informado'}\n` +
             `- Telefone: ${order.owner_phone || 'Não informado'}\n\n` +
             `**Documentos apresentados**:\n` +
             `- CNH em mãos: ${boolLabel(order.has_cnh)}\n` +
             `- CRLV em mãos: ${boolLabel(order.has_crlv)}\n` +
             `- Comprovante de residência: ${boolLabel(order.has_comp_residencia)}\n` +
             `- ANTT/RNTRC do motorista: ${boolLabel(order.has_antt_motorista)}`;

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

export async function executeDriverQualificationWorker(ctx: RefactoredWorkerContext): Promise<RefactoredWorkerResult> {
  const { orderData, model, previousInsights } = ctx;
  const prompt = buildPrompt(orderData, previousInsights);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_DRIVER_QUALIFICATION,
    maxTokens: MAX_TOKENS_DRIVER_QUALIFICATION,
    analysisType: 'driver_qualification',
    entityType: 'order',
    entityId: orderData.id, // Assumindo que orderData.id é o ID da ordem
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<DriverQualificationResult>(result.text, 'driver_qualification');
  analysis._model = model;
  analysis._cost_usd = 0; // O custo real será calculado pelo orquestrador
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const dbStatus = mapQualificationStatus(analysis.qualification_status);

  const driverQualificationData = {
    order_id: orderData.id,
    driver_name: orderData.driver_name || null,
    status: dbStatus,
    checklist: analysis.checklist || {},
    risk_flags: analysis.risk_flags || [],
    risk_score: analysis.risk_score ?? 50,
    ai_analysis: analysis,
  };

  const aiInsightData = {
    insight_type: 'driver_qualification',
    entity_type: 'order',
    entity_id: orderData.id,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const notifications: Array<{ template_key: string; channel: string; recipient_phone?: string; payload: any }> = [];

  const riskScore = Number(analysis.risk_score) || 0;
  if (riskScore < 70 && orderData.driver_phone) {
    notifications.push({
      template_key: 'driver_qualification_alert',
      channel: 'whatsapp',
      recipient_phone: orderData.driver_phone,
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
    ai_insight_data: aiInsightData,
    driver_qualification_data: driverQualificationData,
  };
}
