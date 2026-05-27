/**
 * DRE Real — valores da OS com custos efetivamente pagos/lançados.
 * Fonte: orders + trip_cost_items (scope=OS) + order_gris_services / risk_costs se existir.
 */

import type { DreLineCode } from './dre-lines.types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface OrderForDreReal {
  id: string;
  value: number;
  pricing_breakdown: Record<string, unknown> | null;
  carreteiro_real: number | null;
  pedagio_real: number | null;
  descarga_real: number | null;
  waiting_time_cost: number | null;
}

export interface TripCostItemForDre {
  order_id: string | null;
  scope: string;
  category: string;
  amount: number;
}

export interface DreRealInput {
  order: OrderForDreReal;
  tripCostItems?: TripCostItemForDre[];
  tripScopedItems?: TripCostItemForDre[];
  apportionFactor?: number;
  /** Soma de order_gris_services.amount_real por order_id (se existir) */
  grisAmountReal?: number;
  /** Soma de risk_costs.amount por order_id (se existir) */
  riskCostAmount?: number;
}

export interface RealValues {
  values: Map<DreLineCode, number>;
  /** Campos que não tinham lançamento real (usa 0 como placeholder) */
  absentFields: Set<DreLineCode>;
}

/**
 * Computa DRE Real a partir da OS e itens de custo.
 */
export function computeRealFromOrder(input: DreRealInput): RealValues {
  const { order, tripCostItems = [], tripScopedItems = [], apportionFactor = 1 } = input;
  const values = new Map<DreLineCode, number>();
  const absentFields = new Set<DreLineCode>();

  const faturamento = order.value;
  values.set('faturamento_bruto', round2(faturamento));

  const orderDas = tripCostItems
    .filter((t) => (t.category || '').toLowerCase() === 'das')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const dasReal = round2(orderDas);
  // ICMS real: não temos fonte de dados real (NFe/CTe ainda não integrados para impostos).
  // Usamos o ICMS presumido do pricing_breakdown como aproximação, ou 0 se não houver.
  const icmsFromBreakdown =
    typeof order.pricing_breakdown?.totals === 'object' && order.pricing_breakdown.totals !== null
      ? Number((order.pricing_breakdown.totals as Record<string, unknown>).icms ?? 0)
      : 0;
  const icmsReal = round2(icmsFromBreakdown);

  values.set('das', round2(dasReal));
  values.set('icms', round2(icmsReal));
  values.set('impostos', round2(dasReal + icmsReal));

  const receitaLiquida = round2(faturamento - dasReal - icmsReal);
  values.set('receita_liquida', receitaLiquida);

  // Overhead real: usa o overhead presumido como proxy (não há tracking real de overhead por OS).
  const overheadFromBreakdown =
    typeof order.pricing_breakdown?.profitability === 'object' &&
    order.pricing_breakdown.profitability !== null
      ? Number((order.pricing_breakdown.profitability as Record<string, unknown>).overhead ?? 0)
      : 0;
  const overheadReal = round2(overheadFromBreakdown);
  values.set('overhead', overheadReal);

  const tripCarreteiroRateado = round2(
    tripScopedItems
      .filter((t) => (t.category || '').toLowerCase() === 'carreteiro')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) * apportionFactor
  );
  const tripPedagioRateado = round2(
    tripScopedItems
      .filter((t) => (t.category || '').toLowerCase() === 'pedagio')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) * apportionFactor
  );
  const descargaFallbackOs = round2(
    tripCostItems
      .filter((t) => (t.category || '').toLowerCase() === 'descarga')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  const carreteiro = order.carreteiro_real ?? tripCarreteiroRateado ?? 0;
  const pedagio = order.pedagio_real ?? tripPedagioRateado ?? 0;
  const descarga = order.descarga_real ?? descargaFallbackOs ?? 0;
  // Usa waiting_time_cost da OS quando disponível; senão procura em trip_cost_items
  const esperaFromItems = tripCostItems
    .filter((t) => (t.category || '').toLowerCase() === 'espera')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const espera = order.waiting_time_cost ?? esperaFromItems ?? 0;
  if (order.carreteiro_real == null) absentFields.add('custo_motorista');
  if (order.pedagio_real == null) absentFields.add('pedagio');
  if (order.descarga_real == null) absentFields.add('carga_descarga');
  if (order.waiting_time_cost == null && esperaFromItems === 0) absentFields.add('espera');

  values.set('custo_motorista', round2(carreteiro));
  values.set('pedagio', round2(pedagio));
  values.set('carga_descarga', round2(descarga));
  values.set('espera', round2(espera));

  // Taxas condicionais reais: procura em trip_cost_items com categoria 'condicional' ou 'taxa_condicional'
  const taxasCondicionaisFromItems = tripCostItems
    .filter(
      (t) =>
        (t.category || '').toLowerCase() === 'condicional' ||
        (t.category || '').toLowerCase() === 'taxa_condicional'
    )
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const taxasCondicionais = taxasCondicionaisFromItems;
  if (taxasCondicionaisFromItems === 0) absentFields.add('taxas_condicionais');
  values.set('taxas_condicionais', round2(taxasCondicionais));

  const grisReal = round2(
    tripCostItems
      .filter((t) => (t.category || '').toLowerCase() === 'gris')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );
  const tsoReal = round2(
    tripCostItems
      .filter((t) => (t.category || '').toLowerCase() === 'tso')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  const outros = round2(grisReal + tsoReal);
  values.set('outros_custos', outros);

  const custosDiretos = round2(carreteiro + pedagio + descarga + grisReal + tsoReal);
  values.set('custos_diretos', custosDiretos);

  const resultadoLiquido = round2(receitaLiquida - overheadReal - custosDiretos);
  values.set('resultado_liquido', resultadoLiquido);

  // Margem sobre faturamento bruto (mesma base do DRE presumido para comparabilidade)
  const margemPercent = faturamento > 0 ? round2((resultadoLiquido / faturamento) * 100) : 0;
  values.set('margem_liquida', margemPercent);

  return { values, absentFields };
}
