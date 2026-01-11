import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Truck, 
  FileText, 
  AlertTriangle,
  DollarSign,
  Target
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { RecentOrdersList } from '@/components/dashboard/RecentOrdersList';
import { AlertsWidget } from '@/components/dashboard/AlertsWidget';
import { mockOrders, mockKPIs } from '@/data/mockData';
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

const conversionData = [
  { name: 'Jan', value: 28 },
  { name: 'Fev', value: 32 },
  { name: 'Mar', value: 29 },
  { name: 'Abr', value: 35 },
  { name: 'Mai', value: 38 },
  { name: 'Jun', value: 42 },
];

const revenueByClientData = [
  { name: 'Loja Virtual', value: 45000 },
  { name: 'Tech Solutions', value: 38000 },
  { name: 'Agro Brasil', value: 32000 },
  { name: 'Móveis Premium', value: 28000 },
  { name: 'Química Ind.', value: 24000 },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

export default function Dashboard() {
  return (
    <MainLayout>
      {/* Page Header */}
      <div className="mb-8">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <KPICard
          title="Pipeline Total"
          value={formatCurrency(mockKPIs.pipelineValue)}
          icon={DollarSign}
          trend={{ value: 12, isPositive: true }}
          variant="primary"
          delay={0}
        />
        <KPICard
          title="Taxa de Conversão"
          value={`${mockKPIs.conversionRate}%`}
          icon={Target}
          trend={{ value: 5, isPositive: true }}
          variant="success"
          delay={0.05}
        />
        <KPICard
          title="OS Ativas"
          value={mockKPIs.activeOrders}
          subtitle="Em operação"
          icon={Truck}
          variant="default"
          delay={0.1}
        />
        <KPICard
          title="Entregas Hoje"
          value={mockKPIs.deliveriesToday}
          subtitle="Previstas"
          icon={TrendingUp}
          variant="default"
          delay={0.15}
        />
        <KPICard
          title="Docs Pendentes"
          value={mockKPIs.pendingDocuments}
          subtitle="Aguardando"
          icon={FileText}
          variant="warning"
          delay={0.2}
        />
        <KPICard
          title="Alertas Críticos"
          value={mockKPIs.criticalAlerts}
          subtitle="Requer ação"
          icon={AlertTriangle}
          variant="destructive"
          delay={0.25}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
            <AreaChart data={conversionData}>
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
            <BarChart data={revenueByClientData} layout="vertical">
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

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentOrdersList orders={mockOrders} />
        </div>
        <div>
          <AlertsWidget />
        </div>
      </div>
    </MainLayout>
  );
}
