import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// =====================================================
// TYPES (aligned with Edge Function response)
// =====================================================

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

// =====================================================
// HOOK
// =====================================================

export function useCalculateFreight() {
  return useMutation({
    mutationFn: async (input: CalculateFreightInput): Promise<CalculateFreightResponse> => {
      const { data, error } = await supabase.functions.invoke('calculate-freight', {
        body: input,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao calcular frete');
      }

      if (!data.success) {
        throw new Error(data.errors?.join(', ') || data.error || 'Erro no cálculo do frete');
      }

      return data as CalculateFreightResponse;
    },
  });
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatWeight(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} t`;
  }
  return `${value.toFixed(2)} kg`;
}

// =====================================================
// ADAPTER: Convert Edge Function response to local format
// =====================================================

export function adaptToLocalFormat(response: CalculateFreightResponse) {
  return {
    status: response.status,
    error: response.error,
    meta: {
      routeUfLabel: response.meta.route_uf_label,
      kmBandLabel: response.meta.km_band_label,
      kmStatus: response.meta.km_status,
      marginStatus: response.meta.margin_status,
      marginPercent: response.meta.margin_percent,
      cubageFactor: response.meta.cubage_factor,
      cubageWeightKg: response.meta.cubage_weight_kg,
      billableWeightKg: response.meta.billable_weight_kg,
    },
    components: {
      baseCost: response.components.base_cost,
      baseFreight: response.components.base_freight,
      toll: response.components.toll,
      gris: response.components.gris,
      tso: response.components.tso,
      rctrc: response.components.rctrc,
      adValorem: response.components.ad_valorem,
      tde: response.components.tde,
      tear: response.components.tear,
      conditionalFeesTotal: response.components.conditional_fees_total,
      waitingTimeCost: response.components.waiting_time_cost,
    },
    rates: {
      dasPercent: response.rates.das_percent,
      icmsPercent: response.rates.icms_percent,
      grisPercent: response.rates.gris_percent,
      tsoPercent: response.rates.tso_percent,
      costValuePercent: response.rates.cost_value_percent,
      markupPercent: response.rates.markup_percent,
      overheadPercent: response.rates.overhead_percent,
      tacPercent: response.rates.tac_percent,
      paymentAdjustmentPercent: response.rates.payment_adjustment_percent,
    },
    totals: {
      receitaBruta: response.totals.receita_bruta,
      das: response.totals.das,
      icms: response.totals.icms,
      tacAdjustment: response.totals.tac_adjustment,
      paymentAdjustment: response.totals.payment_adjustment,
      totalImpostos: response.totals.total_impostos,
      totalCliente: response.totals.total_cliente,
    },
    profitability: {
      custosCarreteiro: response.profitability.custos_carreteiro,
      custosDescarga: response.profitability.custos_descarga,
      custosDiretos: response.profitability.custos_diretos,
      margemBruta: response.profitability.margem_bruta,
      overhead: response.profitability.overhead,
      resultadoLiquido: response.profitability.resultado_liquido,
      margemPercent: response.profitability.margem_percent,
    },
    conditionalFeesBreakdown: response.conditional_fees_breakdown,
    fallbacksApplied: response.fallbacks_applied,
  };
}
