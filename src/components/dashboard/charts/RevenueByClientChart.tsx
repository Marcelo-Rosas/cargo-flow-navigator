import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface RevenueByClientPoint {
  name: string;
  value: number;
}

interface RevenueByClientChartProps {
  title: string;
  data: RevenueByClientPoint[];
  delay?: number;
  height?: number;
  yAxisWidth?: number;
}

export function RevenueByClientChart({
  title,
  data,
  delay = 0.25,
  height = 240,
  yAxisWidth = 100,
}: RevenueByClientChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            type="number"
            tick={{ fill: 'hsl(210, 15%, 46.9%)' }}
            tickFormatter={(value) => formatCurrency(value)}
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
