import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  pipelineValue: number;
  conversionRate: number;
  activeOrders: number;
  deliveriesToday: number;
  pendingDocuments: number;
  criticalAlerts: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Get pipeline value (quotes not lost or won)
      const { data: quotes } = await supabase
        .from('quotes')
        .select('value, stage')
        .not('stage', 'in', '("perdido","ganho")');

      const pipelineValue = quotes?.reduce((acc, q) => acc + Number(q.value), 0) || 0;

      // Get conversion rate
      const { data: allQuotes } = await supabase
        .from('quotes')
        .select('stage');

      const totalQuotes = allQuotes?.length || 0;
      const wonQuotes = allQuotes?.filter(q => q.stage === 'ganho').length || 0;
      const conversionRate = totalQuotes > 0 ? Math.round((wonQuotes / totalQuotes) * 100) : 0;

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
        .select(`
          *,
          occurrences (*)
        `)
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

      // Group by month and calculate conversion rate
      const monthlyData: Record<string, { total: number; won: number }> = {};

      quotes?.forEach(quote => {
        const month = new Date(quote.created_at).toLocaleDateString('pt-BR', { month: 'short' });
        if (!monthlyData[month]) {
          monthlyData[month] = { total: 0, won: 0 };
        }
        monthlyData[month].total++;
        if (quote.stage === 'ganho') {
          monthlyData[month].won++;
        }
      });

      return Object.entries(monthlyData).map(([name, data]) => ({
        name,
        value: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
      }));
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

      // Group by client
      const clientRevenue: Record<string, number> = {};

      orders?.forEach(order => {
        const client = order.client_name;
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
