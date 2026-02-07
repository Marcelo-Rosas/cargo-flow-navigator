import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type QuoteStage = Database['public']['Enums']['quote_stage'];
type OrderStage = Database['public']['Enums']['order_stage'];
type Quote = Database['public']['Tables']['quotes']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

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
      const { data, error } = await supabase
        .from('quotes')
        .select('stage, value');

      if (error) throw error;
      const quotes = (data || []) as Pick<Quote, 'stage' | 'value'>[];

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

      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('stage, value, created_at')
        .gte('created_at', sixMonthsAgo.toISOString());

      if (quotesError) throw quotesError;
      const quotes = (quotesData || []) as Pick<Quote, 'stage' | 'value' | 'created_at'>[];

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('value, created_at, stage')
        .gte('created_at', sixMonthsAgo.toISOString());

      if (ordersError) throw ordersError;
      const orders = (ordersData || []) as Pick<Order, 'value' | 'created_at' | 'stage'>[];

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
      const wonQuotesPerMonth: Record<string, number> = {};
      const totalQuotesPerMonth: Record<string, number> = {};

      quotes.forEach((quote) => {
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
      orders.forEach((order) => {
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

      // This month data
      const { data: quotesThisMonthData, error: q1Error } = await supabase
        .from('quotes')
        .select('value')
        .gte('created_at', thisMonthStart.toISOString());
      if (q1Error) throw q1Error;
      const quotesThisMonth = (quotesThisMonthData || []) as Pick<Quote, 'value'>[];

      const { data: ordersThisMonthData, error: o1Error } = await supabase
        .from('orders')
        .select('value, stage')
        .gte('created_at', thisMonthStart.toISOString());
      if (o1Error) throw o1Error;
      const ordersThisMonth = (ordersThisMonthData || []) as Pick<Order, 'value' | 'stage'>[];

      // Last month data
      const { data: quotesLastMonthData, error: q2Error } = await supabase
        .from('quotes')
        .select('value')
        .gte('created_at', lastMonthStart.toISOString())
        .lt('created_at', thisMonthStart.toISOString());
      if (q2Error) throw q2Error;
      const quotesLastMonth = (quotesLastMonthData || []) as Pick<Quote, 'value'>[];

      const { data: ordersLastMonthData, error: o2Error } = await supabase
        .from('orders')
        .select('value, stage')
        .gte('created_at', lastMonthStart.toISOString())
        .lt('created_at', thisMonthStart.toISOString());
      if (o2Error) throw o2Error;
      const ordersLastMonth = (ordersLastMonthData || []) as Pick<Order, 'value' | 'stage'>[];

      // Calculate averages
      const avgQuoteValue = quotesThisMonth.length > 0 
        ? quotesThisMonth.reduce((acc, q) => acc + Number(q.value), 0) / quotesThisMonth.length 
        : 0;
      const avgOrderValue = ordersThisMonth.length > 0 
        ? ordersThisMonth.reduce((acc, o) => acc + Number(o.value), 0) / ordersThisMonth.length 
        : 0;

      // Revenue calculations
      const revenueThisMonth = ordersThisMonth
        .filter((o) => o.stage === 'entregue')
        .reduce((acc, o) => acc + Number(o.value), 0);

      const revenueLastMonth = ordersLastMonth
        .filter((o) => o.stage === 'entregue')
        .reduce((acc, o) => acc + Number(o.value), 0);

      return {
        avgDeliveryTime: 3.5, // Placeholder - would need delivery date tracking
        avgQuoteValue,
        avgOrderValue,
        quotesThisMonth: quotesThisMonth.length,
        ordersThisMonth: ordersThisMonth.length,
        revenueThisMonth,
        quotesLastMonth: quotesLastMonth.length,
        ordersLastMonth: ordersLastMonth.length,
        revenueLastMonth,
      } as PerformanceMetrics;
    },
  });
}

export function useQuoteStageDistribution() {
  return useQuery({
    queryKey: ['quote-stage-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('stage');

      if (error) throw error;
      const quotes = (data || []) as Pick<Quote, 'stage'>[];

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
      const { data, error } = await supabase
        .from('orders')
        .select('stage');

      if (error) throw error;
      const orders = (data || []) as Pick<Order, 'stage'>[];

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
  quotes: Quote[];
  orders: Order[];
  clients: Client[];
}

export function useExportData() {
  return useQuery({
    queryKey: ['export-data'],
    queryFn: async () => {
      const { data: quotesData, error: qError } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (qError) throw qError;

      const { data: ordersData, error: oError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (oError) throw oError;

      const { data: clientsData, error: cError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (cError) throw cError;

      return {
        quotes: (quotesData as unknown as Quote[]) || [],
        orders: (ordersData as unknown as Order[]) || [],
        clients: (clientsData as unknown as Client[]) || [],
      };
    },
    enabled: false, // Only fetch when needed
  });
}
