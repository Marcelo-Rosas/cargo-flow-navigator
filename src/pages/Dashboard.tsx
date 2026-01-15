import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Truck, 
  FileText, 
  AlertTriangle,
  DollarSign,
  Target,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { RecentOrdersList } from '@/components/dashboard/RecentOrdersList';
import { AlertsWidget } from '@/components/dashboard/AlertsWidget';
import { SalesFunnel } from '@/components/dashboard/SalesFunnel';
import { MonthlyTrendsChart } from '@/components/dashboard/MonthlyTrendsChart';
import { PerformanceCards } from '@/components/dashboard/PerformanceCards';
import { StageDistributionChart } from '@/components/dashboard/StageDistributionChart';
import { ExportReports } from '@/components/dashboard/ExportReports';
import { useDashboardStats, useRecentOrders, useConversionChartData, useRevenueByClientData } from '@/hooks/useDashboardStats';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryClient } from '@tanstack/react-query';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

// Fallback data for empty states
const emptyConversionData = [
  { name: 'Jan', value: 0 },
  { name: 'Fev', value: 0 },
  { name: 'Mar', value: 0 },
];

const emptyRevenueData = [
  { name: 'Sem dados', value: 0 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentOrders, isLoading: ordersLoading } = useRecentOrders(5);
  const { data: conversionData } = useConversionChartData();
  const { data: revenueData } = useRevenueByClientData();

  // Enable realtime updates
  useRealtimeSubscription(['quotes', 'orders', 'occurrences']);

  const chartConversionData = conversionData?.length ? conversionData : emptyConversionData;
  const chartRevenueData = revenueData?.length ? revenueData : emptyRevenueData;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['recent-orders'] });
    queryClient.invalidateQueries({ queryKey: ['conversion-chart'] });
    queryClient.invalidateQueries({ queryKey: ['revenue-by-client'] });
    queryClient.invalidateQueries({ queryKey: ['sales-funnel'] });
    queryClient.invalidateQueries({ queryKey: ['monthly-trends'] });
    queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['quote-stage-distribution'] });
    queryClient.invalidateQueries({ queryKey: ['order-stage-distribution'] });
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo ao Vectra Cargo</h2>
            <p className="text-muted-foreground">Faça login para acessar o dashboard</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <motion.h1 
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Dashboard
          </motion.h1>
          <motion.p 
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Visão geral do seu pipeline comercial e operacional
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <ExportReports />
        </motion.div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {statsLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <KPICard
              title="Pipeline Total"
              value={formatCurrency(stats?.pipelineValue || 0)}
              icon={DollarSign}
              trend={{ value: 12, isPositive: true }}
              variant="primary"
              delay={0}
            />
            <KPICard
              title="Taxa de Conversão"
              value={`${stats?.conversionRate || 0}%`}
              icon={Target}
              trend={{ value: 5, isPositive: true }}
              variant="success"
              delay={0.05}
            />
            <KPICard
              title="OS Ativas"
              value={stats?.activeOrders || 0}
              subtitle="Em operação"
              icon={Truck}
              variant="default"
              delay={0.1}
            />
            <KPICard
              title="Entregas Hoje"
              value={stats?.deliveriesToday || 0}
              subtitle="Previstas"
              icon={TrendingUp}
              variant="default"
              delay={0.15}
            />
            <KPICard
              title="Docs Pendentes"
              value={stats?.pendingDocuments || 0}
              subtitle="Aguardando"
              icon={FileText}
              variant="warning"
              delay={0.2}
            />
            <KPICard
              title="Alertas Críticos"
              value={stats?.criticalAlerts || 0}
              subtitle="Requer ação"
              icon={AlertTriangle}
              variant="destructive"
              delay={0.25}
            />
          </>
        )}
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="commercial">Comercial</TabsTrigger>
          <TabsTrigger value="operations">Operacional</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Performance Cards */}
          <PerformanceCards />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-card rounded-xl border border-border shadow-card p-6"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Taxa de Conversão
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartConversionData}>
                  <defs>
                    <linearGradient id="colorConversion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(203, 82%, 26%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(203, 82%, 26%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="name" 
                    className="text-muted-foreground"
                    tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
                  />
                  <YAxis 
                    className="text-muted-foreground"
                    tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(210, 20%, 88%)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [`${value}%`, 'Conversão']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(203, 82%, 26%)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorConversion)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Revenue by Client Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="bg-card rounded-xl border border-border shadow-card p-6"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Faturamento por Cliente
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartRevenueData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    type="number"
                    className="text-muted-foreground"
                    tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    width={100}
                    className="text-muted-foreground"
                    tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(210, 20%, 88%)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [formatCurrency(value as number), 'Faturamento']}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="hsl(142, 60%, 40%)" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Monthly Trends */}
          <MonthlyTrendsChart />

          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {ordersLoading ? (
                <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center justify-center h-64">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <RecentOrdersList orders={recentOrders || []} />
              )}
            </div>
            <div>
              <AlertsWidget />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="commercial" className="space-y-6">
          {/* Sales Funnel and Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesFunnel />
            <StageDistributionChart />
          </div>

          {/* Conversion Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-card rounded-xl border border-border shadow-card p-6"
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Evolução da Taxa de Conversão
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartConversionData}>
                <defs>
                  <linearGradient id="colorConversion2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(203, 82%, 26%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(203, 82%, 26%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(0, 0%, 100%)',
                    border: '1px solid hsl(210, 20%, 88%)',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => [`${value}%`, 'Conversão']}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(203, 82%, 26%)" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorConversion2)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Clients */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="bg-card rounded-xl border border-border shadow-card p-6"
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Top Clientes por Faturamento
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartRevenueData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  type="number"
                  tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <YAxis 
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(0, 0%, 100%)',
                    border: '1px solid hsl(210, 20%, 88%)',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => [formatCurrency(value as number), 'Faturamento']}
                />
                <Bar 
                  dataKey="value" 
                  fill="hsl(142, 60%, 40%)" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          {/* Monthly Trends */}
          <MonthlyTrendsChart />

          {/* Stage Distribution and Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StageDistributionChart />
            <div>
              {ordersLoading ? (
                <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center justify-center h-64">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <RecentOrdersList orders={recentOrders || []} />
              )}
            </div>
          </div>

          {/* Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AlertsWidget />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-card rounded-xl border border-border shadow-card p-6"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Resumo de Documentação
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg">
                  <span className="font-medium text-foreground">Documentação Completa</span>
                  <span className="text-2xl font-bold text-success">
                    {stats ? stats.activeOrders - stats.pendingDocuments : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-warning/10 rounded-lg">
                  <span className="font-medium text-foreground">Aguardando Documentos</span>
                  <span className="text-2xl font-bold text-warning">
                    {stats?.pendingDocuments || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg">
                  <span className="font-medium text-foreground">Ocorrências Críticas</span>
                  <span className="text-2xl font-bold text-destructive">
                    {stats?.criticalAlerts || 0}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
