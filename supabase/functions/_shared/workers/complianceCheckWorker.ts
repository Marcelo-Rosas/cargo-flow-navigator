import { callLLM } from '../aiClient.ts';
import { SYSTEM_PROMPT_COMPLIANCE, MAX_TOKENS_COMPLIANCE } from '../prompts/system_compliance.ts';
import { validateAndParse, type ComplianceCheckResult } from '../prompts/schemas.ts';

export type CheckType = 'pre_contratacao' | 'pre_coleta' | 'pre_entrega' | 'auditoria_periodica';

export interface ComplianceCheckWorkerContext {
  orderData: any;
  quoteData: any | null;
  checkType: CheckType;
  model: string;
  previousInsights?: string;
}

export interface ComplianceCheckWorkerResult {
  analysis: ComplianceCheckResult;
  durationMs: number;
  provider: string;
  notifications: Array<{
    template_key: string;
    entity_type: string;
    entity_id: string;
    status: string;
    metadata: Record<string, unknown>;
  }>;
  ai_insight_data: Record<string, unknown>;
  compliance_check_data: Record<string, unknown>;
}

interface RuleEvaluation {
  rule: string;
  passed: boolean;
  detail: string;
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

// Tolerância: R$ 1,00 (arredondamento/centavos) — alinhada com views
const RECONCILIATION_TOLERANCE = 1;

type ProofClassification =
  | 'SEM_COMPROVANTES'
  | 'PENDENTE'
  | 'DIVERGENTE'
  | 'RECONCILIADO'
  | 'INDETERMINADO';

interface ProofWithRecon {
  amount: number | null;
  expected_amount: number | null;
  proof_type?: string;
}

function classifyPaymentReconciliation(
  expectedAmount: number,
  paidAmount: number,
  deltaAmount: number,
  proofs: ProofWithRecon[]
): { classification: ProofClassification; detail: string } {
  const hasProofWithUnreconciled = proofs.some((p) => {
    if (p.expected_amount == null) return false;
    const delta = (p.amount ?? 0) - Number(p.expected_amount);
    return Math.abs(delta) > RECONCILIATION_TOLERANCE;
  });

  // proofs_count = 0 e expected_amount > 0 → SEM_COMPROVANTES
  if (proofs.length === 0 && expectedAmount > 0) {
    return {
      classification: 'SEM_COMPROVANTES',
      detail: 'Comprovante de pagamento ausente',
    };
  }

  // paid_amount < expected_amount (delta negativo)
  if (paidAmount < expectedAmount) {
    if (hasProofWithUnreconciled) {
      return {
        classification: 'DIVERGENTE',
        detail: `Divergência: R$ ${paidAmount.toFixed(2)} pago vs R$ ${expectedAmount.toFixed(2)} esperado; algum comprovante com valor incorreto`,
      };
    }
    return {
      classification: 'PENDENTE',
      detail: `Saldo pendente: R$ ${paidAmount.toFixed(2)} pago vs R$ ${expectedAmount.toFixed(2)} esperado`,
    };
  }

  // paid_amount >= expected_amount (delta zero ou positivo)
  if (deltaAmount > RECONCILIATION_TOLERANCE) {
    return {
      classification: 'DIVERGENTE',
      detail: `Possível duplicidade/erro: overpayment de R$ ${deltaAmount.toFixed(2)}`,
    };
  }
  if (hasProofWithUnreconciled) {
    return {
      classification: 'DIVERGENTE',
      detail: `Algum comprovante com valor divergente do esperado`,
    };
  }
  return {
    classification: 'RECONCILIADO',
    detail: `Conciliado: R$ ${paidAmount.toFixed(2)} pago vs R$ ${expectedAmount.toFixed(2)} esperado`,
  };
}

function evaluatePaymentReconciliation(order: {
  carreteiro_real?: number | null;
  payment_proofs?: Array<{
    amount?: number | null;
    expected_amount?: number | null;
    proof_type?: string;
  }>;
  reconciliation?: {
    expected_amount?: number | null;
    paid_amount?: number | null;
    delta_amount?: number | null;
    is_reconciled?: boolean | null;
  } | null;
}): RuleEvaluation[] {
  const carreteiroReal = Number(order.carreteiro_real ?? 0);
  const proofs: ProofWithRecon[] = (order.payment_proofs || []).map((p) => ({
    amount: p.amount != null ? Number(p.amount) : null,
    expected_amount: p.expected_amount != null ? Number(p.expected_amount) : null,
    proof_type: p.proof_type,
  }));
  const recon = order.reconciliation;

  if (carreteiroReal <= 0) {
    return [];
  }

  const expectedAmount = Number(recon?.expected_amount ?? order.carreteiro_real ?? 0);
  const paidAmount = Number(recon?.paid_amount ?? 0);
  const deltaAmount = Number(recon?.delta_amount ?? paidAmount - expectedAmount);

  // Backfill parcial: proof sem expected_amount → INDETERMINADO
  const hasProofWithoutExpected = proofs.some((p) => p.expected_amount == null);
  if (hasProofWithoutExpected) {
    return [
      {
        rule: 'Comprovante de pagamento ao carreteiro',
        passed: false,
        detail: 'Proof sem expected_amount; verificar backfill',
      },
    ];
  }

  const { classification, detail } = classifyPaymentReconciliation(
    expectedAmount,
    paidAmount,
    deltaAmount,
    proofs
  );

  return [
    {
      rule: 'Comprovante de pagamento ao carreteiro',
      passed: classification === 'RECONCILIADO',
      detail,
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
        ...evaluatePaymentReconciliation(order),
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

export async function executeComplianceCheckWorker(
  ctx: ComplianceCheckWorkerContext
): Promise<ComplianceCheckWorkerResult> {
  const { orderData, quoteData, checkType, model, previousInsights } = ctx;

  const rules = evaluateRules(orderData, quoteData, checkType);
  const prompt = buildPrompt(orderData, quoteData, checkType, rules, previousInsights);

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_COMPLIANCE,
    maxTokens: MAX_TOKENS_COMPLIANCE,
    modelHint: 'anthropic',
    analysisType: 'compliance_check',
    entityType: 'order',
    entityId: orderData.id,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<ComplianceCheckResult>(result.text, 'compliance_check');
  analysis._model = model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  const failedRules = rules.filter((r) => !r.passed);
  if (!analysis.status && failedRules.length > 0) analysis.status = 'warning';
  if (!analysis.rules_evaluated) analysis.rules_evaluated = rules;

  const compliance_check_data = {
    order_id: orderData.id,
    check_type: checkType,
    result: analysis,
    status: analysis.status || (failedRules.length > 0 ? 'warning' : 'ok'),
  };

  const ai_insight_data = {
    insight_type: 'compliance_check',
    entity_type: 'order',
    entity_id: orderData.id,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const violations = analysis.violations || [];
  const notifications: ComplianceCheckWorkerResult['notifications'] = [];
  if (violations.length > 0) {
    notifications.push({
      template_key: 'compliance_violation',
      entity_type: 'order',
      entity_id: orderData.id,
      status: 'pending',
      metadata: {
        check_type: checkType,
        violation_count: violations.length,
        critical_count: violations.filter((v) => v.severity === 'critical').length,
        rules: violations.map((v) => v.rule),
      },
    });
  }

  return {
    analysis,
    durationMs,
    provider: result.provider,
    notifications,
    ai_insight_data,
    compliance_check_data,
  };
}
