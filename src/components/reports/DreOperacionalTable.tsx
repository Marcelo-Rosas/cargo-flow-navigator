/**
 * Tabela DRE Operacional Comparativa — linha a linha, Presumido vs Real.
 * Estrutura contábil hierárquica com badges por variação.
 */

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { DreTable, DreCanonicalRow } from '@/modules/dre';

function formatPercent(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(v / 100);
}

function BadgeIcon({ direction }: { direction: 'up' | 'down' | 'neutral' }) {
  if (direction === 'up') return <ArrowUp className="w-3 h-3" />;
  if (direction === 'down') return <ArrowDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

function LineBadge({ row }: { row: DreCanonicalRow }) {
  if (row.badge_color === 'neutral') {
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1">
        <BadgeIcon direction={row.badge_direction} />—
      </Badge>
    );
  }
  const label =
    row.line_code === 'margem_liquida'
      ? row.variance_value !== 0
        ? `${row.variance_value >= 0 ? '+' : ''}${row.variance_value.toFixed(1)} pp`
        : '—'
      : row.variance_percent !== 0
        ? formatPercent(row.variance_percent)
        : '—';
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1',
        row.badge_color === 'green' && 'border-green-500/50 text-green-700 dark:text-green-400',
        row.badge_color === 'red' && 'border-red-500/50 text-red-700 dark:text-red-400'
      )}
    >
      <BadgeIcon direction={row.badge_direction} />
      {label}
    </Badge>
  );
}

function formatValue(value: number, isPercent = false): string {
  if (isPercent) return formatPercent(value);
  return formatCurrency(value);
}

/** Renderiza uma única tabela DRE (uma entidade ou período consolidado) */
export function DreTableBlock({ table }: { table: DreTable }) {
  const hidePresumedColumn =
    table.status_detail === 'legacy_quote_breakdown' || table.status_detail === 'os_without_quote';

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 border-b">
        <p className="font-semibold text-sm">
          {table.quote_code && table.os_number
            ? `${table.quote_code} / ${table.os_number}`
            : table.period_key}
          {table.status === 'sem_os_vinculada' && (
            <span className="ml-2 text-xs text-muted-foreground">(sem OS vinculada)</span>
          )}
          {table.status_detail === 'legacy_quote_breakdown' && (
            <span className="ml-2 text-xs text-muted-foreground">(COT legacy: presumido indisponível)</span>
          )}
          {table.status_detail === 'os_without_quote' && (
            <span className="ml-2 text-xs text-muted-foreground">(OS sem quote vinculada)</span>
          )}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">Item</TableHead>
            <TableHead className="text-right">Presumido</TableHead>
            <TableHead className="text-right">Real</TableHead>
            <TableHead className="text-right">Var. R$</TableHead>
            <TableHead className="text-right w-[100px]">Var. %</TableHead>
            <TableHead className="w-[90px]">Badge</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row) => {
            const prefix =
              row.line_code === 'faturamento_bruto'
                ? '(+) '
                : row.line_code === 'impostos' ||
                    row.line_code === 'overhead' ||
                    row.line_code === 'custos_diretos'
                  ? '(-) '
                  : row.line_code === 'receita_liquida' || row.line_code === 'resultado_liquido'
                    ? '(=) '
                    : '';
            const indent = row.indent_level === 1 ? 'pl-4' : '';
            const isPercent = row.line_code === 'margem_liquida';

            return (
              <TableRow
                key={row.line_code}
                className={cn(
                  (row.line_code === 'faturamento_bruto' ||
                    row.line_code === 'receita_liquida' ||
                    row.line_code === 'resultado_liquido' ||
                    row.line_code === 'margem_liquida') &&
                    'bg-muted/20 font-medium'
                )}
              >
                <TableCell className={cn('py-2', indent)}>
                  <span
                    className={cn(row.has_formula_warning && 'text-amber-600 dark:text-amber-500')}
                  >
                    {prefix}
                    {row.line_label}
                  </span>
                  {row.missing_real_cost_flag && (
                    <span
                      className="ml-1 text-[10px] text-muted-foreground"
                      title="Sem lançamento real"
                    >
                      (*)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums py-2">
                  {hidePresumedColumn ? '—' : formatValue(row.presumed_value, isPercent)}
                </TableCell>
                <TableCell className="text-right tabular-nums py-2">
                  {formatValue(row.real_value, isPercent)}
                </TableCell>
                <TableCell className="text-right tabular-nums py-2">
                  {hidePresumedColumn
                    ? '—'
                    : !isPercent
                      ? formatCurrency(row.variance_value)
                      : `${row.variance_value >= 0 ? '+' : ''}${row.variance_value.toFixed(1)} pp`}
                </TableCell>
                <TableCell className="text-right py-2">
                  {hidePresumedColumn ? '—' : !isPercent ? formatPercent(row.variance_percent) : '—'}
                </TableCell>
                <TableCell className="py-2">
                  <LineBadge row={row} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Lista de tabelas DRE (múltiplas entidades ou períodos) */
export function DreOperacionalTable({
  tables,
  isLoading,
}: {
  tables: DreTable[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tables || tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3 text-muted-foreground">
        <p>Nenhuma COT/OS para DRE no período.</p>
        <p className="text-sm">Ajuste os filtros de data, COT ou OS.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tables.map((table, i) => (
        <DreTableBlock key={`${table.period_key}-${i}`} table={table} />
      ))}
    </div>
  );
}
