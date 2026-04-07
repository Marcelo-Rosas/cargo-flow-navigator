import { DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { FREIGHT_CONSTANTS } from '@/lib/freightCalculator';

interface FinancialValuesBlockProps {
  amount: number;
  totals?: {
    receitaBruta?: number;
    das?: number;
    totalCliente?: number;
    icms?: number;
  } | null;
  profitability?: {
    margemPercent?: number;
    resultadoLiquido?: number;
    margemBruta?: number;
  } | null;
  carreteiroAntt?: number | null;
  carreteiroReal?: number | null;
}

export function FinancialValuesBlock({
  amount,
  totals,
  profitability,
  carreteiroAntt,
  carreteiroReal,
}: FinancialValuesBlockProps) {
  return (
    <>
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <DollarSign className="w-5 h-5" />
            <span className="font-medium">Valor do Documento</span>
          </div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
        </div>

        {totals && (
          <div className="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2 text-sm">
            {totals.receitaBruta != null && (
              <div>
                <p className="text-[10px] text-muted-foreground">Receita Bruta</p>
                <p className="font-medium">{formatCurrency(totals.receitaBruta)}</p>
              </div>
            )}
            {totals.das != null && (
              <div>
                <p className="text-[10px] text-muted-foreground">DAS</p>
                <p className="font-medium">{formatCurrency(totals.das)}</p>
              </div>
            )}
          </div>
        )}

        {profitability && profitability.margemPercent != null && (
          <div className="mt-2 pt-2 border-t border-primary/10 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Margem Operacional</span>
            <Badge
              variant={profitability.margemPercent < FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT ? 'destructive' : 'default'}
              className={
                profitability.margemPercent >= FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : ''
              }
            >
              {profitability.margemPercent.toFixed(1)}%
            </Badge>
          </div>
        )}
      </div>

      {/* PAG-specific: carreteiro */}
      {(carreteiroAntt != null || carreteiroReal != null) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <p className="text-[10px] text-muted-foreground">Carreteiro ANTT</p>
            <p className="font-semibold text-sm">
              {carreteiroAntt != null ? formatCurrency(Number(carreteiroAntt)) : '—'}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <p className="text-[10px] text-muted-foreground">Carreteiro Real</p>
            <p className="font-semibold text-sm">
              {carreteiroReal != null ? formatCurrency(Number(carreteiroReal)) : '—'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
