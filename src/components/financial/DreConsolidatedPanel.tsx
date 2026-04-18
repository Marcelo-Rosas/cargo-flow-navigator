import { useState } from 'react';
import { Receipt, Loader2, Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { useDreOperacionalReport } from '@/hooks/useDreOperacionalReport';
import { cn } from '@/lib/utils';
import type { DreTable } from '@/modules/dre';
import { Link } from 'react-router-dom';

const CURRENT_YEAR = new Date().getFullYear();

function getToday(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function extractTotals(tables: DreTable[]) {
  let faturamentoBruto = 0;
  let resultadoPresumido = 0;
  let resultadoReal = 0;
  for (const table of tables) {
    for (const row of table.rows) {
      if (row.line_code === 'faturamento_bruto') {
        faturamentoBruto += row.presumed_value;
      } else if (row.line_code === 'resultado_liquido') {
        resultadoPresumido += row.presumed_value;
        resultadoReal += row.real_value;
      }
    }
  }
  return { faturamentoBruto, resultadoPresumido, resultadoReal };
}

export function DreConsolidatedPanel() {
  const [dateFrom, setDateFrom] = useState<string>(`01/01/${CURRENT_YEAR}`);
  const [dateTo, setDateTo] = useState<string>(getToday());

  const { data: dreTables, isLoading } = useDreOperacionalReport({
    dateFrom,
    dateTo,
    quoteCode: null,
    osNumber: null,
    periodType: 'detail',
    enabled: true,
  });

  const { faturamentoBruto, resultadoPresumido, resultadoReal } = dreTables
    ? extractTotals(dreTables)
    : { faturamentoBruto: 0, resultadoPresumido: 0, resultadoReal: 0 };

  const delta = resultadoReal - resultadoPresumido;
  const deltaPositive = delta >= 0;
  const margemPresumidaPercent =
    faturamentoBruto > 0 ? (resultadoPresumido / faturamentoBruto) * 100 : 0;
  const margemRealPercent = faturamentoBruto > 0 ? (resultadoReal / faturamentoBruto) * 100 : 0;

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
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">De</span>
            <input
              type="text"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="dd/mm/aaaa"
              className="w-28 border border-border rounded-md px-2 py-1.5 bg-background text-sm"
            />
            <span className="text-muted-foreground whitespace-nowrap">Até</span>
            <input
              type="text"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="dd/mm/aaaa"
              className="w-28 border border-border rounded-md px-2 py-1.5 bg-background text-sm"
            />
          </div>
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
      ) : !dreTables || dreTables.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 p-12 text-center">
          <Info className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma OS com dados DRE no período selecionado.</p>
          <p className="text-sm text-muted-foreground mt-1">
            O DRE comparativo exibe margem presumida vs real. Selecione um período com cotações
            ganhas.
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
              <p className="text-xl font-bold tabular-nums">{formatCurrency(resultadoPresumido)}</p>
            </div>
            <div className="rounded-xl border border-border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">Resultado Real</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(resultadoReal)}</p>
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
            {dreTables.length} OS/cotações com dados no período.
          </p>
        </>
      )}
    </div>
  );
}
