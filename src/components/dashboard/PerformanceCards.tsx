import { motion } from 'framer-motion';
import { usePerformanceMetrics } from '@/hooks/useAdvancedDashboardStats';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

interface MetricCardProps {
  title: string;
  currentValue: number | string;
  previousValue?: number;
  format?: 'currency' | 'number' | 'percent';
  delay?: number;
}

function MetricCard({
  title,
  currentValue,
  previousValue,
  format = 'number',
  delay = 0,
}: MetricCardProps) {
  const current = typeof currentValue === 'number' ? currentValue : parseFloat(currentValue);
  const previous = previousValue || 0;

  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isPositive = percentChange > 0;
  const isNeutral = percentChange === 0;

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card rounded-xl border border-border shadow-card p-5"
    >
      <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-foreground">
          {typeof currentValue === 'string' ? currentValue : formatValue(current)}
        </span>
        {previousValue !== undefined && (
          <div
            className={cn(
              'flex items-center text-sm font-medium',
              isNeutral ? 'text-muted-foreground' : isPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {isNeutral ? (
              <Minus className="w-4 h-4 mr-1" />
            ) : isPositive ? (
              <ArrowUpRight className="w-4 h-4 mr-1" />
            ) : (
              <ArrowDownRight className="w-4 h-4 mr-1" />
            )}
            {Math.abs(percentChange).toFixed(1)}%
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function PerformanceCards() {
  const { data: metrics, isLoading } = usePerformanceMetrics();

  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-xl border border-border shadow-card p-5 animate-pulse"
          >
            <div className="h-4 bg-muted rounded w-24 mb-2" />
            <div className="h-8 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">Performance do Mês</h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Cotações Criadas"
          currentValue={metrics.quotesThisMonth}
          previousValue={metrics.quotesLastMonth}
          delay={0.45}
        />
        <MetricCard
          title="OS Criadas"
          currentValue={metrics.ordersThisMonth}
          previousValue={metrics.ordersLastMonth}
          delay={0.5}
        />
        <MetricCard
          title="Receita Realizada"
          currentValue={metrics.revenueThisMonth}
          previousValue={metrics.revenueLastMonth}
          format="currency"
          delay={0.55}
        />
        <MetricCard
          title="Ticket Médio Cotação"
          currentValue={metrics.avgQuoteValue}
          format="currency"
          delay={0.6}
        />
        <MetricCard
          title="Ticket Médio OS"
          currentValue={metrics.avgOrderValue}
          format="currency"
          delay={0.65}
        />
        <MetricCard
          title="Tempo Médio Entrega"
          currentValue={`${metrics.avgDeliveryTime} dias`}
          delay={0.7}
        />
      </div>
    </motion.div>
  );
}
