import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type QuoteStage = Database['public']['Enums']['quote_stage'];
type OrderStage = Database['public']['Enums']['order_stage'];

export interface FunnelData {
  stage: string;
  count: number;
  value: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  quotes: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

export interface PerformanceMetrics {
  avgDeliveryTime: number;
  avgQuoteValue: number;
  avgOrderValue: number;
  quotesThisMonth: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  quotesLastMonth: number;
  ordersLastMonth: number;
  revenueLastMonth: number;
}

export interface StageDistribution {
  stage: string;
  label: string;
  count: number;
  color: string;
}

const QUOTE_STAGE_LABELS: Record<QuoteStage, string> = {
  novo_pedido: 'Novo Pedido',
  qualificacao: 'Qualificação',
  precificacao: 'Precificação',
  enviado: 'Enviado',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

const ORDER_STAGE_LABELS: Record<OrderStage, string> = {
  ordem_criada: 'Ordem Criada',
  busca_motorista: 'Busca Motorista',
  documentacao: 'Documentação',
  coleta_realizada: 'Coleta Realizada',
  em_transito: 'Em Trânsito',
  entregue: 'Entregue',
};

export function useSalesFunnel() {
  return useQuery({
    queryKey: ['sales-funnel'],
    queryFn: async () => {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('stage, value');

      if (!quotes) return [];

      const stageOrder: QuoteStage[] = [
        'novo_pedido',
        'qualificacao',
        'precificacao',
        'enviado',
        'negociacao',
        'ganho',
      ];

      const stageData = stageOrder.map((stage) => {
        const stageQuotes = quotes.filter((q) => q.stage === stage);
        return {
          stage: QUOTE_STAGE_LABELS[stage],
          count: stageQuotes.length,
          value: stageQuotes.reduce((acc, q) => acc + Number(q.value), 0),
        };
      });

      const maxCount = Math.max(...stageData.map((d) => d.count), 1);
      
      return stageData.map((d) => ({
        ...d,
        percentage: Math.round((d.count / maxCount) * 100),
      })) as FunnelData[];
    },
  });
}

export function useMonthlyTrends() {
  return useQuery({
    queryKey: ['monthly-trends'],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: quotes } = await supabase
        .from('quotes')
        .select('stage, value, created_at')
        .gte('created_at', sixMonthsAgo.toISOString());

      const { data: orders } = await supabase
        .from('orders')
        .select('value, created_at, stage')
        .gte('created_at', sixMonthsAgo.toISOString());

      const monthlyData: Record<string, MonthlyTrend> = {};

      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        monthlyData[monthKey] = {
          month: monthKey,
          quotes: 0,
          orders: 0,
          revenue: 0,
          conversionRate: 0,
        };
      }

      // Count quotes
      let wonQuotesPerMonth: Record<string, number> = {};
      let totalQuotesPerMonth: Record<string, number> = {};

      quotes?.forEach((quote) => {
        const monthKey = new Date(quote.created_at).toLocaleDateString('pt-BR', { 
          month: 'short', 
          year: '2-digit' 
        });
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].quotes++;
          totalQuotesPerMonth[monthKey] = (totalQuotesPerMonth[monthKey] || 0) + 1;
          if (quote.stage === 'ganho') {
            wonQuotesPerMonth[monthKey] = (wonQuotesPerMonth[monthKey] || 0) + 1;
          }
        }
      });

      // Count orders and revenue
      orders?.forEach((order) => {
        const monthKey = new Date(order.created_at).toLocaleDateString('pt-BR', { 
          month: 'short', 
          year: '2-digit' 
        });
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].orders++;
          if (order.stage === 'entregue') {
            monthlyData[monthKey].revenue += Number(order.value);
          }
        }
      });

      // Calculate conversion rates
      Object.keys(monthlyData).forEach((monthKey) => {
        const total = totalQuotesPerMonth[monthKey] || 0;
        const won = wonQuotesPerMonth[monthKey] || 0;
        monthlyData[monthKey].conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;
      });

      return Object.values(monthlyData);
    },
  });
}

export function usePerformanceMetrics() {
  return useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // This month data
      const { data: quotesThisMonth } = await supabase
        .from('quotes')
        .select('value')
        .gte('created_at', thisMonthStart.toISOString());

      const { data: ordersThisMonth } = await supabase
        .from('orders')
        .select('value, stage')
        .gte('created_at', thisMonthStart.toISOString());

      // Last month data
      const { data: quotesLastMonth } = await supabase
        .from('quotes')
        .select('value')
        .gte('created_at', lastMonthStart.toISOString())
        .lt('created_at', thisMonthStart.toISOString());

      const { data: ordersLastMonth } = await supabase
        .from('orders')
        .select('value, stage')
        .gte('created_at', lastMonthStart.toISOString())
        .lt('created_at', thisMonthStart.toISOString());

      // Calculate averages
      const allQuotes = quotesThisMonth || [];
      const allOrders = ordersThisMonth || [];
      const avgQuoteValue = allQuotes.length > 0 
        ? allQuotes.reduce((acc, q) => acc + Number(q.value), 0) / allQuotes.length 
        : 0;
      const avgOrderValue = allOrders.length > 0 
        ? allOrders.reduce((acc, o) => acc + Number(o.value), 0) / allOrders.length 
        : 0;

      // Revenue calculations
      const revenueThisMonth = (ordersThisMonth || [])
        .filter((o) => o.stage === 'entregue')
        .reduce((acc, o) => acc + Number(o.value), 0);

      const revenueLastMonth = (ordersLastMonth || [])
        .filter((o) => o.stage === 'entregue')
        .reduce((acc, o) => acc + Number(o.value), 0);

      return {
        avgDeliveryTime: 3.5, // Placeholder - would need delivery date tracking
        avgQuoteValue,
        avgOrderValue,
        quotesThisMonth: quotesThisMonth?.length || 0,
        ordersThisMonth: ordersThisMonth?.length || 0,
        revenueThisMonth,
        quotesLastMonth: quotesLastMonth?.length || 0,
        ordersLastMonth: ordersLastMonth?.length || 0,
        revenueLastMonth,
      } as PerformanceMetrics;
    },
  });
}

export function useQuoteStageDistribution() {
  return useQuery({
    queryKey: ['quote-stage-distribution'],
    queryFn: async () => {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('stage');

      if (!quotes) return [];

      const stageCounts: Record<string, number> = {};
      quotes.forEach((q) => {
        stageCounts[q.stage] = (stageCounts[q.stage] || 0) + 1;
      });

      const colors: Record<QuoteStage, string> = {
        novo_pedido: '#6b7280',
        qualificacao: '#8b5cf6',
        precificacao: '#3b82f6',
        enviado: '#f59e0b',
        negociacao: '#f97316',
        ganho: '#10b981',
        perdido: '#ef4444',
      };

      return Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        label: QUOTE_STAGE_LABELS[stage as QuoteStage],
        count,
        color: colors[stage as QuoteStage] || '#6b7280',
      })) as StageDistribution[];
    },
  });
}

export function useOrderStageDistribution() {
  return useQuery({
    queryKey: ['order-stage-distribution'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('stage');

      if (!orders) return [];

      const stageCounts: Record<string, number> = {};
      orders.forEach((o) => {
        stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1;
      });

      const colors: Record<OrderStage, string> = {
        ordem_criada: '#6b7280',
        busca_motorista: '#8b5cf6',
        documentacao: '#3b82f6',
        coleta_realizada: '#f59e0b',
        em_transito: '#f97316',
        entregue: '#10b981',
      };

      return Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        label: ORDER_STAGE_LABELS[stage as OrderStage],
        count,
        color: colors[stage as OrderStage] || '#6b7280',
      })) as StageDistribution[];
    },
  });
}

export interface ExportData {
  quotes: any[];
  orders: any[];
  clients: any[];
}

export function useExportData() {
  return useQuery({
    queryKey: ['export-data'],
    queryFn: async () => {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      return {
        quotes: quotes || [],
        orders: orders || [],
        clients: clients || [],
      } as ExportData;
    },
    enabled: false, // Only fetch when needed
  });
}
