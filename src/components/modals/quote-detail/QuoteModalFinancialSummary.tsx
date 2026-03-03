import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface QuoteModalFinancialSummaryProps {
  totalCliente: number;
  receitaLiquida?: number;
  resultadoLiquido: number;
  margemPercent: number;
  isBelowTarget: boolean;
  targetMarginPercent: number;
  marginPercentForAlert?: number;
}

export function QuoteModalFinancialSummary({
  totalCliente,
  receitaLiquida,
  resultadoLiquido,
  margemPercent,
  isBelowTarget,
  targetMarginPercent,
  marginPercentForAlert,
}: QuoteModalFinancialSummaryProps) {
  return (
    <div className="space-y-3">
      <div className={cn('grid gap-3', receitaLiquida != null ? 'grid-cols-3' : 'grid-cols-2')}>
        <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Faturamento Bruto
          </p>
          <p className="text-2xl font-bold text-primary tabular-nums">
            {formatCurrency(totalCliente)}
          </p>
        </div>
        {receitaLiquida != null && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Receita Líquida
            </p>
            <p className="text-xl font-bold text-foreground tabular-nums">
              {formatCurrency(receitaLiquida)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Após DAS e ICMS</p>
          </div>
        )}
        <div
          className={cn(
            'rounded-lg border p-4',
            isBelowTarget
              ? 'bg-destructive/5 border-destructive/20'
              : 'bg-success/5 border-success/20'
          )}
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Resultado Líquido
          </p>
          <p
            className={cn(
              'text-2xl font-bold tabular-nums',
              isBelowTarget ? 'text-destructive' : 'text-success'
            )}
          >
            {formatCurrency(resultadoLiquido)}
          </p>
          <Badge variant={isBelowTarget ? 'destructive' : 'default'} className="mt-2">
            Margem {(margemPercent || 0).toFixed(1)}%
          </Badge>
        </div>
      </div>
      {isBelowTarget && (marginPercentForAlert !== undefined || margemPercent !== undefined) && (
        <Alert
          variant="destructive"
          className="bg-warning/10 border-warning text-warning-foreground"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Margem de {(marginPercentForAlert ?? margemPercent).toFixed(1)}% está abaixo da meta de{' '}
            {targetMarginPercent}%
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
