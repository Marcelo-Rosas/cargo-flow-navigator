import { motion } from 'framer-motion';
import {
  useQuoteStageDistribution,
  useOrderStageDistribution,
} from '@/hooks/useAdvancedDashboardStats';
import { Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function StageDistributionChart() {
  const { data: quoteDistribution, isLoading: quotesLoading } = useQuoteStageDistribution();
  const { data: orderDistribution, isLoading: ordersLoading } = useOrderStageDistribution();

  const isLoading = quotesLoading || ordersLoading;

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Distribuição por Estágio</h3>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const renderPieChart = (data: typeof quoteDistribution) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Sem dados disponíveis
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="count"
            nameKey="label"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(0, 0%, 100%)',
              border: '1px solid hsl(210, 20%, 88%)',
              borderRadius: '8px',
            }}
            formatter={(value, name) => [value, name]}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <Tabs defaultValue="quotes">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Distribuição por Estágio</h3>
          <TabsList>
            <TabsTrigger value="quotes">Cotações</TabsTrigger>
            <TabsTrigger value="orders">OS</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="quotes">{renderPieChart(quoteDistribution)}</TabsContent>
        <TabsContent value="orders">{renderPieChart(orderDistribution)}</TabsContent>
      </Tabs>
    </motion.div>
  );
}
