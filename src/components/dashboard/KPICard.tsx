import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  delay?: number;
}

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

function formatTrendPct(value: number, isPositive: boolean): string {
  const sign = isPositive ? '+' : '';
  const formatted = value.toFixed(2).replace('.', ',');
  return `${sign}${formatted}%`;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  delay = 0,
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 0.9, 0.32, 1] }}
      className={cn('h-full p-6 rounded-xl border border-border bg-card shadow-card card-hover')}
    >
      <div className="flex items-start justify-between gap-4 h-full">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          {/* Top row: label + trend */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            {trend && (
              <span
                className={cn(
                  'text-sm font-medium tabular-nums whitespace-nowrap',
                  trend.isPositive ? 'text-[#16a34a]' : 'text-[#dc2626]'
                )}
              >
                {formatTrendPct(trend.value, trend.isPositive)}
              </span>
            )}
          </div>

          {/* Big value */}
          <motion.span
            className="text-2xl font-bold text-foreground tabular-nums"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: delay + 0.2 }}
          >
            {value}
          </motion.span>

          {/* Subtitle line */}
          <p className="text-sm text-muted-foreground min-h-[20px]">{subtitle ?? ' '}</p>
        </div>

        <div className={cn('shrink-0 p-3 rounded-lg', iconVariantStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
