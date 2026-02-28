import { useQuery } from '@tanstack/react-query';
import { asDb, calcConversionRate, filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { StoredPricingBreakdown, formatRouteUf } from '@/lib/freightCalculator';

export interface TrendData {
  value: number;
  isPositive: boolean;
}

export interface DashboardStats {
  pipelineValue: number;
  conversionRate: number;
  activeOrders: number;
  deliveriesToday: number;
  pendingDocuments: number;
  criticalAlerts: number;
  // Trends calculated from real data
  pipelineTrend: TrendData | null;
  conversionTrend: TrendData | null;
}

// Helper to get start/end of a month
function getMonthRange(monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const currentMonth = getMonthRange(0);
      const lastMonth = getMonthRange(1);

      // Get pipeline value (quotes not lost or won)
      const { data: quotes } = await supabase
        .from('quotes')
        .select('value, stage')
        .not('stage', 'in', '("perdido","ganho")');

      const validQuotes = filterSupabaseRows<{ value: number; stage: string }>(quotes);
      const pipelineValue = validQuotes.reduce((acc, q) => acc + Number(q.value), 0);

      // Get conversion rate for all time
      const { data: allQuotes } = await supabase.from('quotes').select('stage, created_at');
      const validAllQuotes = filterSupabaseRows<{ stage: string; created_at: string }>(allQuotes);

      const totalQuotes = validAllQuotes.length;
      const wonQuotes = validAllQuotes.filter((q) => q.stage === 'ganho').length;
      const conversionRate = calcConversionRate(wonQuotes, totalQuotes);

      // Calculate pipeline trend (current month quotes vs last month)
      const { data: currentMonthQuotes } = await supabase
        .from('quotes')
        .select('value')
        .gte('created_at', currentMonth.start.toISOString())
        .lte('created_at', currentMonth.end.toISOString())
        .not('stage', 'in', '("perdido","ganho")');

      const { data: lastMonthQuotes } = await supabase
        .from('quotes')
        .select('value')
        .gte('created_at', lastMonth.start.toISOString())
        .lte('created_at', lastMonth.end.toISOString())
        .not('stage', 'in', '("perdido","ganho")');

      const validCurrentMonth = filterSupabaseRows<{ value: number }>(currentMonthQuotes);
      const validLastMonth = filterSupabaseRows<{ value: number }>(lastMonthQuotes);
      const currentMonthPipeline = validCurrentMonth.reduce((acc, q) => acc + Number(q.value), 0);
      const lastMonthPipeline = validLastMonth.reduce((acc, q) => acc + Number(q.value), 0);

      let pipelineTrend: TrendData | null = null;
      if (lastMonthPipeline > 0) {
        const pipelineChange =
          ((currentMonthPipeline - lastMonthPipeline) / lastMonthPipeline) * 100;
        pipelineTrend = {
          value: Math.abs(Math.round(pipelineChange)),
          isPositive: pipelineChange >= 0,
        };
      }

      // Calculate conversion trend (current month vs last month)
      const currentMonthTotal = validAllQuotes.filter((q) => {
        const date = new Date(q.created_at);
        return date >= currentMonth.start && date <= currentMonth.end;
      }).length;
      const currentMonthWon = validAllQuotes.filter((q) => {
        const date = new Date(q.created_at);
        return date >= currentMonth.start && date <= currentMonth.end && q.stage === 'ganho';
      }).length;

      const lastMonthTotal = validAllQuotes.filter((q) => {
        const date = new Date(q.created_at);
        return date >= lastMonth.start && date <= lastMonth.end;
      }).length;
      const lastMonthWon = validAllQuotes.filter((q) => {
        const date = new Date(q.created_at);
        return date >= lastMonth.start && date <= lastMonth.end && q.stage === 'ganho';
      }).length;

      const currentConversionRate =
        currentMonthTotal > 0 ? (currentMonthWon / currentMonthTotal) * 100 : 0;
      const lastConversionRate = lastMonthTotal > 0 ? (lastMonthWon / lastMonthTotal) * 100 : 0;

      let conversionTrend: TrendData | null = null;
      if (lastMonthTotal > 0 && currentMonthTotal > 0) {
        const relativeChange =
          lastConversionRate > 0
            ? ((currentConversionRate - lastConversionRate) / lastConversionRate) * 100
            : 0;
        conversionTrend = {
          value: Math.abs(Math.round(relativeChange)),
          isPositive: relativeChange >= 0,
        };
      }

      // Get active orders (not delivered)
      const { data: activeOrdersData } = await supabase
        .from('orders')
        .select('id')
        .neq('stage', asDb('entregue'));

      const activeOrders = activeOrdersData?.length || 0;

      // Get deliveries today (orders with ETA today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: deliveriesTodayData } = await supabase
        .from('orders')
        .select('id')
        .gte('eta', today.toISOString())
        .lt('eta', tomorrow.toISOString());

      const deliveriesToday = deliveriesTodayData?.length || 0;

      // Get pending documents (orders without all docs)
      const { data: ordersWithoutDocs } = await supabase
        .from('orders')
        .select('id')
        .or('has_nfe.eq.false,has_cte.eq.false,has_pod.eq.false')
        .neq('stage', asDb('entregue'));

      const pendingDocuments = ordersWithoutDocs?.length || 0;

      // Get critical alerts (unresolved critical occurrences)
      const { data: criticalOccurrences } = await supabase
        .from('occurrences')
        .select('id')
        .eq('severity', asDb('critica'))
        .is('resolved_at', null);

      const criticalAlerts = criticalOccurrences?.length || 0;

      return {
        pipelineValue,
        conversionRate,
        activeOrders,
        deliveriesToday,
        pendingDocuments,
        criticalAlerts,
        pipelineTrend,
        conversionTrend,
      } as DashboardStats;
    },
  });
}

export function useRecentOrders(limit = 5) {
  return useQuery({
    queryKey: ['recent-orders', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          *,
          occurrences (*)
        `
        )
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}

export function useConversionChartData() {
  return useQuery({
    queryKey: ['conversion-chart'],
    queryFn: async () => {
      // Get quotes grouped by month for last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: quotes } = await supabase
        .from('quotes')
        .select('stage, created_at')
        .gte('created_at', sixMonthsAgo.toISOString());

      const validQuotesConv = filterSupabaseRows<{ stage: string; created_at: string }>(quotes);

      // Group by month (keep stable ordering for the last 6 months)
      const monthKeys: string[] = [];
      const monthlyData: Record<string, { total: number; won: number }> = {};

      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        monthKeys.push(key);
        monthlyData[key] = { total: 0, won: 0 };
      }

      validQuotesConv.forEach((quote) => {
        const key = new Date(quote.created_at).toLocaleDateString('pt-BR', {
          month: 'short',
          year: '2-digit',
        });
        if (!monthlyData[key]) return;
        monthlyData[key].total++;
        if (quote.stage === 'ganho') monthlyData[key].won++;
      });

      return monthKeys.map((name) => {
        const data = monthlyData[name];
        return {
          name,
          value: data && data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
        };
      });
    },
  });
}

export function useRevenueByClientData() {
  return useQuery({
    queryKey: ['revenue-by-client'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('client_name, value')
        .eq('stage', asDb('entregue'));

      const validOrdersRev = filterSupabaseRows<{ client_name: string | null; value: number }>(
        orders
      );
      const clientRevenue: Record<string, number> = {};
      validOrdersRev.forEach((order) => {
        const client = order.client_name ?? 'Sem cliente';
        clientRevenue[client] = (clientRevenue[client] || 0) + Number(order.value);
      });

      // Sort and get top 5
      return Object.entries(clientRevenue)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    },
  });
}

// ─────────────────────────────────────────────────────────────
// R$/KM — Custo por Rota
// ─────────────────────────────────────────────────────────────

export interface RouteRsKm {
  route: string; // "SP→AM"
  avgRsKmAntt: number; // média R$/km baseado no piso ANTT
  avgRsKmReal: number; // média R$/km baseado no carreteiro_real pago
  delta: number; // avgRsKmReal - avgRsKmAntt
  deltaPercent: number; // delta / avgRsKmAntt * 100
  count: number; // nº de OS com carreteiro_real nessa rota
}

/** Agrega R$/KM por rota para exibição no Dashboard.
 *  Rotas identificadas por par de UF (SC→MG, SP→RJ…).
 *  Linhas sem UF identificável são ignoradas (não agrupadas em "Outras"). */
export function useRsKmByRoute(filter?: { month?: number | null; year?: number | null }) {
  const year = filter?.year ?? null;
  const month = filter?.month ?? null;

  return useQuery({
    queryKey: ['rskm-by-route', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          carreteiro_real,
          carreteiro_antt,
          km_distance,
          pricing_breakdown,
          origin,
          destination,
          created_at,
          quote:quotes(km_distance, pricing_breakdown)
        `
        )
        .not('carreteiro_real', 'is', null);

      if (error) throw error;

      type RawRow = {
        carreteiro_real: number | null;
        carreteiro_antt: number | null;
        km_distance: number | null;
        pricing_breakdown: unknown;
        origin: string;
        destination: string;
        created_at: string;
        quote: {
          km_distance: number | null;
          pricing_breakdown: unknown;
        } | null;
      };

      const allRows = filterSupabaseRows<RawRow>(data);

      // Aplica filtro de período em JS (evita complexidade de tipo no builder)
      const rows =
        year !== null
          ? allRows.filter((row) => {
              const d = new Date(row.created_at);
              if (d.getFullYear() !== year) return false;
              if (month !== null && d.getMonth() + 1 !== month) return false;
              return true;
            })
          : allRows;

      const grouped: Record<string, { sumAntt: number; sumReal: number; count: number }> = {};

      for (const row of rows) {
        const carrReal = Number(row.carreteiro_real ?? 0);
        const carrAntt = Number(row.carreteiro_antt ?? 0);
        const km = extractDistanceKm({
          quoteKmDistance: row.quote?.km_distance,
          orderKmDistance: row.km_distance,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          orderPricingBreakdown: row.pricing_breakdown,
        });
        if (km <= 0 || carrReal <= 0) continue;

        // Preferência: routeUfLabel salvo no breakdown; fallback: extrai UF de origin/destination
        const route = extractRouteLabel({
          origin: row.origin,
          destination: row.destination,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          orderPricingBreakdown: row.pricing_breakdown,
        });
        if (!route) continue; // Ignora linhas sem par UF identificável

        if (!grouped[route]) grouped[route] = { sumAntt: 0, sumReal: 0, count: 0 };
        grouped[route].sumReal += carrReal / km;
        grouped[route].sumAntt += carrAntt > 0 ? carrAntt / km : 0;
        grouped[route].count += 1;
      }

      return Object.entries(grouped)
        .map(([route, { sumAntt, sumReal, count }]): RouteRsKm => {
          const avgRsKmAntt = count > 0 ? sumAntt / count : 0;
          const avgRsKmReal = count > 0 ? sumReal / count : 0;
          const delta = avgRsKmReal - avgRsKmAntt;
          const deltaPercent = avgRsKmAntt > 0 ? (delta / avgRsKmAntt) * 100 : 0;
          return { route, avgRsKmAntt, avgRsKmReal, delta, deltaPercent, count };
        })
        .sort((a, b) => b.count - a.count);
    },
  });
}

export interface RouteRsKmDetailed extends RouteRsKm {
  avgRsKmPrevisto: number; // média R$/km previsto (custosCarreteiro do breakdown)
  quoteCount: number; // nº de cotações com km_distance nessa rota
}

function extractRouteLabel(input: {
  origin: string;
  destination: string;
  quotePricingBreakdown?: unknown | null;
  orderPricingBreakdown?: unknown | null;
}) {
  const quoteBd = input.quotePricingBreakdown as StoredPricingBreakdown | null;
  const orderBd = input.orderPricingBreakdown as StoredPricingBreakdown | null;
  return (
    quoteBd?.meta?.routeUfLabel ||
    orderBd?.meta?.routeUfLabel ||
    formatRouteUf(input.origin, input.destination) ||
    'Sem UF definida'
  );
}

function extractDistanceKm(input: {
  quoteKmDistance?: number | null;
  orderKmDistance?: number | null;
  quotePricingBreakdown?: unknown | null;
  orderPricingBreakdown?: unknown | null;
}) {
  const quoteKm = Number(input.quoteKmDistance ?? 0);
  if (quoteKm > 0) return quoteKm;

  const orderKm = Number(input.orderKmDistance ?? 0);
  if (orderKm > 0) return orderKm;

  const quoteBd = input.quotePricingBreakdown as StoredPricingBreakdown | null;
  const orderBd = input.orderPricingBreakdown as StoredPricingBreakdown | null;
  const breakdownKm = Number(
    quoteBd?.meta?.antt?.kmDistance ??
      orderBd?.meta?.antt?.kmDistance ??
      quoteBd?.meta?.kmBandUsed ??
      orderBd?.meta?.kmBandUsed ??
      0
  );
  if (breakdownKm > 0) return breakdownKm;

  return 0;
}

function extractPrevistoCarreteiro(input: {
  orderPricingBreakdown?: unknown | null;
  quotePricingBreakdown?: unknown | null;
  carreteiroAntt?: number | null;
}) {
  const orderBd = input.orderPricingBreakdown as StoredPricingBreakdown | null;
  const quoteBd = input.quotePricingBreakdown as StoredPricingBreakdown | null;

  const breakdownCarreteiro = Number(
    orderBd?.profitability?.custosCarreteiro ??
      quoteBd?.profitability?.custosCarreteiro ??
      (orderBd?.profitability as { custos_carreteiro?: number } | undefined)?.custos_carreteiro ??
      (quoteBd?.profitability as { custos_carreteiro?: number } | undefined)?.custos_carreteiro ??
      0
  );
  if (breakdownCarreteiro > 0) return breakdownCarreteiro;

  const antt = Number(input.carreteiroAntt ?? 0);
  if (antt > 0) return antt;

  return 0;
}

/** Versão estendida com contagem de cotações por rota — para a página de Relatórios.
 *  Rotas identificadas por par de UF; linhas sem UF são ignoradas. */
export function useRsKmDetailedReport(filter?: {
  month?: number | null;
  year?: number | null;
  vehicleTypeId?: string | null;
}) {
  const year = filter?.year ?? null;
  const month = filter?.month ?? null;
  const vehicleTypeId = filter?.vehicleTypeId ?? null;

  return useQuery({
    queryKey: ['rskm-detailed-report', year, month, vehicleTypeId],
    queryFn: async () => {
      // Cotações com km_distance — para calcular quoteCount por rota
      let quotesQuery = supabase
        .from('quotes')
        .select('km_distance, pricing_breakdown, origin, destination, created_at, vehicle_type_id')
        .not('km_distance', 'is', null);
      if (vehicleTypeId) {
        quotesQuery = quotesQuery.eq('vehicle_type_id', vehicleTypeId);
      }
      const { data: quotesData } = await quotesQuery;

      type QuoteRow = {
        km_distance: number | null;
        pricing_breakdown: unknown;
        origin: string;
        destination: string;
        created_at: string;
        vehicle_type_id: string | null;
      };
      const allQuotes = filterSupabaseRows<QuoteRow>(quotesData);
      const quotes =
        year !== null
          ? allQuotes.filter((q) => {
              const d = new Date(q.created_at);
              if (d.getFullYear() !== year) return false;
              if (month !== null && d.getMonth() + 1 !== month) return false;
              return true;
            })
          : allQuotes;

      // Contagem de cotações por rota (apenas rotas com UF identificável)
      const quoteCountByRoute: Record<string, number> = {};
      for (const q of quotes) {
        const bd = q.pricing_breakdown as StoredPricingBreakdown | null;
        const route = bd?.meta?.routeUfLabel || formatRouteUf(q.origin, q.destination);
        if (!route) continue;
        quoteCountByRoute[route] = (quoteCountByRoute[route] || 0) + 1;
      }

      // OS com carreteiro_real preenchido
      let ordersQuery = supabase
        .from('orders')
        .select(
          `carreteiro_real, carreteiro_antt, km_distance, pricing_breakdown, origin, destination, created_at, vehicle_type_id,
           quote:quotes(km_distance, pricing_breakdown, vehicle_type_id)`
        )
        .not('carreteiro_real', 'is', null);
      if (vehicleTypeId) {
        ordersQuery = ordersQuery.eq('vehicle_type_id', vehicleTypeId);
      }
      const { data: ordersData, error } = await ordersQuery;

      if (error) throw error;

      type OrderRow = {
        carreteiro_real: number | null;
        carreteiro_antt: number | null;
        km_distance: number | null;
        pricing_breakdown: unknown;
        origin: string;
        destination: string;
        created_at: string;
        vehicle_type_id: string | null;
        quote: {
          km_distance: number | null;
          pricing_breakdown: unknown;
          vehicle_type_id: string | null;
        } | null;
      };
      const allOrders = filterSupabaseRows<OrderRow>(ordersData);
      const orders =
        year !== null
          ? allOrders.filter((o) => {
              const d = new Date(o.created_at);
              if (d.getFullYear() !== year) return false;
              if (month !== null && d.getMonth() + 1 !== month) return false;
              return true;
            })
          : allOrders;

      const grouped: Record<string, { sumAntt: number; sumPrevisto: number; sumReal: number; count: number }> = {};
      for (const row of orders) {
        const carrReal = Number(row.carreteiro_real ?? 0);
        const carrAntt = Number(row.carreteiro_antt ?? 0);
        const carrPrevisto = extractPrevistoCarreteiro({
          orderPricingBreakdown: row.pricing_breakdown,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          carreteiroAntt: row.carreteiro_antt,
        });
        const km = extractDistanceKm({
          quoteKmDistance: row.quote?.km_distance,
          orderKmDistance: row.km_distance,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          orderPricingBreakdown: row.pricing_breakdown,
        });
        if (km <= 0 || carrReal <= 0) continue;

        const route = extractRouteLabel({
          origin: row.origin,
          destination: row.destination,
          quotePricingBreakdown: row.quote?.pricing_breakdown,
          orderPricingBreakdown: row.pricing_breakdown,
        });
        if (!route) continue; // Ignora linhas sem par UF identificável

        if (!grouped[route]) grouped[route] = { sumAntt: 0, sumPrevisto: 0, sumReal: 0, count: 0 };
        grouped[route].sumReal += carrReal / km;
        grouped[route].sumAntt += carrAntt > 0 ? carrAntt / km : 0;
        grouped[route].sumPrevisto += carrPrevisto > 0 ? carrPrevisto / km : 0;
        grouped[route].count += 1;
      }

      // Merge todos as rotas (cotações + OS)
      const allRoutes = new Set([...Object.keys(quoteCountByRoute), ...Object.keys(grouped)]);

      return Array.from(allRoutes)
        .map((route): RouteRsKmDetailed => {
          const g = grouped[route] ?? { sumAntt: 0, sumPrevisto: 0, sumReal: 0, count: 0 };
          const avgRsKmPrevisto = g.count > 0 ? g.sumPrevisto / g.count : 0;
          const avgRsKmAntt = g.count > 0 ? g.sumAntt / g.count : 0;
          const avgRsKmReal = g.count > 0 ? g.sumReal / g.count : 0;
          const delta = avgRsKmReal - avgRsKmPrevisto;
          const deltaPercent = avgRsKmPrevisto > 0 ? (delta / avgRsKmPrevisto) * 100 : 0;
          return {
            route,
            avgRsKmPrevisto,
            avgRsKmAntt,
            avgRsKmReal,
            delta,
            deltaPercent,
            count: g.count,
            quoteCount: quoteCountByRoute[route] ?? 0,
          };
        })
        .sort((a, b) => b.count - a.count || b.quoteCount - a.quoteCount);
    },
  });
}
