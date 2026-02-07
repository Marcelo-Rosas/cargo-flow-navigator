import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface RevenueByClientChartProps {
  data: { name: string; value: number }[];
  height?: number;
  yAxisWidth?: number;
  delay?: number;
}

export function RevenueByClientChart({
  data,
  height = 240,
  yAxisWidth = 100,
  delay = 0.25,
}: RevenueByClientChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Top Clientes por Faturamento
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            type="number"
            tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
            tickFormatter={(v) => formatCurrency(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(0, 0%, 100%)',
              border: '1px solid hsl(210, 20%, 88%)',
              borderRadius: '8px',
            }}
            formatter={(value) => [formatCurrency(value as number), 'Faturamento']}
          />
          <Bar dataKey="value" fill="hsl(142, 60%, 40%)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
