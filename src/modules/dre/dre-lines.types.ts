/**
 * DRE Operacional Comparativa — contrato canônico.
 * Estrutura contábil lado a lado, com shape explícito para detalhe e consolidados.
 */

export type DreLineCode =
  | 'faturamento_bruto'
  | 'impostos'
  | 'das'
  | 'icms'
  | 'receita_liquida'
  | 'overhead'
  | 'custos_diretos'
  | 'custo_motorista'
  | 'pedagio'
  | 'carga_descarga'
  | 'espera'
  | 'taxas_condicionais'
  | 'outros_custos'
  | 'resultado_liquido'
  | 'margem_liquida';

export type DreLineGroup = 'receita' | 'impostos' | 'custos' | 'resultado';
export type SignType = 'positive' | 'negative';
export type BadgeDirection = 'up' | 'down' | 'neutral';
export type BadgeColor = 'green' | 'red' | 'neutral';
export type PeriodType = 'detail' | 'month' | 'quarter' | 'year';

export interface DreLineMapping {
  line_code: DreLineCode;
  line_label: string;
  line_group: DreLineGroup;
  sort_order: number;
  indent_level: 0 | 1;
  is_group: boolean;
  is_subline: boolean;
  sign_type: SignType;
  formula: string;
  presumed_source: string;
  real_source: string;
}

/**
 * Linha canônica de saída da camada de dados (contrato do usuário).
 */
export interface DreCanonicalRow {
  period_type: PeriodType;
  period_key: string;
  quote_code: string | null;
  os_number: string | null;
  line_code: DreLineCode;
  line_label: string;
  sort_order: number;
  indent_level: 0 | 1;
  presumed_value: number;
  real_value: number;
  variance_value: number;
  variance_percent: number;
  badge_direction: BadgeDirection;
  badge_color: BadgeColor;
  has_formula_warning: boolean;
  missing_real_cost_flag: boolean;
}

export interface DreTable {
  period_type: PeriodType;
  period_key: string;
  quote_code: string | null;
  os_number: string | null;
  /** Base temporal única para filtros e agrupamentos (quote.created_at | fallback order.created_at). */
  reference_date: string;
  status?: 'ok' | 'sem_os_vinculada';
  status_detail?: 'ok' | 'legacy_quote_breakdown' | 'os_without_quote';
  rows: DreCanonicalRow[];
}
