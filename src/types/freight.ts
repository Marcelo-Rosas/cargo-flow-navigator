export interface CalculateFreightInput {
  origin: string;
  destination: string;
  km_distance: number;
  weight_kg: number;
  volume_m3: number;
  cargo_value: number;
  toll_value?: number;
  price_table_id?: string;
  vehicle_type_code?: string;
  payment_term_code?: string;
  tde_enabled?: boolean;
  tear_enabled?: boolean;
  conditional_fees?: string[];
  waiting_hours?: number;
  das_percent?: number;
  markup_percent?: number;
  overhead_percent?: number;
  carreteiro_percent?: number;
  descarga_value?: number;
}

export interface FreightMeta {
  route_uf_label: string | null;
  km_band_label: string | null;
  km_status: 'OK' | 'OUT_OF_RANGE';
  margin_status: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET';
  margin_percent: number;
  cubage_factor: number;
  cubage_weight_kg: number;
  billable_weight_kg: number;
  km_band_used?: number;
  price_table_row_id?: string;
  /** NTC Lotação Dez/25: frete_peso + frete_valor + gris + tso */
  ntc_base?: number;
}

export interface FreightComponents {
  base_cost: number;
  base_freight: number;
  toll: number;
  gris: number;
  tso: number;
  rctrc: number;
  ad_valorem: number;
  tde: number;
  tear: number;
  conditional_fees_total: number;
  waiting_time_cost: number;
  /** Provisão DAS por frete (colchão) */
  das_provision: number;
}

export interface FreightRates {
  das_percent: number;
  icms_percent: number;
  gris_percent: number;
  tso_percent: number;
  cost_value_percent: number;
  markup_percent: number;
  overhead_percent: number;
  tac_percent: number;
  payment_adjustment_percent: number;
}

export interface FreightTotals {
  receita_bruta: number;
  das: number;
  icms: number;
  tac_adjustment: number;
  payment_adjustment: number;
  total_impostos: number;
  total_cliente: number;
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
  conditional_fees_breakdown: Record<string, number>;
  fallbacks_applied: string[];
  errors: string[];
}

// Legacy types kept for compatibility with older UI helpers.
export interface FreightBreakdown {
  weight_real: number;
  weight_cubed: number;
  weight_billable: number;
  base_freight: number;
  gris: number;
  tso: number;
  toll: number;
  tac_adjustment: number;
  icms: number;
  waiting_time: number;
  conditional_fees: Record<string, number>;
  payment_adjustment: number;
  subtotal: number;
  total: number;
}

export interface ParametersUsed {
  cubage_factor: number;
  icms_rate: number;
  tac_percent: number;
  payment_term: string;
  vehicle_type: string | null;
}
