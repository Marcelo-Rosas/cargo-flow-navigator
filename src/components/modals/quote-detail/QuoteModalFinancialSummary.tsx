import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface QuoteModalFinancialSummaryProps {
  totalCliente: number;
  discount?: number;
  receitaLiquida?: number;
  resultadoLiquido: number;
  margemPercent: number;
  isBelowTarget: boolean;
  targetMarginPercent: number;
  marginPercentForAlert?: number;
  regimeFiscal?: string;
}

export function QuoteModalFinancialSummary({
  totalCliente,
  discount = 0,
  receitaLiquida,
  resultadoLiquido,
  margemPercent,
  isBelowTarget,
  targetMarginPercent,
  marginPercentForAlert,
  regimeFiscal,
}: QuoteModalFinancialSummaryProps) {
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70 mb-1">
              Faturamento Bruto
            </p>
            <p className="text-3xl font-bold text-primary tabular-nums">
              {formatCurrency(totalCliente)}
            </p>
            {discount > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                Desconto aplicado: -{formatCurrency(discount)}
              </p>
            )}
          </div>
          <Badge
            variant={isBelowTarget ? 'destructive' : 'default'}
            className={
              !isBelowTarget
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : ''
            }
          >
            Margem Op. {(margemPercent || 0).toFixed(1)}%
          </Badge>
        </div>

        <div className="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-primary/60 mb-0.5">Resultado Líquido</p>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                isBelowTarget ? 'text-destructive' : 'text-success'
              )}
            >
              {formatCurrency(resultadoLiquido)}
            </p>
          </div>
          {receitaLiquida != null && (
            <div>
              <p className="text-[10px] text-primary/60 mb-0.5">Receita Líquida</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(receitaLiquida)}</p>
              <p className="text-[10px] text-primary/40">
                {regimeFiscal === 'lucro_presumido'
                  ? 'Após PIS, COFINS, IRPJ, CSLL e ICMS'
                  : 'Após DAS e ICMS'}
              </p>
            </div>
          )}
        </div>
      </div>

      {isBelowTarget && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Abaixo do Mínimo Viável.</strong> Margem de{' '}
            {(marginPercentForAlert ?? margemPercent).toFixed(1)}% está abaixo da meta de{' '}
            {targetMarginPercent}%
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
