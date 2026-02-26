interface WorkerContext {
  orderId: string;
  targetStage: string;
  model: string;
  sb: any;
}

interface StageGateAnalysis {
  allowed: boolean;
  missing_requirements: string[];
  warnings: string[];
}

const STAGE_ORDER = [
  'ordem_criada',
  'busca_motorista',
  'documentacao',
  'coleta_realizada',
  'em_transito',
  'entregue',
] as const;

type Stage = (typeof STAGE_ORDER)[number];

function isValidTransition(current: Stage, target: Stage): boolean {
  const currentIdx = STAGE_ORDER.indexOf(current);
  const targetIdx = STAGE_ORDER.indexOf(target);
  return targetIdx === currentIdx + 1;
}

function evaluateTransition(order: any, target: Stage): StageGateAnalysis {
  const missing: string[] = [];
  const warnings: string[] = [];

  switch (target) {
    case 'busca_motorista':
      break;

    case 'documentacao': {
      if (!(Number(order.carreteiro_real) > 0)) missing.push('carreteiro_real deve ser > 0');
      if (!order.has_cnh) missing.push('CNH do motorista ausente');
      if (!order.has_crlv) missing.push('CRLV do veículo ausente');
      if (!order.has_comp_residencia) missing.push('Comprovante de residência ausente');
      if (!order.has_antt_motorista) missing.push('Registro ANTT do motorista ausente');
      break;
    }

    case 'coleta_realizada': {
      if (!order.has_nfe) missing.push('NF-e não emitida');
      if (!order.has_cte) missing.push('CT-e não emitido');
      if (!order.has_analise_gr) missing.push('Análise de Gerenciamento de Risco ausente');
      if (!order.has_doc_rota) missing.push('Documento de rota ausente');
      if (!order.has_vpo) missing.push('VPO (Vale-Pedágio Obrigatório) não emitido');
      break;
    }

    case 'em_transito': {
      if (!order.eta) warnings.push('ETA previsto não informado — recomendável preencher');
      break;
    }

    case 'entregue': {
      if (!order.has_pod) missing.push('POD (Comprovante de entrega) ausente');
      break;
    }

    default:
      missing.push(`Estágio-alvo desconhecido: ${target}`);
  }

  return {
    allowed: missing.length === 0,
    missing_requirements: missing,
    warnings,
  };
}

async function notifyStageBlocked(
  sb: any,
  orderId: string,
  currentStage: string,
  targetStage: string,
  missing: string[]
) {
  try {
    await sb.from('notification_logs').insert({
      template_key: 'stage_gate_blocked',
      entity_type: 'order',
      entity_id: orderId,
      metadata: {
        current_stage: currentStage,
        target_stage: targetStage,
        missing_requirements: missing,
      },
    });
  } catch (e) {
    console.error('Failed to insert stage-gate notification:', e);
  }
}

export async function executeStageGateWorker(ctx: WorkerContext) {
  const startTime = Date.now();

  const { data: order, error } = await ctx.sb
    .from('orders')
    .select('*')
    .eq('id', ctx.orderId)
    .single();
  if (error || !order) throw new Error(`Order not found: ${ctx.orderId}`);

  const currentStage = order.stage as Stage;
  const targetStage = ctx.targetStage as Stage;

  if (!STAGE_ORDER.includes(currentStage)) {
    throw new Error(`Estágio atual inválido: ${currentStage}`);
  }
  if (!STAGE_ORDER.includes(targetStage)) {
    throw new Error(`Estágio-alvo inválido: ${targetStage}`);
  }

  if (!isValidTransition(currentStage, targetStage)) {
    const durationMs = Date.now() - startTime;
    return {
      analysis: {
        allowed: false,
        missing_requirements: [
          `Transição inválida: ${currentStage} → ${targetStage}. Somente avanço sequencial é permitido.`,
        ],
        warnings: [],
      } satisfies StageGateAnalysis,
      durationMs,
      provider: 'rules' as const,
    };
  }

  const analysis = evaluateTransition(order, targetStage);
  const durationMs = Date.now() - startTime;

  if (!analysis.allowed) {
    await notifyStageBlocked(
      ctx.sb,
      ctx.orderId,
      currentStage,
      targetStage,
      analysis.missing_requirements
    );
  }

  return { analysis, durationMs, provider: 'rules' as const };
}
