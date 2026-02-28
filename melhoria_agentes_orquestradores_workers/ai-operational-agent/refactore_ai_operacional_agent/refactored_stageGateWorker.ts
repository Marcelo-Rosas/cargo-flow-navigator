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

// Nova interface para o contexto do worker refatorado
interface RefactoredWorkerContext {
  orderData: any; // Dados da ordem já pré-buscados pelo orquestrador
  targetStage: string;
}

// Nova interface para o retorno do worker refatorado
interface RefactoredWorkerResult {
  analysis: StageGateAnalysis;
  durationMs: number;
  provider: 'rules';
  notifications: Array<{
    template_key: string;
    entity_type: string;
    entity_id: string;
    metadata: any;
  }>;
  stage_gate_data: any; // Dados para inserção na tabela compliance_checks
}

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

export async function executeStageGateWorker(
  ctx: RefactoredWorkerContext
): Promise<RefactoredWorkerResult> {
  const startTime = Date.now();

  const { orderData, targetStage: rawTargetStage } = ctx;

  const currentStage = orderData.stage as Stage;
  const targetStage = rawTargetStage as Stage;

  if (!STAGE_ORDER.includes(currentStage)) {
    throw new Error(`Estágio atual inválido: ${currentStage}`);
  }
  if (!STAGE_ORDER.includes(targetStage)) {
    throw new Error(`Estágio-alvo inválido: ${targetStage}`);
  }

  let analysis: StageGateAnalysis;
  let notifications: Array<{
    template_key: string;
    entity_type: string;
    entity_id: string;
    metadata: any;
  }> = [];

  if (!isValidTransition(currentStage, targetStage)) {
    analysis = {
      allowed: false,
      missing_requirements: [
        `Transição inválida: ${currentStage} → ${targetStage}. Somente avanço sequencial é permitido.`,
      ],
      warnings: [],
    };
  } else {
    analysis = evaluateTransition(orderData, targetStage);
  }

  if (!analysis.allowed) {
    notifications.push({
      template_key: 'stage_gate_blocked',
      entity_type: 'order',
      entity_id: orderData.id,
      metadata: {
        current_stage: currentStage,
        target_stage: targetStage,
        missing_requirements: analysis.missing_requirements,
      },
    });
  }

  const durationMs = Date.now() - startTime;

  const stageGateData = {
    order_id: orderData.id,
    current_stage: currentStage,
    target_stage: targetStage,
    allowed: analysis.allowed,
    missing_requirements: analysis.missing_requirements,
    warnings: analysis.warnings,
    processed_at: new Date().toISOString(),
  };

  return {
    analysis,
    durationMs,
    provider: 'rules',
    notifications,
    stage_gate_data: stageGateData,
  };
}
