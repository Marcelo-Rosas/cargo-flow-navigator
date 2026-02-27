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

/** Agrega R$/KM por rota para exibição no Dashboard e Relatórios. */
export function useRsKmByRoute() {
  return useQuery({
    queryKey: ['rskm-by-route'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          carreteiro_real,
          carreteiro_antt,
          origin,
          destination,
          quote:quotes(km_distance, pricing_breakdown)
        `
        )
        .not('carreteiro_real', 'is', null);

      if (error) throw error;

      type RawRow = {
        carreteiro_real: number | null;
        carreteiro_antt: number | null;
        origin: string;
        destination: string;
        quote: {
          km_distance: number | null;
          pricing_breakdown: unknown;
        } | null;
      };

      const rows = filterSupabaseRows<RawRow>(data);

      const grouped: Record<string, { sumAntt: number; sumReal: number; count: number }> = {};

      for (const row of rows) {
        const carrReal = Number(row.carreteiro_real ?? 0);
        const carrAntt = Number(row.carreteiro_antt ?? 0);
        const km = Number(row.quote?.km_distance ?? 0);
        if (km <= 0 || carrReal <= 0) continue;

        // Determinar rota: preferência ao routeUfLabel salvo no breakdown
        const bd = row.quote?.pricing_breakdown as StoredPricingBreakdown | null;
        const route =
          bd?.meta?.routeUfLabel || formatRouteUf(row.origin, row.destination) || 'Outras';

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
  quoteCount: number; // nº de cotações com km_distance nessa rota
}

/** Versão estendida com contagem de cotações por rota — para a página de Relatórios. */
export function useRsKmDetailedReport() {
  return useQuery({
    queryKey: ['rskm-detailed-report'],
    queryFn: async () => {
      // Cotações com km_distance — para calcular R$/KM da referência ANTT por rota
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('km_distance, pricing_breakdown, origin, destination')
        .not('km_distance', 'is', null);

      type QuoteRow = {
        km_distance: number | null;
        pricing_breakdown: unknown;
        origin: string;
        destination: string;
      };
      const quotes = filterSupabaseRows<QuoteRow>(quotesData);

      // Contagem de cotações por rota
      const quoteCountByRoute: Record<string, number> = {};
      for (const q of quotes) {
        const bd = q.pricing_breakdown as StoredPricingBreakdown | null;
        const route = bd?.meta?.routeUfLabel || formatRouteUf(q.origin, q.destination) || 'Outras';
        quoteCountByRoute[route] = (quoteCountByRoute[route] || 0) + 1;
      }

      // OS com carreteiro_real preenchido
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(
          `carreteiro_real, carreteiro_antt, origin, destination,
           quote:quotes(km_distance, pricing_breakdown)`
        )
        .not('carreteiro_real', 'is', null);

      if (error) throw error;

      type OrderRow = {
        carreteiro_real: number | null;
        carreteiro_antt: number | null;
        origin: string;
        destination: string;
        quote: { km_distance: number | null; pricing_breakdown: unknown } | null;
      };
      const orders = filterSupabaseRows<OrderRow>(ordersData);

      const grouped: Record<string, { sumAntt: number; sumReal: number; count: number }> = {};
      for (const row of orders) {
        const carrReal = Number(row.carreteiro_real ?? 0);
        const carrAntt = Number(row.carreteiro_antt ?? 0);
        const km = Number(row.quote?.km_distance ?? 0);
        if (km <= 0 || carrReal <= 0) continue;

        const bd = row.quote?.pricing_breakdown as StoredPricingBreakdown | null;
        const route =
          bd?.meta?.routeUfLabel || formatRouteUf(row.origin, row.destination) || 'Outras';

        if (!grouped[route]) grouped[route] = { sumAntt: 0, sumReal: 0, count: 0 };
        grouped[route].sumReal += carrReal / km;
        grouped[route].sumAntt += carrAntt > 0 ? carrAntt / km : 0;
        grouped[route].count += 1;
      }

      // Merge todos as rotas (cotações + OS)
      const allRoutes = new Set([...Object.keys(quoteCountByRoute), ...Object.keys(grouped)]);

      return Array.from(allRoutes)
        .map((route): RouteRsKmDetailed => {
          const g = grouped[route] ?? { sumAntt: 0, sumReal: 0, count: 0 };
          const avgRsKmAntt = g.count > 0 ? g.sumAntt / g.count : 0;
          const avgRsKmReal = g.count > 0 ? g.sumReal / g.count : 0;
          const delta = avgRsKmReal - avgRsKmAntt;
          const deltaPercent = avgRsKmAntt > 0 ? (delta / avgRsKmAntt) * 100 : 0;
          return {
            route,
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
