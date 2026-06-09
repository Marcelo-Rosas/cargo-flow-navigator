import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingMatchAlertProps {
  nossoPreco: number;
  /** Frete seco CKAN (R$ total) */
  ckanBenchmarkLiquido?: number;
  /** Teto bruto CKAN após gross-up */
  ckanGrossValue?: number;
  status?: 'WIN' | 'LOSS' | 'WARNING';
}

export function PricingMatchAlert({
  nossoPreco,
  ckanBenchmarkLiquido,
  ckanGrossValue,
  status = 'WARNING',
}: PricingMatchAlertProps) {
  const refLiquido = ckanBenchmarkLiquido ?? 0;
  const maxVal = Math.max(nossoPreco, refLiquido, ckanGrossValue || 0);

  const getPercentageWidth = (val: number) => {
    if (maxVal === 0) return '0%';
    return `${(val / maxVal) * 100}%`;
  };

  const statusConfig = {
    WIN: {
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      text: 'Preço Competitivo',
    },
    LOSS: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      icon: <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />,
      text: 'Preço Fora de Mercado',
    },
    WARNING: {
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      icon: <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      text: 'Sem dados suficientes',
    },
  };

  const config = statusConfig[status];

  return (
    <Card className={cn('p-4 space-y-4 border-2', config.bg, config.border)}>
      <div className="flex items-center gap-2">
        {config.icon}
        <h3 className={cn('font-bold', config.color)}>{config.text}</h3>
      </div>

      <div className="space-y-3">
        {/* Nosso Preço */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <span>Nosso Preço</span>
            <span className={cn('font-bold', config.color)}>{formatCurrency(nossoPreco)}</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                status === 'WIN' ? 'bg-emerald-500' : 'bg-red-500'
              )}
              style={{ width: getPercentageWidth(nossoPreco) }}
            />
          </div>
        </div>

        {refLiquido > 0 ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>CKAN mercado (frete seco)</span>
              <span>{formatCurrency(refLiquido)}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full opacity-70"
                style={{ width: getPercentageWidth(refLiquido) }}
              />
            </div>
          </div>
        ) : null}

        {ckanGrossValue ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>CKAN teto bruto (gross-up)</span>
              <span>{formatCurrency(ckanGrossValue)}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-400 rounded-full opacity-70"
                style={{ width: getPercentageWidth(ckanGrossValue) }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
