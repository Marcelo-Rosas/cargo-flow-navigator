import { callLLM } from '../aiClient.ts';
import { SYSTEM_PROMPT_APPROVAL, MAX_TOKENS_APPROVAL } from '../prompts/system_approval_summary.ts';
import { validateAndParse, type ApprovalSummaryResult } from '../prompts/schemas.ts';

interface WorkerContext {
  entityId: string;
  entityType: string;
  model: string;
  sb: any;
  previousInsights?: string;
}

async function fetchEntityData(sb: any, entityId: string, entityType: string) {
  let entityData: any = null;
  let contextInfo = '';

  if (entityType === 'financial_document') {
    const { data } = await sb.from('financial_documents').select('*').eq('id', entityId).single();
    entityData = data;

    if (data?.source_type === 'quote') {
      const { data: quote } = await sb
        .from('quotes')
        .select('quote_code, client_name, origin, destination, value, pricing_breakdown')
        .eq('id', data.source_id)
        .maybeSingle();
      if (quote) {
        const profitability = quote.pricing_breakdown?.profitability;
        const meta = quote.pricing_breakdown?.meta;
        contextInfo = `
Cotacao relacionada: ${quote.quote_code}
Cliente: ${quote.client_name}
Rota: ${quote.origin} -> ${quote.destination}
Valor da cotacao: R$ ${Number(quote.value || 0).toFixed(2)}
Margem: ${profitability?.margemPercent || 'N/A'}%
Status margem: ${meta?.marginStatus || 'N/A'}`;
      }
    }

    if (data?.source_type === 'order') {
      const { data: order } = await sb
        .from('orders')
        .select(
          'os_number, client_name, origin, destination, value, driver_name, carreteiro_real, pedagio_real, descarga_real, pricing_breakdown'
        )
        .eq('id', data.source_id)
        .maybeSingle();
      if (order) {
        contextInfo = `
OS relacionada: ${order.os_number}
Cliente: ${order.client_name}
Rota: ${order.origin} -> ${order.destination}
Valor: R$ ${Number(order.value || 0).toFixed(2)}
Motorista: ${order.driver_name || 'Nao atribuido'}`;
        if (order.carreteiro_real != null) {
          contextInfo += `
Carreteiro real: R$ ${Number(order.carreteiro_real).toFixed(2)}`;
        }
        const pb = order.pricing_breakdown as {
          components?: { toll?: number };
          profitability?: { custosDescarga?: number };
        } | null;
        if (order.pedagio_real != null || order.descarga_real != null) {
          contextInfo += `\nPrevisto vs Real:`;
          if (order.pedagio_real != null) {
            const prevToll = pb?.components?.toll ?? 0;
            contextInfo += `\n- Pedagogio: previsto R$ ${prevToll.toFixed(2)} / real R$ ${Number(order.pedagio_real).toFixed(2)}`;
          }
          if (order.descarga_real != null) {
            const prevDesc = pb?.profitability?.custosDescarga ?? 0;
            contextInfo += `\n- Descarga: previsto R$ ${prevDesc.toFixed(2)} / real R$ ${Number(order.descarga_real).toFixed(2)}`;
          }
        }
      }
    }
  }

  if (!entityData) throw new Error(`Entity not found: ${entityType}/${entityId}`);

  return { entityData, contextInfo };
}

async function fetchApprovalHistory(sb: any, entityType: string) {
  const { data: recentApprovals } = await sb
    .from('approval_requests')
    .select('status, entity_type, created_at, resolved_at')
    .eq('entity_type', entityType)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!recentApprovals || recentApprovals.length === 0) return '';

  const approved = recentApprovals.filter((a: any) => a.status === 'approved').length;
  const rejected = recentApprovals.filter((a: any) => a.status === 'rejected').length;
  const pending = recentApprovals.filter((a: any) => a.status === 'pending').length;

  return `\n**Historico de aprovacoes (${entityType}, ultimas ${recentApprovals.length})**:
- Aprovadas: ${approved}
- Rejeitadas: ${rejected}
- Pendentes: ${pending}`;
}

function buildPrompt(
  entityData: any,
  contextInfo: string,
  approvalHistory: string,
  previousInsights?: string
): string {
  const essentialFields: Record<string, unknown> = {
    id: entityData.id,
    code: entityData.code,
    type: entityData.type,
    status: entityData.status,
    total_amount: entityData.total_amount,
    source_type: entityData.source_type,
    source_id: entityData.source_id,
    created_at: entityData.created_at,
  };

  let prompt = `Gere um resumo executivo para aprovacao gerencial:

**Documento para aprovacao**:
${JSON.stringify(essentialFields, null, 2)}

**Contexto adicional**:
${contextInfo}
${approvalHistory}`;

  if (previousInsights) {
    prompt += `\n\n**Analises anteriores desta entidade**:\n${previousInsights}`;
  }

  prompt += `\n\nForneca um resumo claro e objetivo para que o gerente possa tomar uma decisao rapida de aprovar ou rejeitar. Inclua os principais riscos e a sua recomendacao.`;

  return prompt;
}

export async function executeApprovalSummaryWorker(ctx: WorkerContext) {
  const [{ entityData, contextInfo }, approvalHistory] = await Promise.all([
    fetchEntityData(ctx.sb, ctx.entityId, ctx.entityType),
    fetchApprovalHistory(ctx.sb, ctx.entityType),
  ]);

  const prompt = buildPrompt(entityData, contextInfo, approvalHistory, ctx.previousInsights);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_APPROVAL,
    maxTokens: MAX_TOKENS_APPROVAL,
    modelHint: 'anthropic',
    analysisType: 'approval_summary',
    entityType: ctx.entityType,
    entityId: ctx.entityId,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<ApprovalSummaryResult>(result.text, 'approval_summary');
  analysis._model = ctx.model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  await ctx.sb
    .from('approval_requests')
    .update({ ai_analysis: analysis })
    .eq('entity_type', ctx.entityType)
    .eq('entity_id', ctx.entityId)
    .eq('status', 'pending');

  await ctx.sb.from('ai_insights').insert({
    insight_type: 'approval_summary',
    entity_type: ctx.entityType,
    entity_id: ctx.entityId,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { analysis, durationMs, provider: result.provider };
}
