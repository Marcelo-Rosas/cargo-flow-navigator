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
  /** Soma de order_gris_services.amount_real por order_id (se existir) */
  grisAmountReal?: number;
  /** Soma de risk_costs.amount por order_id (se existir) */
  riskCostAmount?: number;
}

function num(obj: unknown, ...keys: string[]): number {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return 0;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : 0;
}

function numOrUndef(obj: unknown, ...keys: string[]): number | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : undefined;
}

function numFallback(obj: unknown, camel: string[], snake: string[]): number {
  return numOrUndef(obj, ...camel) ?? numOrUndef(obj, ...snake) ?? 0;
}

/**
 * Calcula percentual DAS/ICMS sobre faturamento (fallback fiscal)
 */
function calcImpostosProporcionais(
  faturamento: number,
  breakdown: Record<string, unknown> | null
): { das: number; icms: number } {
  const dasPct =
    num(breakdown, 'rates', 'dasPercent') || num(breakdown, 'rates', 'das_percent') || 0;
  const icmsPct =
    num(breakdown, 'rates', 'icmsPercent') || num(breakdown, 'rates', 'icms_percent') || 0;
  return {
    das: round2((faturamento * dasPct) / 100),
    icms: round2((faturamento * icmsPct) / 100),
  };
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
  const { order, tripCostItems = [], grisAmountReal = 0, riskCostAmount = 0 } = input;
  const values = new Map<DreLineCode, number>();
  const absentFields = new Set<DreLineCode>();

  const faturamento = order.value;
  values.set('faturamento_bruto', round2(faturamento));

  const breakdown = order.pricing_breakdown;
  const { das: dasReal, icms: icmsReal } = calcImpostosProporcionais(faturamento, breakdown);

  values.set('das', round2(dasReal));
  values.set('icms', round2(icmsReal));
  values.set('impostos', round2(dasReal + icmsReal));

  const receitaLiquida = round2(faturamento - dasReal - icmsReal);
  values.set('receita_liquida', receitaLiquida);

  const overheadPercent =
    numFallback(breakdown, ['rates', 'overheadPercent'], ['rates', 'overhead_percent']) ?? 0;
  const overheadPresumido =
    numFallback(breakdown, ['profitability', 'overhead'], ['profitability', 'overhead']) ?? 0;
  const overheadReal =
    overheadPercent > 0
      ? round2((receitaLiquida * overheadPercent) / 100)
      : round2(overheadPresumido);
  values.set('overhead', overheadReal);

  const carreteiro = order.carreteiro_real ?? 0;
  const pedagio = order.pedagio_real ?? 0;
  const descarga = order.descarga_real ?? 0;
  const espera = order.waiting_time_cost ?? 0;

  if (order.carreteiro_real == null) absentFields.add('custo_motorista');
  if (order.pedagio_real == null) absentFields.add('pedagio');
  if (order.descarga_real == null) absentFields.add('carga_descarga');
  if (order.waiting_time_cost == null) absentFields.add('espera');

  values.set('custo_motorista', round2(carreteiro));
  values.set('pedagio', round2(pedagio));
  values.set('carga_descarga', round2(descarga));
  values.set('espera', round2(espera));

  const itemsForOrder = tripCostItems.filter((t) => t.order_id === order.id && t.scope === 'OS');
  let taxasCondicionais = 0;
  let outrosTripCosts = 0;
  for (const t of itemsForOrder) {
    const cat = (t.category || '').toLowerCase();
    if (cat.includes('conditional') || cat.includes('condicional') || cat.includes('condicional'))
      taxasCondicionais += t.amount;
    else if (
      !cat.includes('carreteiro') &&
      !cat.includes('pedagio') &&
      !cat.includes('descarga') &&
      !cat.includes('espera')
    ) {
      outrosTripCosts += t.amount;
    }
  }
  values.set('taxas_condicionais', round2(taxasCondicionais));

  const outros = round2(grisAmountReal + riskCostAmount + outrosTripCosts);
  values.set('outros_custos', outros);

  const custosDiretos = round2(
    carreteiro + pedagio + descarga + espera + taxasCondicionais + outros
  );
  values.set('custos_diretos', custosDiretos);

  const resultadoLiquido = round2(receitaLiquida - overheadReal - custosDiretos);
  values.set('resultado_liquido', resultadoLiquido);

  const margemPercent = faturamento > 0 ? round2((resultadoLiquido / faturamento) * 100) : 0;
  values.set('margem_liquida', margemPercent);

  return { values, absentFields };
}
