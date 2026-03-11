import { useState } from 'react';
import { Receipt, Loader2, Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { useDreComparativoReport } from '@/hooks/useDreComparativoReport';
import { cn } from '@/lib/utils';
import type { DreGroupBy } from '@/modules/dre';
import { Link } from 'react-router-dom';

const DRE_GROUP_OPTIONS: { value: DreGroupBy; label: string }[] = [
  { value: 'order', label: 'Por OS' },
  { value: 'trip', label: 'Por Viagem' },
  { value: 'quote', label: 'Por Cotação' },
];

const REPORT_THIS_YEAR = new Date().getFullYear();

export function DreConsolidatedPanel() {
  const [year] = useState<number>(REPORT_THIS_YEAR);
  const [month] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<DreGroupBy>('order');

  const { data: dreRows, isLoading } = useDreComparativoReport({
    year,
    month,
    vehicleTypeId: null,
    groupBy,
    enabled: true,
  });

  const totalPresumido = dreRows?.reduce((s, r) => s + r.resultadoPresumido, 0) ?? 0;
  const totalReal = dreRows?.reduce((s, r) => s + r.resultadoReal, 0) ?? 0;
  const delta = totalReal - totalPresumido;
  const deltaPositive = delta >= 0;
  const receitaTotal = dreRows?.reduce((s, r) => s + r.receitaPresumida, 0) ?? 0;
  const margemPresumidaPercent = receitaTotal > 0 ? (totalPresumido / receitaTotal) * 100 : 0;
  const margemRealPercent = receitaTotal > 0 ? (totalReal / receitaTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">DRE Presumido vs Real</h2>
            <p className="text-sm text-muted-foreground">
              Margem planejada na cotação vs executada com custo operacional real
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as DreGroupBy)}
            className="text-sm border border-border rounded-md px-3 py-2 bg-background"
          >
            {DRE_GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" asChild>
            <Link to="/relatorios">
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Ver relatório completo
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !dreRows || dreRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 p-12 text-center">
          <Info className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Nenhuma OS com carreteiro real preenchido em {year}.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            O DRE comparativo exibe margem presumida vs real. Preencha o valor do carreteiro nas OS
            para ver a variação.
          </p>
        </div>
      ) : (
        <>
          <div
            className="rounded-xl border p-4 text-xs text-muted-foreground bg-muted/30"
            title="Faturamento e tributos permanecem fixos; apenas custos operacionais reais (carreteiro, pedágio, descarga) alteram a margem."
          >
            <strong>Regra contábil:</strong> Receita, DAS, ICMS e Overhead permanecem fixos entre
            presumido e real. Apenas custos operacionais (carreteiro, pedágio, descarga) variam no
            realizado.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-xl border border-border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">Resultado Presumido</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(totalPresumido)}</p>
            </div>
            <div className="rounded-xl border border-border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">Resultado Real</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(totalReal)}</p>
            </div>
            <div
              className={cn(
                'rounded-xl border p-4',
                deltaPositive
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-destructive/50 bg-destructive/5'
              )}
            >
              <p className="text-xs text-muted-foreground mb-1">Δ Resultado</p>
              <p
                className={cn(
                  'text-xl font-bold tabular-nums',
                  deltaPositive ? 'text-green-600 dark:text-green-500' : 'text-destructive'
                )}
              >
                {delta >= 0 ? '+' : ''}
                {formatCurrency(delta)}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">Margem Presumida</p>
              <p className="text-xl font-bold tabular-nums">{margemPresumidaPercent.toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">Margem Real</p>
              <p className="text-xl font-bold tabular-nums">{margemRealPercent.toFixed(2)}%</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {dreRows.length}{' '}
            {groupBy === 'order' ? 'OS' : groupBy === 'trip' ? 'viagens' : 'cotações'} com custo
            real no período.
          </p>
        </>
      )}
    </div>
  );
}
