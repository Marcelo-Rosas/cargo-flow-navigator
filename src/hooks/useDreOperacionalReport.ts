/**
 * Hook para DRE Operacional Comparativa (tabela contábil lado a lado).
 * Filtros: intervalo dd/mm/yyyy, quote_code, os_number, periodType.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildDreTables,
  consolidateDreTables,
  type DreTable,
  type PeriodType,
} from '@/modules/dre';
import { parseDdMmYyyy } from '@/lib/dateFilterUtils';

export interface UseDreOperacionalReportParams {
  /** Data início no formato dd/mm/yyyy */
  dateFrom: string | null;
  /** Data fim no formato dd/mm/yyyy */
  dateTo: string | null;
  quoteCode: string | null;
  osNumber: string | null;
  periodType: PeriodType;
  vehicleTypeId?: string | null;
  enabled?: boolean;
}

function buildRange(
  dateFrom: string | null,
  dateTo: string | null
): {
  from: Date | null;
  to: Date | null;
} {
  const from = parseDdMmYyyy(dateFrom);
  const to = parseDdMmYyyy(dateTo);
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function useDreOperacionalReport({
  dateFrom,
  dateTo,
  quoteCode,
  osNumber,
  periodType,
  vehicleTypeId,
  enabled = true,
}: UseDreOperacionalReportParams) {
  return useQuery({
    queryKey: ['dre-operacional', dateFrom, dateTo, quoteCode, osNumber, periodType, vehicleTypeId],
    queryFn: async (): Promise<DreTable[]> => {
      const { from, to } = buildRange(dateFrom, dateTo);

      let quotesQuery = supabase
        .from('quotes')
        .select('id, quote_code, created_at, value, pricing_breakdown, vehicle_type_id');
      if (vehicleTypeId) {
        quotesQuery = quotesQuery.eq('vehicle_type_id', vehicleTypeId);
      }
      if (quoteCode?.trim()) {
        quotesQuery = quotesQuery.ilike('quote_code', `%${quoteCode.trim()}%`);
      }
      const { data: quotesData, error: quotesError } = await quotesQuery;
      if (quotesError) throw quotesError;

      type QuoteRow = {
        id: string;
        quote_code: string | null;
        created_at: string;
        value: number;
        pricing_breakdown: unknown;
        vehicle_type_id: string | null;
      };

      const quotes = ((quotesData ?? []) as QuoteRow[]).map((q) => ({
        id: q.id,
        quote_code: q.quote_code,
        created_at: q.created_at,
        value: q.value,
        pricing_breakdown: q.pricing_breakdown as Record<string, unknown> | null,
      }));

      const quoteIds = quotes.map((q) => q.id);

      let ordersQuery = supabase
        .from('orders')
        .select(
          `id, os_number, quote_id, value, created_at, pricing_breakdown,
           carreteiro_real, pedagio_real, descarga_real, waiting_time_cost,
           quote:quotes(id, quote_code, created_at, value, pricing_breakdown)`
        )
        .not('value', 'is', null)
        .gt('value', 0);

      if (vehicleTypeId) {
        ordersQuery = ordersQuery.eq('vehicle_type_id', vehicleTypeId);
      }

      if (osNumber?.trim()) {
        ordersQuery = ordersQuery.ilike('os_number', `%${osNumber.trim()}%`);
      }

      if (quoteIds.length > 0) {
        ordersQuery = ordersQuery.in('quote_id', quoteIds);
      } else if (quoteCode?.trim()) {
        return [];
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      type OrderRow = {
        id: string;
        os_number: string;
        quote_id: string | null;
        value: number;
        created_at: string;
        pricing_breakdown: unknown;
        carreteiro_real: number | null;
        pedagio_real: number | null;
        descarga_real: number | null;
        waiting_time_cost: number | null;
        quote?: {
          id?: string;
          quote_code?: string | null;
          created_at?: string;
          value?: number;
          pricing_breakdown?: unknown;
        } | null;
      };

      let orders = (ordersData ?? []) as OrderRow[];

      const orderIds = orders.map((o) => o.id);
      const tripCostItemsByOrderId = new Map<
        string,
        Array<{ order_id: string | null; scope: string; category: string; amount: number }>
      >();
      if (orderIds.length > 0) {
        const { data: tripCostItemsData } = await supabase
          .from('trip_cost_items')
          .select('order_id, scope, category, amount')
          .in('order_id', orderIds);
        for (const item of tripCostItemsData ?? []) {
          const orderId = item.order_id ?? '';
          if (!orderId) continue;
          const arr = tripCostItemsByOrderId.get(orderId) ?? [];
          arr.push({
            order_id: item.order_id,
            scope: item.scope,
            category: item.category,
            amount: item.amount,
          });
          tripCostItemsByOrderId.set(orderId, arr);
        }
      }

      const grisByOrderId = new Map<string, number>();
      if (orderIds.length > 0) {
        const { data: grisRows } = await supabase
          .from('order_gris_services')
          .select('order_id, amount_real')
          .in('order_id', orderIds);
        for (const row of grisRows ?? []) {
          const prev = grisByOrderId.get(row.order_id) ?? 0;
          grisByOrderId.set(row.order_id, prev + (row.amount_real ?? 0));
        }
      }

      const tables = buildDreTables({
        orders: orders.map((o) => ({
          id: o.id,
          os_number: o.os_number,
          quote_id: o.quote_id,
          value: o.value,
          created_at: o.created_at,
          pricing_breakdown: o.pricing_breakdown as Record<string, unknown> | null,
          carreteiro_real: o.carreteiro_real,
          pedagio_real: o.pedagio_real,
          descarga_real: o.descarga_real,
          waiting_time_cost: o.waiting_time_cost,
          quote_code: o.quote?.quote_code ?? null,
          quote_created_at: o.quote?.created_at ?? null,
          quote_value: o.quote?.value ?? null,
          quote_pricing_breakdown: (o.quote?.pricing_breakdown ?? null) as Record<
            string,
            unknown
          > | null,
        })),
        quotes,
        tripCostItemsByOrderId,
        grisByOrderId,
      });

      // Base temporal única: quote.created_at (fallback order.created_at)
      let filtered = tables;
      if (from || to) {
        filtered = filtered.filter((table) => {
          const d = new Date(table.reference_date);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }

      if (quoteCode?.trim()) {
        const filter = quoteCode.trim().toLowerCase();
        filtered = filtered.filter((t) => (t.quote_code ?? '').toLowerCase().includes(filter));
      }
      if (osNumber?.trim()) {
        const filter = osNumber.trim().toLowerCase();
        filtered = filtered.filter((t) => (t.os_number ?? '').toLowerCase().includes(filter));
      }

      if (periodType !== 'detail' && filtered.length > 0) {
        return consolidateDreTables(filtered, periodType);
      }
      return filtered;
    },
    enabled: enabled ?? true,
  });
}
