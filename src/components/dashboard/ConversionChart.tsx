import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ConversionChartProps {
  data: { name: string; value: number }[];
  height?: number;
  gradientId?: string;
  delay?: number;
}

export function ConversionChart({
  data,
  height = 240,
  gradientId = 'colorConversion',
  delay = 0.2,
}: ConversionChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">Taxa de Conversão</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(203, 82%, 26%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(203, 82%, 26%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fill: 'hsl(210, 15%, 46.9%)' }} />
          <YAxis tick={{ fill: 'hsl(210, 15%, 46.9%)' }} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(0, 0%, 100%)',
              border: '1px solid hsl(210, 20%, 88%)',
              borderRadius: '8px',
            }}
            formatter={(value) => [`${value}%`, 'Conversão']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(203, 82%, 26%)"
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
