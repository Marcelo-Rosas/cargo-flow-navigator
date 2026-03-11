import type { DreComparativoRow, OrderDreInput, DreGroupBy } from './dre.types';
import { mapOrderToDreRow } from './dre.mappers';

/** Agrupa linhas DRE por ordem (uma linha por OS) */
export function groupByOrder(
  orders: OrderDreInput[],
  _options?: { quoteCodes?: Map<string, string>; tripNumbers?: Map<string, string> }
): DreComparativoRow[] {
  const rows: DreComparativoRow[] = [];
  for (const o of orders) {
    const label = o.os_number || o.id.slice(0, 8);
    const row = mapOrderToDreRow(o, label, 'order');
    if (row) rows.push({ ...row, entityType: 'order' });
  }
  return rows;
}

/** Agrupa linhas DRE por viagem (soma das OS da mesma trip) */
export function groupByTrip(
  orders: OrderDreInput[],
  options?: { tripNumbers?: Map<string, string> }
): DreComparativoRow[] {
  const byTrip = new Map<string, OrderDreInput[]>();
  for (const o of orders) {
    const tid = o.trip_id ?? `avulsa_${o.id}`;
    const list = byTrip.get(tid) ?? [];
    list.push(o);
    byTrip.set(tid, list);
  }

  const rows: DreComparativoRow[] = [];
  for (const [tripId, list] of byTrip) {
    const aggregated = aggregateOrdersToSingle(list);
    if (!aggregated) continue;
    const label = tripId.startsWith('avulsa_')
      ? `Avulsa ${list[0]?.os_number ?? ''}`
      : (options?.tripNumbers?.get(tripId) ?? list[0]?.trip_number ?? tripId.slice(0, 8));
    const row = mapOrderToDreRow(aggregated, label, 'trip');
    if (row) {
      row.entityId = tripId;
      row.entityType = 'trip';
      rows.push(row);
    }
  }
  return rows;
}

/** Agrupa linhas DRE por cotação (soma das OS vinculadas à mesma quote) */
export function groupByQuote(
  orders: OrderDreInput[],
  options?: { quoteCodes?: Map<string, string> }
): DreComparativoRow[] {
  const byQuote = new Map<string, OrderDreInput[]>();
  for (const o of orders) {
    const qid = o.quote_id ?? `sem_cotacao_${o.id}`;
    const list = byQuote.get(qid) ?? [];
    list.push(o);
    byQuote.set(qid, list);
  }

  const rows: DreComparativoRow[] = [];
  for (const [quoteId, list] of byQuote) {
    const aggregated = aggregateOrdersToSingle(list);
    if (!aggregated) continue;
    const label = quoteId.startsWith('sem_cotacao_')
      ? `OS ${list[0]?.os_number ?? ''}`
      : (options?.quoteCodes?.get(quoteId) ?? list[0]?.quote_code ?? quoteId.slice(0, 8));
    const row = mapOrderToDreRow(aggregated, label, 'quote');
    if (row) {
      row.entityId = quoteId;
      row.entityType = 'quote';
      rows.push(row);
    }
  }
  return rows;
}

/** Agrega múltiplas ordens em uma única OrderDreInput (soma de valores) */
function aggregateOrdersToSingle(orders: OrderDreInput[]): OrderDreInput | null {
  if (orders.length === 0) return null;
  if (orders.length === 1) return orders[0]!;

  const first = orders[0]!;
  let receitaBruta = 0;
  let das = 0;
  let icms = 0;
  let receitaLiquida = 0;
  let custoMotoristaP = 0;
  let pedagioP = 0;
  let aluguelP = 0;
  let descargaP = 0;
  let custosDiretosP = 0;
  let overheadP = 0;
  let resultadoP = 0;

  let custoMotoristaR = 0;
  let pedagioR = 0;
  let descargaR = 0;

  for (const o of orders) {
    const pb = o.pricing_breakdown as {
      totals?: { totalCliente?: number; das?: number; icms?: number };
      profitability?: {
        receitaLiquida?: number;
        custoMotorista?: number;
        custosCarreteiro?: number;
        custosDescarga?: number;
        custosDiretos?: number;
        overhead?: number;
        resultadoLiquido?: number;
      };
      components?: { toll?: number; aluguelMaquinas?: number };
    } | null;
    const rec = pb?.totals?.totalCliente ?? o.value;
    receitaBruta += rec;
    das += pb?.totals?.das ?? 0;
    icms += pb?.totals?.icms ?? 0;
    receitaLiquida +=
      pb?.profitability?.receitaLiquida ?? rec - (pb?.totals?.das ?? 0) - (pb?.totals?.icms ?? 0);
    custoMotoristaP +=
      pb?.profitability?.custoMotorista ?? pb?.profitability?.custosCarreteiro ?? 0;
    pedagioP += pb?.components?.toll ?? 0;
    aluguelP += pb?.components?.aluguelMaquinas ?? 0;
    descargaP += pb?.profitability?.custosDescarga ?? 0;
    custosDiretosP += pb?.profitability?.custosDiretos ?? 0;
    overheadP += pb?.profitability?.overhead ?? 0;
    resultadoP += pb?.profitability?.resultadoLiquido ?? 0;

    custoMotoristaR += o.carreteiro_real ?? 0;
    pedagioR += o.pedagio_real ?? 0;
    descargaR += o.descarga_real ?? 0;
  }

  const pb = first.pricing_breakdown as Record<string, unknown> | null;
  const aggregatedPb = pb
    ? {
        ...pb,
        totals: {
          ...(pb.totals as object),
          totalCliente: receitaBruta,
          receitaBruta,
          das,
          icms,
        },
        profitability: {
          ...(pb.profitability as object),
          receitaLiquida,
          custoMotorista: custoMotoristaP,
          custosCarreteiro: custoMotoristaP,
          custosDescarga: descargaP,
          custosDiretos: custosDiretosP,
          overhead: overheadP,
          resultadoLiquido: resultadoP,
        },
        components: {
          ...(pb.components as object),
          toll: pedagioP,
          aluguelMaquinas: aluguelP,
        },
      }
    : null;

  return {
    ...first,
    id: first.id,
    value: receitaBruta,
    pricing_breakdown: aggregatedPb,
    carreteiro_real: custoMotoristaR,
    pedagio_real: pedagioR,
    descarga_real: descargaR,
  };
}

/** Dispatcher por tipo de agrupamento */
export function groupDreRows(
  orders: OrderDreInput[],
  groupBy: DreGroupBy,
  options?: { quoteCodes?: Map<string, string>; tripNumbers?: Map<string, string> }
): DreComparativoRow[] {
  switch (groupBy) {
    case 'order':
      return groupByOrder(orders, options);
    case 'trip':
      return groupByTrip(orders, options);
    case 'quote':
      return groupByQuote(orders, options);
    default:
      return groupByOrder(orders, options);
  }
}
