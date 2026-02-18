/**
 * ============================================
 * TIPOS E HELPERS COMPARTILHADOS - CÁLCULO DE FRETE
 * ============================================
 *
 * Este arquivo define os tipos e funções utilitárias
 * compartilhados entre frontend e Edge Functions.
 *
 * Regra de negócio: FOB Lotação, impostos "por fora"
 */

// ============================================
// CONSTANTS
// ============================================

export const FREIGHT_CONSTANTS = {
  CUBAGE_FACTOR_KG_M3: 300,
  DEFAULT_DAS_PERCENT: 14,
  DEFAULT_MARKUP_PERCENT: 30,
  DEFAULT_OVERHEAD_PERCENT: 15,
  TARGET_MARGIN_PERCENT: 15,
  NTC_TDE_PERCENT: 20,
  NTC_TEAR_PERCENT: 20,
  DEFAULT_ICMS_PERCENT: 12,
} as const;

// ============================================
// INPUT TYPES
// ============================================

export interface CalculateFreightInput {
  // Localização
  origin: string; // "Cidade - UF" ou "Cidade, UF"
  destination: string;
  km_distance: number;

  // Carga
  weight_kg: number;
  volume_m3: number;
  cargo_value: number;

  // Pedágio manual
  toll_value?: number;

  // Tabela de preços
  price_table_id?: string;

  // Tipo de veículo (para estadia)
  vehicle_type_code?: string;

  // Prazo de pagamento
  payment_term_code?: string;

  // Taxas NTC opcionais
  tde_enabled?: boolean;
  tear_enabled?: boolean;

  // Taxas condicionais adicionais
  conditional_fees?: string[];

  // Estadia
  waiting_hours?: number;

  // Overrides (opcional)
  das_percent?: number;
  markup_percent?: number;
  overhead_percent?: number;
  carreteiro_percent?: number;
  descarga_value?: number;
}

// ============================================
// OUTPUT TYPES
// ============================================

export interface FreightMeta {
  route_uf_label: string | null; // "SC→SP"
  km_band_label: string | null; // "1-50"
  km_status: 'OK' | 'OUT_OF_RANGE';
  margin_status: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET';
  margin_percent: number;
  cubage_factor: number;
  cubage_weight_kg: number;
  billable_weight_kg: number;
  km_band_used?: number; // inteiro usado na busca (ex.: 1719)
  price_table_row_id?: string; // id da linha encontrada, para auditoria
  /** NTC Lotação Dez/25: frete_peso + frete_valor + gris + tso (sem correction/markup) */
  ntc_base?: number;
  /** Piso ANTT carreteiro (km × CCD + CC) para custos diretos e rentabilidade */
  antt_piso_carreteiro?: number;
}

export interface FreightComponents {
  base_cost: number; // NTC: frete peso (sem correction/markup)
  base_freight: number; // NTC: frete peso (sem correction/markup; UI evita duplicar gris/tso/rctrc)
  toll: number;
  gris: number;
  tso: number;
  rctrc: number; // NTC: frete valor (= cargo_value * cost_value_percent); nome mantido compatibilidade UI
  ad_valorem: number; // Sempre 0 (legado)
  tde: number; // TODO: generalidades NTC; por ora 0
  tear: number; // TODO: generalidades NTC; por ora 0
  conditional_fees_total: number;
  waiting_time_cost: number;
  /** Provisão DAS por frete = max(receita × das_provision_percent/100, das_provision_min_value) */
  das_provision: number;
}

export interface FreightRates {
  das_percent: number;
  icms_percent: number;
  gris_percent: number;
  tso_percent: number;
  cost_value_percent: number; // Para RCTR-C
  markup_percent: number;
  overhead_percent: number;
  tac_percent: number;
  payment_adjustment_percent: number;
}

export interface FreightTotals {
  receita_bruta: number; // Soma de components
  das: number;
  icms: number;
  tac_adjustment: number;
  payment_adjustment: number;
  total_impostos: number; // das + icms
  total_cliente: number; // receita_bruta + total_impostos
}

export interface FreightProfitability {
  custos_carreteiro: number;
  custos_descarga: number;
  custos_diretos: number;
  margem_bruta: number;
  overhead: number;
  resultado_liquido: number;
  margem_percent: number;
}

export interface CalculateFreightResponse {
  success: boolean;
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;

  meta: FreightMeta;
  components: FreightComponents;
  rates: FreightRates;
  totals: FreightTotals;
  profitability: FreightProfitability;

  // Detalhes extras
  conditional_fees_breakdown: Record<string, number>;
  fallbacks_applied: string[];
  errors: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extrai UF de string "Cidade, SC" ou "Cidade - SC"
 */
export function extractUf(location: string): string | null {
  if (!location) return null;

  // Padrão 1: "Cidade, UF" ou "Cidade - UF"
  const match = location.match(/[,-]\s*([A-Z]{2})\s*$/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // Fallback: últimos 2 caracteres se forem letras
  const trimmed = location.trim();
  const lastTwo = trimmed.slice(-2);
  if (/^[A-Z]{2}$/i.test(lastTwo)) {
    return lastTwo.toUpperCase();
  }

  return null;
}

/**
 * Extrai cidade de string "Cidade - UF"
 */
export function extractCity(location: string): string | null {
  if (!location) return null;

  const match = location.match(/^(.+?)\s*[,-]\s*[A-Z]{2}\s*$/i);
  return match ? match[1].trim() : null;
}

/**
 * Formata rota "SC→SP"
 */
export function formatRouteUf(origin: string, destination: string): string | null {
  const originUf = extractUf(origin);
  const destUf = extractUf(destination);

  if (originUf && destUf) {
    return `${originUf}→${destUf}`;
  }

  return null;
}

/**
 * Normaliza taxa ICMS para escala percentual (3-25)
 * - 0.12 → 12 (×100)
 * - 0.7 → 7 (×10)
 * - 70 → 7 (÷10)
 */
export function normalizeIcmsRate(rate: number): number {
  if (rate === 0) return 0;

  // Já está na escala correta (3-25)
  if (rate >= 3 && rate <= 25) return rate;

  // Decimal pequeno: 0 < x < 1
  if (rate > 0 && rate < 1) {
    const times100 = rate * 100;
    if (times100 >= 3 && times100 <= 25) return times100;

    const times10 = rate * 10;
    if (times10 >= 3 && times10 <= 25) return times10;
  }

  // Entre 1 e 3: pode ser 1.2 = 12%
  if (rate >= 1 && rate < 3) {
    const times10 = rate * 10;
    if (times10 >= 3 && times10 <= 25) return times10;
  }

  // Muito alto: > 25
  if (rate > 25 && rate <= 250) {
    const divided = rate / 10;
    if (divided >= 3 && divided <= 25) return divided;
  }

  // Fallback: retorna o valor original
  return rate;
}

/**
 * Calcula peso cubado
 */
export function calculateCubageWeight(volumeM3: number): number {
  return volumeM3 * FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;
}

/**
 * Calcula peso faturável (maior entre real e cubado)
 */
export function calculateBillableWeight(weightKg: number, volumeM3: number): number {
  const cubageWeight = calculateCubageWeight(volumeM3);
  return Math.max(weightKg, cubageWeight);
}

/**
 * Arredonda para 2 casas decimais
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Determina status da margem vs target
 */
export function getMarginStatus(
  marginPercent: number
): 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET' {
  const target = FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;

  if (marginPercent > target + 0.5) return 'ABOVE_TARGET';
  if (marginPercent < target - 0.5) return 'BELOW_TARGET';
  return 'AT_TARGET';
}
