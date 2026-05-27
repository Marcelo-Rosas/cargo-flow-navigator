import { useState } from 'react';
import {
  Receipt,
  Loader2,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { useDreOperacionalReport } from '@/hooks/useDreOperacionalReport';
import { cn } from '@/lib/utils';
import type { DreTable, DreCanonicalRow, DreLineCode } from '@/modules/dre';
import { DRE_LINE_MAPPINGS } from '@/modules/dre';
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

/** Consolida todas as DreTables em uma única tabela (soma linha a linha). */
function consolidateAllRows(tables: DreTable[]): DreTable {
  const presumedSums = new Map<DreLineCode, number>();
  const realSums = new Map<DreLineCode, number>();
  const missingFlags = new Set<DreLineCode>();
  const formulaWarnings = new Set<DreLineCode>();

  for (const t of tables) {
    for (const row of t.rows) {
      const p = (presumedSums.get(row.line_code) ?? 0) + row.presumed_value;
      const r = (realSums.get(row.line_code) ?? 0) + row.real_value;
      presumedSums.set(row.line_code, Math.round(p * 100) / 100);
      realSums.set(row.line_code, Math.round(r * 100) / 100);
      if (row.missing_real_cost_flag) missingFlags.add(row.line_code);
      if (row.has_formula_warning) formulaWarnings.add(row.line_code);
    }
  }

  // Recalculate derived lines
  const sumCode = (map: Map<DreLineCode, number>, code: DreLineCode) => map.get(code) ?? 0;
  const pCustosDiretos =
    sumCode(presumedSums, 'custo_motorista') +
    sumCode(presumedSums, 'pedagio') +
    sumCode(presumedSums, 'carga_descarga') +
    sumCode(presumedSums, 'espera') +
    sumCode(presumedSums, 'taxas_condicionais') +
    sumCode(presumedSums, 'outros_custos');
  const rCustosDiretos =
    sumCode(realSums, 'custo_motorista') +
    sumCode(realSums, 'pedagio') +
    sumCode(realSums, 'carga_descarga') +
    sumCode(realSums, 'espera') +
    sumCode(realSums, 'taxas_condicionais') +
    sumCode(realSums, 'outros_custos');
  presumedSums.set('custos_diretos', Math.round(pCustosDiretos * 100) / 100);
  realSums.set('custos_diretos', Math.round(rCustosDiretos * 100) / 100);

  const pResultado =
    sumCode(presumedSums, 'receita_liquida') - sumCode(presumedSums, 'overhead') - pCustosDiretos;
  const rResultado =
    sumCode(realSums, 'receita_liquida') - sumCode(realSums, 'overhead') - rCustosDiretos;
  presumedSums.set('resultado_liquido', Math.round(pResultado * 100) / 100);
  realSums.set('resultado_liquido', Math.round(rResultado * 100) / 100);

  const pFat = sumCode(presumedSums, 'faturamento_bruto');
  const rFat = sumCode(realSums, 'faturamento_bruto');
  presumedSums.set('margem_liquida', pFat > 0 ? Math.round((pResultado / pFat) * 10000) / 100 : 0);
  realSums.set('margem_liquida', rFat > 0 ? Math.round((rResultado / rFat) * 10000) / 100 : 0);

  const rows: DreCanonicalRow[] = [];
  for (const mapping of DRE_LINE_MAPPINGS) {
    const code = mapping.line_code;
    const pVal = presumedSums.get(code) ?? 0;
    const rVal = realSums.get(code) ?? 0;
    const variance = Math.round((rVal - pVal) * 100) / 100;
    const varPct =
      Math.abs(pVal) > 0.01 ? Math.round((variance / Math.abs(pVal)) * 10000) / 100 : 0;
    const isWorse = variance < 0 && Math.abs(pVal) > 0.01;

    rows.push({
      period_type: 'detail',
      period_key: 'consolidated',
      quote_code: null,
      os_number: null,
      line_code: code,
      line_label: mapping.line_label,
      sort_order: mapping.sort_order,
      indent_level: mapping.indent_level,
      presumed_value: pVal,
      real_value: rVal,
      variance_value: variance,
      variance_percent: varPct,
      badge_direction: isWorse ? 'down' : variance > 0 ? 'up' : 'neutral',
      badge_color: isWorse ? 'red' : variance > 0 ? 'green' : 'neutral',
      has_formula_warning: formulaWarnings.has(code),
      missing_real_cost_flag: missingFlags.has(code),
    });
  }

  return {
    period_type: 'detail',
    period_key: 'consolidated',
    quote_code: null,
    os_number: null,
    reference_date: tables[0]?.reference_date ?? new Date().toISOString(),
    rows,
  };
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

          {/* Tabela DRE Detalhada */}
          <DreDetailedTable tables={dreTables} />
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// Tabela DRE Detalhada
// ───────────────────────────────────────────────

function DreDetailedTable({ tables }: { tables: DreTable[] }) {
  const [expanded, setExpanded] = useState(false);
  const consolidated = consolidateAllRows(tables);

  const groupLabels: Record<string, string> = {
    receita: 'Receita',
    impostos: 'Impostos',
    custos: 'Custos Operacionais',
    resultado: 'Resultado',
  };

  const groupOrder = ['receita', 'impostos', 'custos', 'resultado'];

  const rowsByGroup = new Map<string, DreCanonicalRow[]>();
  for (const row of consolidated.rows) {
    const mapping = DRE_LINE_MAPPINGS.find((m) => m.line_code === row.line_code);
    const group = mapping?.line_group ?? 'resultado';
    const arr = rowsByGroup.get(group) ?? [];
    arr.push(row);
    rowsByGroup.set(group, arr);
  }

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          DRE Detalhada Consolidada
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-2 px-2 font-medium">Linha</th>
                <th className="text-right py-2 px-2 font-medium">Presumido</th>
                <th className="text-right py-2 px-2 font-medium">Real</th>
                <th className="text-right py-2 px-2 font-medium">Δ</th>
                <th className="text-right py-2 px-2 font-medium">Δ %</th>
                <th className="text-center py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {groupOrder.map((group) => {
                const rows = rowsByGroup.get(group) ?? [];
                if (rows.length === 0) return null;
                return (
                  <tr key={group}>
                    <td colSpan={6}>
                      <div className="mt-3 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {groupLabels[group]}
                        </span>
                      </div>
                      <table className="w-full">
                        <tbody>
                          {rows.map((row) => {
                            const mapping = DRE_LINE_MAPPINGS.find(
                              (m) => m.line_code === row.line_code
                            );
                            const isGroup = mapping?.is_group ?? false;
                            const isTotal = row.line_code === 'resultado_liquido';
                            const isMargin = row.line_code === 'margem_liquida';
                            const isWorse =
                              row.variance_value < 0 && Math.abs(row.presumed_value) > 0.01;

                            return (
                              <tr
                                key={row.line_code}
                                className={cn(
                                  'border-b border-border/50',
                                  isTotal && 'bg-primary/5 font-semibold',
                                  isGroup && 'font-medium',
                                  isMargin && 'italic text-muted-foreground'
                                )}
                              >
                                <td
                                  className={cn(
                                    'py-2 px-2 text-left',
                                    mapping?.indent_level === 1 && 'pl-6'
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    {row.line_label}
                                    {row.missing_real_cost_flag && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] gap-1 border-yellow-300 text-yellow-700"
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Sem dado real
                                      </Badge>
                                    )}
                                    {row.has_formula_warning && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] gap-1 border-red-300 text-red-700"
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Divergência
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums">
                                  {isMargin
                                    ? `${row.presumed_value.toFixed(2)}%`
                                    : formatCurrency(row.presumed_value)}
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums">
                                  {isMargin
                                    ? `${row.real_value.toFixed(2)}%`
                                    : formatCurrency(row.real_value)}
                                </td>
                                <td
                                  className={cn(
                                    'py-2 px-2 text-right tabular-nums',
                                    isWorse && 'text-red-600',
                                    !isWorse && row.variance_value > 0 && 'text-green-600'
                                  )}
                                >
                                  {isMargin
                                    ? `${row.variance_value >= 0 ? '+' : ''}${row.variance_value.toFixed(2)}%`
                                    : `${row.variance_value >= 0 ? '+' : ''}${formatCurrency(row.variance_value)}`}
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                                  {Math.abs(row.presumed_value) > 0.01
                                    ? `${row.variance_percent >= 0 ? '+' : ''}${row.variance_percent.toFixed(1)}%`
                                    : '—'}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {isWorse ? (
                                    <Badge variant="destructive" className="text-[9px] gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      Abaixo
                                    </Badge>
                                  ) : row.variance_value > 0 && !isMargin ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] gap-1 border-green-300 text-green-700"
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      Acima
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
