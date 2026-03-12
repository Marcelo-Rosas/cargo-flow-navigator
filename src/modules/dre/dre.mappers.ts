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

/** Retorna número ou undefined se caminho inexistente (para distinguir 0 de ausente) */
function numOrUndef(obj: unknown, ...keys: string[]): number | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : undefined;
}

/** Extrai número com fallback camelCase e snake_case */
function numFallback(obj: unknown, camelKeys: string[], snakeKeys: string[]): number {
  return numOrUndef(obj, ...camelKeys) ?? numOrUndef(obj, ...snakeKeys) ?? 0;
}

/** Detecta se o breakdown tem dados de custos (evita legacy/minimal) */
function hasProfitabilityData(pb: OrderPricingBreakdown | null): boolean {
  if (!pb?.profitability) return false;
  const p = pb.profitability as Record<string, unknown>;
  return (
    p.custosDiretos != null ||
    p.custos_diretos != null ||
    p.custoMotorista != null ||
    p.custosCarreteiro != null ||
    p.custo_motorista != null ||
    p.custos_carreteiro != null
  );
}

/** Mapeia uma ordem para DreComparativoRow.
 * Regra: receita, DAS, ICMS, receita líquida e overhead vêm do breakdown e permanecem fixos no real.
 * Custos operacionais reais vêm de carreteiro_real, pedagio_real, descarga_real.
 * Para legacy/minimal breakdown: usa carreteiro_real, pedagio_real, descarga_real como presumido. */
export function mapOrderToDreRow(
  order: OrderDreInput,
  entityLabel: string,
  entityType: 'order' | 'trip' | 'quote'
): DreComparativoRow | null {
  const pb = order.pricing_breakdown as OrderPricingBreakdown | null;
  if (!pb || order.value <= 0) return null;

  const receitaBrutaPresumida =
    numFallback(pb, ['totals', 'totalCliente'], ['totals', 'total_cliente']) || order.value;
  const dasPresumido = num(pb.totals, 'das');
  const icmsPresumido = num(pb.totals, 'icms');
  const receitaLiquidaPresumida =
    numFallback(pb, ['profitability', 'receitaLiquida'], ['profitability', 'receita_liquida']) ??
    round2(receitaBrutaPresumida - dasPresumido - icmsPresumido);

  const hasPb = hasProfitabilityData(pb);
  const custoMotoristaPresumido = hasPb
    ? numFallback(pb, ['profitability', 'custoMotorista'], ['profitability', 'custo_motorista']) ||
      numFallback(pb, ['profitability', 'custosCarreteiro'], ['profitability', 'custos_carreteiro'])
    : (order.carreteiro_real ?? 0);
  const pedagioPresumido = hasPb ? num(pb.components, 'toll') || 0 : (order.pedagio_real ?? 0);
  const aluguelMaquinasPresumido = num(pb.components, 'aluguelMaquinas') ?? 0;
  const descargaPresumida = hasPb
    ? numFallback(pb, ['profitability', 'custosDescarga'], ['profitability', 'custos_descarga'])
    : (order.descarga_real ?? 0);
  const maoDeObraPresumida = 0;

  const custosDiretosPresumidos = hasPb
    ? numFallback(pb, ['profitability', 'custosDiretos'], ['profitability', 'custos_diretos']) ||
      round2(
        custoMotoristaPresumido +
          pedagioPresumido +
          aluguelMaquinasPresumido +
          descargaPresumida +
          maoDeObraPresumida
      )
    : round2(
        custoMotoristaPresumido + pedagioPresumido + aluguelMaquinasPresumido + descargaPresumida
      );
  const overheadPresumido =
    numFallback(pb, ['profitability', 'overhead'], ['profitability', 'overhead']) ?? 0;
  const resultadoPresumido =
    numFallback(
      pb,
      ['profitability', 'resultadoLiquido'],
      ['profitability', 'resultado_liquido']
    ) ?? round2(receitaLiquidaPresumida - custosDiretosPresumidos - overheadPresumido);
  const margemPresumidaPercent =
    numFallback(pb, ['profitability', 'margemPercent'], ['profitability', 'margem_percent']) ??
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
