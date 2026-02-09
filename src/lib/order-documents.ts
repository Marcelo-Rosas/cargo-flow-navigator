import { Database } from '@/integrations/supabase/types';

type OrderStage = Database['public']['Enums']['order_stage'];

export interface DocumentConfig {
  key: string;
  label: string;
  group: 'motorista' | 'fiscal' | 'entrega';
}

/**
 * Documentos por estágio da ordem de serviço.
 * REGRA: Documentos acumulam progressivamente - cada estágio mantém docs anteriores + adiciona novos.
 */
export const STAGE_DOCUMENTS = {
  'ordem_criada': [],
  'busca_motorista': [
    { key: 'has_cnh', label: 'CNH', group: 'motorista' },
    { key: 'has_crlv', label: 'CRLV', group: 'motorista' },
    { key: 'has_comp_residencia', label: 'Comp.Res.', group: 'motorista' },
    { key: 'has_antt_motorista', label: 'ANTT', group: 'motorista' }
  ],
  'documentacao': [
    { key: 'has_cnh', label: 'CNH', group: 'motorista' },
    { key: 'has_crlv', label: 'CRLV', group: 'motorista' },
    { key: 'has_comp_residencia', label: 'Comp.Res.', group: 'motorista' },
    { key: 'has_antt_motorista', label: 'ANTT', group: 'motorista' },
    { key: 'has_nfe', label: 'NF-e', group: 'fiscal' },
    { key: 'has_cte', label: 'CT-e', group: 'fiscal' },
    { key: 'has_mdfe', label: 'MDF-e', group: 'fiscal' }
  ],
  'coleta_realizada': [
    { key: 'has_cnh', label: 'CNH', group: 'motorista' },
    { key: 'has_crlv', label: 'CRLV', group: 'motorista' },
    { key: 'has_comp_residencia', label: 'Comp.Res.', group: 'motorista' },
    { key: 'has_antt_motorista', label: 'ANTT', group: 'motorista' },
    { key: 'has_nfe', label: 'NF-e', group: 'fiscal' },
    { key: 'has_cte', label: 'CT-e', group: 'fiscal' },
    { key: 'has_mdfe', label: 'MDF-e', group: 'fiscal' }
  ],
  'em_transito': [
    { key: 'has_cnh', label: 'CNH', group: 'motorista' },
    { key: 'has_crlv', label: 'CRLV', group: 'motorista' },
    { key: 'has_comp_residencia', label: 'Comp.Res.', group: 'motorista' },
    { key: 'has_antt_motorista', label: 'ANTT', group: 'motorista' },
    { key: 'has_nfe', label: 'NF-e', group: 'fiscal' },
    { key: 'has_cte', label: 'CT-e', group: 'fiscal' },
    { key: 'has_mdfe', label: 'MDF-e', group: 'fiscal' }
  ],
  'entregue': [
    { key: 'has_cnh', label: 'CNH', group: 'motorista' },
    { key: 'has_crlv', label: 'CRLV', group: 'motorista' },
    { key: 'has_comp_residencia', label: 'Comp.Res.', group: 'motorista' },
    { key: 'has_antt_motorista', label: 'ANTT', group: 'motorista' },
    { key: 'has_nfe', label: 'NF-e', group: 'fiscal' },
    { key: 'has_cte', label: 'CT-e', group: 'fiscal' },
    { key: 'has_mdfe', label: 'MDF-e', group: 'fiscal' },
    { key: 'has_pod', label: 'POD', group: 'entrega' }
  ]
} as const satisfies Record<OrderStage, readonly DocumentConfig[]>;

/**
 * Helper para obter documentos de um estágio específico
 */
export function getDocumentsForStage(stage: OrderStage): readonly DocumentConfig[] {
  return STAGE_DOCUMENTS[stage] || [];
}

/**
 * Helper para agrupar documentos por categoria
 */
export function groupDocumentsByCategory(docs: readonly DocumentConfig[]): Record<string, DocumentConfig[]> {
  return docs.reduce((acc, doc) => {
    if (!acc[doc.group]) acc[doc.group] = [];
    acc[doc.group].push(doc);
    return acc;
  }, {} as Record<string, DocumentConfig[]>);
}
