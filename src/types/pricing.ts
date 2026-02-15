// =====================================================
// PRICING RULES TYPE DEFINITIONS
// =====================================================

// Parâmetros Gerais de Precificação
export interface PricingParameter {
  id: string;
  key: string;
  value: number;
  unit: string | null;
  description: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Tipos de Veículo
export interface VehicleType {
  id: string;
  code: string;
  name: string;
  axes_count: number | null;
  capacity_kg: number | null;
  capacity_m3: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Regras de Estadia
export type WaitingTimeContext = 'loading' | 'unloading' | 'both';

export interface WaitingTimeRule {
  id: string;
  vehicle_type_id: string | null;
  context: WaitingTimeContext;
  free_hours: number;
  rate_per_hour: number | null;
  rate_per_day: number | null;
  min_charge: number | null;
  valid_from: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Pedágio por Rota
export interface TollRoute {
  id: string;
  origin_state: string;
  origin_city: string | null;
  destination_state: string;
  destination_city: string | null;
  vehicle_type_id: string | null;
  toll_value: number;
  distance_km: number | null;
  via_description: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// TAC (Taxa de Ajuste do Combustível)
export interface TacRate {
  id: string;
  reference_date: string;
  diesel_price_base: number;
  diesel_price_current: number;
  variation_percent: number;
  adjustment_percent: number;
  source_description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Taxas Condicionais
export type FeeType = 'percentage' | 'fixed' | 'per_kg';
export type FeeAppliesTo = 'freight' | 'cargo_value' | 'total';

export interface ConditionalFee {
  id: string;
  code: string;
  name: string;
  description: string | null;
  fee_type: FeeType;
  fee_value: number;
  min_value: number | null;
  max_value: number | null;
  applies_to: FeeAppliesTo;
  conditions: Record<string, unknown> | null;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Prazo de Pagamento
export interface PaymentTerm {
  id: string;
  code: string;
  name: string;
  days: number;
  adjustment_percent: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type {
  CalculateFreightInput,
  FreightMeta,
  FreightComponents,
  FreightRates,
  FreightTotals,
  FreightProfitability,
  CalculateFreightResponse,
  FreightBreakdown,
  ParametersUsed,
} from './freight';

// =====================================================
// COMMON CODES
// =====================================================

export const VEHICLE_TYPE_CODES = [
  'VUC',
  'TOCO',
  'TRUCK',
  'BI_TRUCK',
  'CARRETA_3',
  'CARRETA_4',
  'RODOTREM',
] as const;

export type VehicleTypeCode = (typeof VEHICLE_TYPE_CODES)[number];

export const PAYMENT_TERM_CODES = ['AVISTA', 'D15', 'D30', 'D45', 'D60', 'D90'] as const;

export type PaymentTermCode = (typeof PAYMENT_TERM_CODES)[number];

export const CONDITIONAL_FEE_CODES = [
  'TDE',
  'TEAR',
  'SCHEDULING',
  'OFF_HOURS',
  'RETURN',
  'REDELIVERY',
] as const;

export type ConditionalFeeCode = (typeof CONDITIONAL_FEE_CODES)[number];
