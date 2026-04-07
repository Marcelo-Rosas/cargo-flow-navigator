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
  const {
    order,
    tripCostItems = [],
    tripScopedItems = [],
    apportionFactor = 1,
  } = input;
  const values = new Map<DreLineCode, number>();
  const absentFields = new Set<DreLineCode>();

  const faturamento = order.value;
  values.set('faturamento_bruto', round2(faturamento));

  const orderDas = tripCostItems
    .filter((t) => (t.category || '').toLowerCase() === 'das')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const dasReal = round2(orderDas);
  const icmsReal = 0;

  values.set('das', round2(dasReal));
  values.set('icms', round2(icmsReal));
  values.set('impostos', round2(dasReal + icmsReal));

  const receitaLiquida = round2(faturamento - dasReal);
  values.set('receita_liquida', receitaLiquida);

  const overheadReal = 0;
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
  const espera = 0;
  if (order.carreteiro_real == null) absentFields.add('custo_motorista');
  if (order.pedagio_real == null) absentFields.add('pedagio');
  if (order.descarga_real == null) absentFields.add('carga_descarga');
  absentFields.add('espera');

  values.set('custo_motorista', round2(carreteiro));
  values.set('pedagio', round2(pedagio));
  values.set('carga_descarga', round2(descarga));
  values.set('espera', round2(espera));

  const taxasCondicionais = 0;
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

  const margemPercent = receitaLiquida > 0 ? round2((resultadoLiquido / receitaLiquida) * 100) : 0;
  values.set('margem_liquida', margemPercent);

  return { values, absentFields };
}
