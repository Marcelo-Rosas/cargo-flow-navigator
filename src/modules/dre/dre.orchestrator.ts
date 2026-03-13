/**
 * Orquestra a geração da DRE operacional: presumed + real + comparator -> DreTable.
 */

import type { DreTable } from './dre-lines.types';
import { computePresumedFromBreakdown } from './dre.presumed';
import {
  computeRealFromOrder,
  type OrderForDreReal,
  type RealValues,
  type TripCostItemForDre,
} from './dre.real';
import { comparePresumedVsReal } from './dre.comparator';
import { validateDreRows } from './dre.validators';

export interface OrderForDre {
  id: string;
  os_number: string;
  quote_id: string | null;
  value: number;
  created_at: string;
  pricing_breakdown: Record<string, unknown> | null;
  carreteiro_real: number | null;
  pedagio_real: number | null;
  descarga_real: number | null;
  waiting_time_cost: number | null;
  quote_code?: string | null;
  quote_created_at?: string | null;
  quote_value?: number | null;
  quote_pricing_breakdown?: Record<string, unknown> | null;
}

export interface QuoteForDre {
  id: string;
  quote_code: string | null;
  created_at: string;
  value: number;
  pricing_breakdown: Record<string, unknown> | null;
}

export interface DreOrchestratorInput {
  orders: OrderForDre[];
  quotes: QuoteForDre[];
  tripCostItemsByOrderId?: Map<string, TripCostItemForDre[]>;
  grisByOrderId?: Map<string, number>;
  riskByOrderId?: Map<string, number>;
}

/**
 * Gera DreTable[] detalhado (uma tabela por OS/COT).
 */
export function buildDreTables(input: DreOrchestratorInput): DreTable[] {
  const {
    orders,
    quotes,
    tripCostItemsByOrderId = new Map(),
    grisByOrderId = new Map(),
    riskByOrderId = new Map(),
  } = input;
  const tables: DreTable[] = [];
  const quoteMap = new Map(quotes.map((q) => [q.id, q]));
  const quotesWithOrder = new Set<string>();

  for (const order of orders) {
    if (order.value <= 0) continue;
    if (order.quote_id) quotesWithOrder.add(order.quote_id);

    const quote = order.quote_id ? quoteMap.get(order.quote_id) : undefined;
    const presumedBreakdown =
      quote?.pricing_breakdown ?? order.quote_pricing_breakdown ?? order.pricing_breakdown;
    const presumedQuoteValue = quote?.value ?? order.quote_value ?? order.value;
    const quoteCode = quote?.quote_code ?? order.quote_code ?? null;
    const referenceDate = quote?.created_at ?? order.quote_created_at ?? order.created_at;

    const presumed = computePresumedFromBreakdown(presumedBreakdown, presumedQuoteValue);

    const orderForReal: OrderForDreReal = {
      id: order.id,
      value: order.value,
      pricing_breakdown: presumedBreakdown,
      carreteiro_real: order.carreteiro_real,
      pedagio_real: order.pedagio_real,
      descarga_real: order.descarga_real,
      waiting_time_cost: order.waiting_time_cost,
    };

    const tripItems = tripCostItemsByOrderId.get(order.id) ?? [];
    const real = computeRealFromOrder({
      order: orderForReal,
      tripCostItems: tripItems,
      grisAmountReal: grisByOrderId.get(order.id) ?? 0,
      riskCostAmount: riskByOrderId.get(order.id) ?? 0,
    });

    const periodKey = quoteCode
      ? `COT-${quoteCode} / OS-${order.os_number}`
      : `OS-${order.os_number}`;

    const rows = validateDreRows(
      comparePresumedVsReal(presumed, real, presumed.hasFormulaWarning, {
        period_type: 'detail',
        period_key: periodKey,
        quote_code: quoteCode,
        os_number: order.os_number,
      })
    );

    tables.push({
      period_type: 'detail',
      period_key: periodKey,
      quote_code: quoteCode,
      os_number: order.os_number,
      reference_date: referenceDate,
      status: 'ok',
      rows,
    });
  }

  // COT sem OS vinculada -> presume normal + real zerado + badge neutra
  for (const quote of quotes) {
    if (quotesWithOrder.has(quote.id)) continue;
    const presumed = computePresumedFromBreakdown(quote.pricing_breakdown, quote.value);
    const emptyReal: RealValues = {
      values: new Map(),
      absentFields: new Set([
        'custo_motorista',
        'pedagio',
        'carga_descarga',
        'espera',
        'taxas_condicionais',
        'outros_custos',
      ]),
    };
    const periodKey = quote.quote_code ? `COT-${quote.quote_code} / sem OS` : `COT-${quote.id}`;
    const rows = validateDreRows(
      comparePresumedVsReal(presumed, emptyReal, presumed.hasFormulaWarning, {
        period_type: 'detail',
        period_key: periodKey,
        quote_code: quote.quote_code,
        os_number: null,
        force_neutral_badge: true,
      })
    );
    tables.push({
      period_type: 'detail',
      period_key: periodKey,
      quote_code: quote.quote_code,
      os_number: null,
      reference_date: quote.created_at,
      status: 'sem_os_vinculada',
      rows,
    });
  }

  return tables.sort(
    (a, b) => new Date(a.reference_date).getTime() - new Date(b.reference_date).getTime()
  );
}
