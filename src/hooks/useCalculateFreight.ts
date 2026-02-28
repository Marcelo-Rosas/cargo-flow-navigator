import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CalculateFreightInput, CalculateFreightResponse } from '@/types/freight';
export type { CalculateFreightInput, CalculateFreightResponse } from '@/types/freight';

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
      dasProvision: response.components.das_provision,
      aluguelMaquinas: response.components.aluguel_maquinas ?? 0,
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

/** Build StoredPricingBreakdown from Edge Function response, preserving meta.antt/tollPlazas from existing */
export function buildStoredBreakdownFromEdgeResponse(
  response: CalculateFreightResponse,
  existingBreakdown: {
    meta?: {
      antt?: object;
      tollPlazas?: unknown[];
      selectedConditionalFeeIds?: string[];
      unloadingCost?: unknown[];
      equipmentRental?: unknown[];
    };
    components?: { aluguelMaquinas?: number };
  } | null
) {
  const c = response.components;
  const wKg = response.meta.billable_weight_kg ?? 0;
  const cubKg = response.meta.cubage_weight_kg ?? 0;
  const tonBillable = Math.round((wKg / 1000) * 100) / 100;
  return {
    calculatedAt: new Date().toISOString(),
    version: '4.0-fob-lotacao-markup-scope',
    status: response.status,
    error: response.error,
    meta: {
      routeUfLabel: response.meta.route_uf_label,
      kmBandLabel: response.meta.km_band_label,
      kmStatus: response.meta.km_status,
      marginStatus: response.meta.margin_status,
      marginPercent: response.meta.margin_percent,
      kmBandUsed: response.meta.km_band_used,
      selectedConditionalFeeIds: existingBreakdown?.meta?.selectedConditionalFeeIds,
      antt: existingBreakdown?.meta?.antt,
      tollPlazas: existingBreakdown?.meta?.tollPlazas,
      unloadingCost: existingBreakdown?.meta?.unloadingCost,
      equipmentRental: existingBreakdown?.meta?.equipmentRental,
    },
    weights: {
      cubageWeight: cubKg,
      billableWeight: wKg,
      tonBillable,
    },
    components: {
      baseCost: c.base_cost,
      baseFreight: c.base_freight,
      toll: c.toll,
      aluguelMaquinas: (c as { aluguel_maquinas?: number }).aluguel_maquinas ?? existingBreakdown?.components?.aluguelMaquinas ?? 0,
      gris: c.gris,
      tso: c.tso,
      rctrc: c.rctrc,
      adValorem: c.ad_valorem,
      tde: c.tde,
      tear: c.tear,
      dispatchFee: c.dispatch_fee ?? 0,
      conditionalFeesTotal: c.conditional_fees_total,
      waitingTimeCost: c.waiting_time_cost,
      dasProvision: c.das_provision,
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
    rates: {
      dasPercent: response.rates.das_percent,
      icmsPercent: response.rates.icms_percent,
      grisPercent: response.rates.gris_percent,
      tsoPercent: response.rates.tso_percent,
      costValuePercent: response.rates.cost_value_percent,
      markupPercent: response.rates.markup_percent,
      overheadPercent: response.rates.overhead_percent,
      targetMarginPercent: 15,
    },
    conditionalFeesBreakdown:
      Object.keys(response.conditional_fees_breakdown || {}).length > 0
        ? response.conditional_fees_breakdown
        : undefined,
  };
}
