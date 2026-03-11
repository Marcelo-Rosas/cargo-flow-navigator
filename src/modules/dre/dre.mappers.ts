import type { OrderDreInput, OrderPricingBreakdown, DreComparativoRow } from './dre.types';
import { computeDreRealFromPresumido } from './dre.calculations';

/** Arredonda para 2 casas */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Extrai valor numérico de objeto aninhado */
function num(obj: unknown, ...keys: string[]): number {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return 0;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : 0;
}

/** Mapeia uma ordem para DreComparativoRow.
 * Regra: receita, DAS, ICMS, receita líquida e overhead vêm do breakdown e permanecem fixos no real.
 * Custos operacionais reais vêm de carreteiro_real, pedagio_real, descarga_real.
 * Schema orders: não possui aluguel_maquinas_real nem mao_de_obra_real — usamos 0 no real. */
export function mapOrderToDreRow(
  order: OrderDreInput,
  entityLabel: string,
  entityType: 'order' | 'trip' | 'quote'
): DreComparativoRow | null {
  const pb = order.pricing_breakdown as OrderPricingBreakdown | null;
  if (!pb || order.value <= 0) return null;

  const receitaBrutaPresumida = num(pb.totals, 'totalCliente') || order.value;
  const dasPresumido = num(pb.totals, 'das') ?? 0;
  const icmsPresumido = num(pb.totals, 'icms') ?? 0;
  const receitaLiquidaPresumida =
    num(pb.profitability, 'receitaLiquida') ??
    round2(receitaBrutaPresumida - dasPresumido - icmsPresumido);

  const custoMotoristaPresumido =
    num(pb.profitability, 'custoMotorista') ?? num(pb.profitability, 'custosCarreteiro') ?? 0;
  const pedagioPresumido = num(pb.components, 'toll') ?? 0;
  const aluguelMaquinasPresumido = num(pb.components, 'aluguelMaquinas') ?? 0;
  const descargaPresumida = num(pb.profitability, 'custosDescarga') ?? 0;
  const maoDeObraPresumida = 0;

  const custosDiretosPresumidos =
    num(pb.profitability, 'custosDiretos') ??
    round2(
      custoMotoristaPresumido +
        pedagioPresumido +
        aluguelMaquinasPresumido +
        descargaPresumida +
        maoDeObraPresumida
    );
  const overheadPresumido = num(pb.profitability, 'overhead') ?? 0;
  const resultadoPresumido =
    num(pb.profitability, 'resultadoLiquido') ??
    round2(receitaLiquidaPresumida - custosDiretosPresumidos - overheadPresumido);
  const margemPresumidaPercent =
    num(pb.profitability, 'margemPercent') ??
    (receitaBrutaPresumida > 0 ? round2((resultadoPresumido / receitaBrutaPresumida) * 100) : 0);

  const custoMotoristaReal =
    order.carreteiro_real != null ? Number(order.carreteiro_real) : custoMotoristaPresumido;
  const pedagioReal = order.pedagio_real != null ? Number(order.pedagio_real) : pedagioPresumido;
  const descargaReal =
    order.descarga_real != null ? Number(order.descarga_real) : descargaPresumida;
  const aluguelMaquinasReal = 0;
  const maoDeObraReal = 0;

  const real = computeDreRealFromPresumido({
    receitaBrutaPresumida,
    dasPresumido,
    icmsPresumido,
    receitaLiquidaPresumida,
    custoMotoristaPresumido,
    pedagioPresumido,
    aluguelMaquinasPresumido,
    descargaPresumida,
    maoDeObraPresumida,
    custosDiretosPresumidos,
    overheadPresumido,
    resultadoPresumido,
    margemPresumidaPercent,
    custoMotoristaReal,
    pedagioReal,
    aluguelMaquinasReal,
    descargaReal,
    maoDeObraReal,
  });

  const entityId =
    entityType === 'order'
      ? order.id
      : entityType === 'trip'
        ? (order.trip_id ?? order.id)
        : (order.quote_id ?? order.id);

  return {
    entityId,
    entityLabel,
    entityType,

    receitaPresumida: receitaBrutaPresumida,
    receitaReal: receitaBrutaPresumida,

    dasPresumido,
    dasReal: dasPresumido,

    icmsPresumido,
    icmsReal: icmsPresumido,

    receitaLiquidaPresumida,
    receitaLiquidaReal: receitaLiquidaPresumida,

    custoMotoristaPresumido,
    custoMotoristaReal,

    pedagioPresumido,
    pedagioReal,

    aluguelMaquinasPresumido,
    aluguelMaquinasReal,

    descargaPresumida,
    descargaReal,

    maoDeObraPresumida,
    maoDeObraReal,

    custosDiretosPresumidos,
    custosDiretosReais: real.custosDiretosReais,

    overheadPresumido,
    overheadReal: overheadPresumido,

    resultadoPresumido,
    resultadoReal: real.resultadoReal,

    margemPresumidaPercent,
    margemRealPercent: real.margemRealPercent,

    deltaResultado: real.deltaResultado,
    deltaPercent: real.deltaPercent,
  };
}
