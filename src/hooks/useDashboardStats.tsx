import { useQuery } from '@tanstack/react-query';
import { filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

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
      const conversionRate = totalQuotes > 0 ? Math.round((wonQuotes / totalQuotes) * 100) : 0;

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
        const conversionChange = currentConversionRate - lastConversionRate;
        conversionTrend = {
          value: Math.abs(Math.round(conversionChange)),
          isPositive: conversionChange >= 0,
        };
      }

      // Get active orders (not delivered)
      const { data: activeOrdersData } = await supabase
        .from('orders')
        .select('id')
        .neq('stage', 'entregue');

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
        .neq('stage', 'entregue');

      const pendingDocuments = ordersWithoutDocs?.length || 0;

      // Get critical alerts (unresolved critical occurrences)
      const { data: criticalOccurrences } = await supabase
        .from('occurrences')
        .select('id')
        .eq('severity', 'critica')
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
        .eq('stage', 'entregue');

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
