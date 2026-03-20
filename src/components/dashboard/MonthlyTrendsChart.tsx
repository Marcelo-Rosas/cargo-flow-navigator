import { motion } from 'framer-motion';
import { useMonthlyTrends } from '@/hooks/useAdvancedDashboardStats';
import { Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function MonthlyTrendsChart() {
  const { data: trendsData, isLoading } = useMonthlyTrends();

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Tendências Mensais</h3>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">Tendências Mensais</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={trendsData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" tick={{ fill: 'hsl(210, 15%, 46.9%)' }} />
          <YAxis yAxisId="left" tick={{ fill: 'hsl(210, 15%, 46.9%)' }} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(0, 0%, 100%)',
              border: '1px solid hsl(210, 20%, 88%)',
              borderRadius: '8px',
            }}
            formatter={(value, name) => {
              if (name === 'revenue') return [formatCurrency(value as number), 'Receita'];
              if (name === 'quotes') return [value, 'Cotações'];
              if (name === 'orders') return [value, 'OS'];
              return [value, name];
            }}
          />
          <Legend
            formatter={(value) => {
              if (value === 'quotes') return 'Cotações';
              if (value === 'orders') return 'OS';
              if (value === 'revenue') return 'Receita';
              return value;
            }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="quotes"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="orders"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', strokeWidth: 2 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="revenue"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
