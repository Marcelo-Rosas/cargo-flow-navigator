import { useMutation } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import type { CalculateFreightInput, CalculateFreightResponse } from '@/types/freight';
export type { CalculateFreightInput, CalculateFreightResponse } from '@/types/freight';

// =====================================================
// HOOK
// =====================================================

export function useCalculateFreight() {
  return useMutation({
    mutationFn: async (input: CalculateFreightInput): Promise<CalculateFreightResponse> => {
      const data = await invokeEdgeFunction<CalculateFreightResponse>('calculate-freight', {
        body: input,
      });

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
