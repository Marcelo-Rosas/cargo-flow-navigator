import { Database } from '@/integrations/supabase/types';

type OrderStage = Database['public']['Enums']['order_stage'];

export interface DocumentConfig {
  key: string;
  label: string;
  group: 'motorista' | 'fiscal' | 'entrega';
}

/**
 * Fluxo de estágios (ordem).
 * Usado para entender "próxima fase".
 */
export const ORDER_STAGE_FLOW: readonly OrderStage[] = [
  'ordem_criada',
  'busca_motorista',
  'documentacao',
  'coleta_realizada',
  'em_transito',
  'entregue',
] as const;

/**
 * Requisitos (documentos) por estágio ATUAL para avançar para a PRÓXIMA fase.
 * REGRA: não herdar automaticamente do estágio anterior; requisitos são declarados por gate.
 */
export const STAGE_NEXT_REQUIREMENTS = {
  ordem_criada: [],

  // Para sair de "busca_motorista" e ir para "documentacao"
  busca_motorista: [
    { key: 'has_cnh', label: 'CNH', group: 'motorista' },
    { key: 'has_crlv', label: 'CRLV', group: 'motorista' },
    { key: 'has_comp_residencia', label: 'Comp.Res.', group: 'motorista' },
    { key: 'has_antt_motorista', label: 'ANTT', group: 'motorista' },
  ],

  // Para sair de "documentacao" e ir para "coleta_realizada"
  documentacao: [
    { key: 'has_nfe', label: 'NF-e', group: 'fiscal' },
    { key: 'has_cte', label: 'CT-e', group: 'fiscal' },
    { key: 'has_mdfe', label: 'MDF-e', group: 'fiscal' },
    { key: 'has_analise_gr', label: 'Análise GR', group: 'fiscal' },
    { key: 'has_doc_rota', label: 'Doc. Rota', group: 'fiscal' },
    { key: 'has_vpo', label: 'VPO', group: 'fiscal' },
  ],

  // Para sair de "coleta_realizada" e ir para "em_transito"
  coleta_realizada: [],

  // Para sair de "em_transito" e ir para "entregue"
  em_transito: [{ key: 'has_pod', label: 'POD', group: 'entrega' }],

  // Último estágio não tem próxima fase
  entregue: [],
} as const satisfies Record<OrderStage, readonly DocumentConfig[]>;

export function getNextStage(stage: OrderStage): OrderStage | null {
  const idx = ORDER_STAGE_FLOW.indexOf(stage);
  if (idx < 0) return null;
  return ORDER_STAGE_FLOW[idx + 1] ?? null;
}

/**
 * Helper: requisitos do estágio atual para avançar para a próxima fase.
 */
export function getNextStageRequirements(stage: OrderStage): readonly DocumentConfig[] {
  return STAGE_NEXT_REQUIREMENTS[stage] || [];
}

/**
 * Helper para agrupar documentos por categoria
 */
export function groupDocumentsByCategory(
  docs: readonly DocumentConfig[]
): Record<string, DocumentConfig[]> {
  return docs.reduce(
    (acc, doc) => {
      if (!acc[doc.group]) acc[doc.group] = [];
      acc[doc.group].push(doc);
      return acc;
    },
    {} as Record<string, DocumentConfig[]>
  );
}
