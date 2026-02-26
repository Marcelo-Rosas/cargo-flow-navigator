import { callLLM } from '../aiClient.ts';
import { SYSTEM_PROMPT_COMPLIANCE, MAX_TOKENS_COMPLIANCE } from '../prompts/system_compliance.ts';
import { validateAndParse, type ComplianceCheckResult } from '../prompts/schemas.ts';

type CheckType = 'pre_contratacao' | 'pre_coleta' | 'pre_entrega' | 'auditoria_periodica';

interface WorkerContext {
  orderId: string;
  checkType: CheckType;
  model: string;
  sb: any;
  previousInsights?: string;
}

interface RuleEvaluation {
  rule: string;
  passed: boolean;
  detail: string;
}

async function fetchOrderWithQuote(sb: any, orderId: string) {
  const { data: order, error } = await sb.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);

  let quote: any = null;
  if (order.quote_id) {
    const { data } = await sb
      .from('quotes')
      .select('*, pricing_breakdown')
      .eq('id', order.quote_id)
      .single();
    quote = data;
  }

  return { order, quote };
}

function evaluatePreContratacao(order: any): RuleEvaluation[] {
  return [
    {
      rule: 'CNH do motorista',
      passed: !!order.has_cnh,
      detail: order.has_cnh ? 'CNH presente no cadastro' : 'CNH do motorista não cadastrada',
    },
    {
      rule: 'CRLV do veículo',
      passed: !!order.has_crlv,
      detail: order.has_crlv ? 'CRLV presente' : 'CRLV do veículo não cadastrado',
    },
    {
      rule: 'Comprovante de residência',
      passed: !!order.has_comp_residencia,
      detail: order.has_comp_residencia
        ? 'Comprovante presente'
        : 'Comprovante de residência ausente',
    },
    {
      rule: 'Registro ANTT motorista',
      passed: !!order.has_antt_motorista,
      detail: order.has_antt_motorista ? 'RNTRC/ANTT válido' : 'Registro ANTT do motorista ausente',
    },
    {
      rule: 'TAG pedágio',
      passed: !!order.has_tag,
      detail: order.has_tag
        ? 'TAG de pedágio vinculada'
        : 'TAG de pedágio não vinculada ao veículo',
    },
  ];
}

function evaluatePreColeta(order: any, quote: any): RuleEvaluation[] {
  const breakdownMeta = quote?.pricing_breakdown?.meta;
  const anttFloor = Number(breakdownMeta?.antt?.total ?? breakdownMeta?.antt_piso_carreteiro ?? 0);
  const carreteiro = Number(order.carreteiro_real ?? 0);

  const rules: RuleEvaluation[] = [
    {
      rule: 'NF-e emitida',
      passed: !!order.has_nfe,
      detail: order.has_nfe ? 'NF-e presente' : 'NF-e não emitida',
    },
    {
      rule: 'CT-e emitido',
      passed: !!order.has_cte,
      detail: order.has_cte ? 'CT-e presente' : 'CT-e não emitido',
    },
    {
      rule: 'MDF-e emitido',
      passed: !!order.has_mdfe,
      detail: order.has_mdfe ? 'MDF-e presente' : 'MDF-e não emitido (obrigatório para trânsito)',
    },
    {
      rule: 'Análise GR (Gerenciamento de Risco)',
      passed: !!order.has_analise_gr,
      detail: order.has_analise_gr
        ? 'Análise GR aprovada'
        : 'Análise de gerenciamento de risco ausente',
    },
    {
      rule: 'Documento de rota',
      passed: !!order.has_doc_rota,
      detail: order.has_doc_rota ? 'Documento de rota presente' : 'Documento de rota ausente',
    },
    {
      rule: 'VPO (Vale-Pedágio Obrigatório)',
      passed: !!order.has_vpo,
      detail: order.has_vpo ? 'VPO emitido' : 'VPO não emitido — obrigatório antes da coleta',
    },
  ];

  if (anttFloor > 0) {
    const passesFloor = carreteiro >= anttFloor;
    rules.push({
      rule: 'Carreteiro >= Piso ANTT',
      passed: passesFloor,
      detail: passesFloor
        ? `Carreteiro R$ ${carreteiro.toFixed(2)} atende piso ANTT R$ ${anttFloor.toFixed(2)}`
        : `Carreteiro R$ ${carreteiro.toFixed(2)} ABAIXO do piso ANTT R$ ${anttFloor.toFixed(2)}`,
    });
  }

  return rules;
}

function evaluatePreEntrega(order: any): RuleEvaluation[] {
  return [
    {
      rule: 'POD (Comprovante de entrega)',
      passed: !!order.has_pod,
      detail: order.has_pod ? 'POD registrado' : 'POD não registrado — necessário para finalização',
    },
  ];
}

function evaluateRules(order: any, quote: any, checkType: CheckType): RuleEvaluation[] {
  switch (checkType) {
    case 'pre_contratacao':
      return evaluatePreContratacao(order);
    case 'pre_coleta':
      return evaluatePreColeta(order, quote);
    case 'pre_entrega':
      return evaluatePreEntrega(order);
    case 'auditoria_periodica':
      return [
        ...evaluatePreContratacao(order),
        ...evaluatePreColeta(order, quote),
        ...evaluatePreEntrega(order),
      ];
  }
}

function buildPrompt(
  order: any,
  quote: any,
  checkType: CheckType,
  rules: RuleEvaluation[],
  previousInsights?: string
): string {
  const passed = rules.filter((r) => r.passed).length;
  const failed = rules.filter((r) => !r.passed).length;

  let prompt = `Analise a conformidade regulatória desta ordem de serviço de transporte rodoviário:

**Ordem**: ${order.os_number || order.id}
**Cliente**: ${order.client_name || 'N/A'}
**Rota**: ${order.origin || 'N/A'} → ${order.destination || 'N/A'}
**Estágio atual**: ${order.stage}
**Tipo de verificação**: ${checkType}
**Motorista**: ${order.driver_name || 'Não atribuído'}
**Carreteiro real**: R$ ${Number(order.carreteiro_real || 0).toFixed(2)}

**Resultado da avaliação programática** (${passed} OK, ${failed} falhas):
${rules.map((r) => `- [${r.passed ? 'OK' : 'FALHA'}] ${r.rule}: ${r.detail}`).join('\n')}`;

  if (quote) {
    const breakdownMeta = quote.pricing_breakdown?.meta;
    const breakdownProfitability = quote.pricing_breakdown?.profitability;
    const anttFloor = breakdownMeta?.antt?.total ?? breakdownMeta?.antt_piso_carreteiro;
    prompt += `\n\n**Dados da cotação vinculada** (${quote.quote_code || quote.id}):
- Valor total: R$ ${Number(quote.value || 0).toFixed(2)}
- Piso ANTT carreteiro: R$ ${anttFloor ? Number(anttFloor).toFixed(2) : 'N/A'}
- Margem: ${breakdownProfitability?.margemPercent ?? breakdownProfitability?.margem_percent ?? 'N/A'}%`;
  }

  if (previousInsights) {
    prompt += `\n\n**Análises anteriores desta entidade**:\n${previousInsights}`;
  }

  prompt += `\n\nCom base nas regras avaliadas e no contexto operacional, classifique o risco de compliance, liste as violações encontradas com severidade e remediação, e forneça uma recomendação geral.`;

  return prompt;
}

async function notifyViolations(
  sb: any,
  orderId: string,
  checkType: CheckType,
  violations: Array<{ rule: string; severity: string }>
) {
  try {
    await sb.from('notification_logs').insert({
      template_key: 'compliance_violation',
      entity_type: 'order',
      entity_id: orderId,
      metadata: {
        check_type: checkType,
        violation_count: violations.length,
        critical_count: violations.filter((v) => v.severity === 'critical').length,
        rules: violations.map((v) => v.rule),
      },
    });
  } catch (e) {
    console.error('Failed to insert compliance notification:', e);
  }
}

export async function executeComplianceCheckWorker(ctx: WorkerContext) {
  const { order, quote } = await fetchOrderWithQuote(ctx.sb, ctx.orderId);

  const rules = evaluateRules(order, quote, ctx.checkType);
  const prompt = buildPrompt(order, quote, ctx.checkType, rules, ctx.previousInsights);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_COMPLIANCE,
    maxTokens: MAX_TOKENS_COMPLIANCE,
    modelHint: 'anthropic',
    analysisType: 'compliance_check',
    entityType: 'order',
    entityId: ctx.orderId,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<ComplianceCheckResult>(result.text, 'compliance_check');
  analysis._model = ctx.model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const failedRules = rules.filter((r) => !r.passed);
  if (!analysis.status && failedRules.length > 0) {
    analysis.status = 'warning';
  }
  if (!analysis.rules_evaluated) {
    analysis.rules_evaluated = rules;
  }

  await ctx.sb.from('compliance_checks').insert({
    order_id: ctx.orderId,
    check_type: ctx.checkType,
    result: analysis,
    status: analysis.status || (failedRules.length > 0 ? 'warning' : 'ok'),
  });

  await ctx.sb.from('ai_insights').insert({
    insight_type: 'compliance_check',
    entity_type: 'order',
    entity_id: ctx.orderId,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const violations = analysis.violations || [];
  if (violations.length > 0) {
    await notifyViolations(ctx.sb, ctx.orderId, ctx.checkType, violations);
  }

  return { analysis, durationMs, provider: result.provider };
}
