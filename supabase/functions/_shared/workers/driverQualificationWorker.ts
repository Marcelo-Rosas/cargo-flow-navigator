import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_DRIVER_QUALIFICATION,
  MAX_TOKENS_DRIVER_QUALIFICATION,
} from '../prompts/system_driver_qualification.ts';
import { validateAndParse, type DriverQualificationResult } from '../prompts/schemas.ts';

interface WorkerContext {
  orderId: string;
  model: string;
  sb: any;
  previousInsights?: string;
}

const ORDER_SELECT_FIELDS = [
  'os_number',
  'driver_name',
  'driver_phone',
  'driver_cnh',
  'driver_antt',
  'vehicle_plate',
  'vehicle_brand',
  'vehicle_model',
  'vehicle_type_name',
  'owner_name',
  'owner_phone',
  'has_cnh',
  'has_crlv',
  'has_comp_residencia',
  'has_antt_motorista',
].join(', ');

async function fetchOrderData(sb: any, orderId: string) {
  const { data: order, error } = await sb
    .from('orders')
    .select(ORDER_SELECT_FIELDS)
    .eq('id', orderId)
    .single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);
  return order;
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

export async function executeDriverQualificationWorker(ctx: WorkerContext) {
  const order = await fetchOrderData(ctx.sb, ctx.orderId);
  const prompt = buildPrompt(order, ctx.previousInsights);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_DRIVER_QUALIFICATION,
    maxTokens: MAX_TOKENS_DRIVER_QUALIFICATION,
    analysisType: 'driver_qualification',
    entityType: 'order',
    entityId: ctx.orderId,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<DriverQualificationResult>(result.text, 'driver_qualification');
  analysis._model = ctx.model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const dbStatus = mapQualificationStatus(analysis.qualification_status);

  const { data: existing } = await ctx.sb
    .from('driver_qualifications')
    .select('id')
    .eq('order_id', ctx.orderId)
    .maybeSingle();

  const qualRow = {
    order_id: ctx.orderId,
    driver_name: order.driver_name || null,
    status: dbStatus,
    checklist: analysis.checklist || {},
    risk_flags: analysis.risk_flags || [],
    risk_score: analysis.risk_score ?? 50,
    ai_analysis: analysis,
  };

  if (existing) {
    await ctx.sb.from('driver_qualifications').update(qualRow).eq('id', existing.id);
  } else {
    await ctx.sb.from('driver_qualifications').insert(qualRow);
  }

  await ctx.sb.from('ai_insights').insert({
    insight_type: 'driver_qualification',
    entity_type: 'order',
    entity_id: ctx.orderId,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const notifications: Array<{ template_key: string; channel: string; recipient_phone: string }> =
    [];

  const riskScore = Number(analysis.risk_score) || 0;
  if (riskScore < 70 && order.driver_phone) {
    await ctx.sb.from('notification_logs').insert({
      template_key: 'driver_qualification_alert',
      channel: 'whatsapp',
      recipient_phone: order.driver_phone,
      status: 'pending',
      entity_type: 'order',
      entity_id: ctx.orderId,
    });
    notifications.push({
      template_key: 'driver_qualification_alert',
      channel: 'whatsapp',
      recipient_phone: order.driver_phone,
    });
  }

  return { analysis, durationMs, provider: result.provider, notifications };
}
