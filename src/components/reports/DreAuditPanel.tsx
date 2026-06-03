/**
 * Painel de Auditoria DRE — identifica COT/OS com dados incompletos
 * que quebram a metodologia Presumido vs Real.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Filter,
  FileSearch,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDreAudit, useDreAuditSummary } from '@/hooks/useDreAudit';
import { DrePeriodFilter, type DrePeriodFilterValue } from '@/components/filters/DrePeriodFilter';
import { getRangeFromMonth, getCurrentMonthYear } from '@/lib/dateFilterUtils';
import { cn } from '@/lib/utils';

const { month: CUR_MONTH, year: CUR_YEAR } = getCurrentMonthYear();
const DEFAULT_RANGE = getRangeFromMonth(CUR_MONTH, CUR_YEAR);

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  cot_sem_os: { label: 'COT sem OS', color: 'text-red-600 bg-red-50 border-red-200' },
  os_sem_cot: { label: 'OS sem COT', color: 'text-red-600 bg-red-50 border-red-200' },
  os_sem_custos_reais: {
    label: 'OS sem custos reais',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  cot_breakdown_nulo: {
    label: 'COT sem breakdown',
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  cot_breakdown_incompleto: {
    label: 'COT breakdown incompleto',
    color: 'text-red-600 bg-red-50 border-red-200',
  },
  os_valor_zero: { label: 'OS com valor zero', color: 'text-red-600 bg-red-50 border-red-200' },
  divergencia_valor: {
    label: 'Divergência de valor',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
};

const SEVERITY_ICONS = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
};

const SEVERITY_CLASSES = {
  high: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-blue-600 bg-blue-50 border-blue-200',
};

export function DreAuditPanel() {
  const [period, setPeriod] = useState<DrePeriodFilterValue>({
    range: DEFAULT_RANGE,
    periodType: 'month',
  });
  const [filterText, setFilterText] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const {
    data: rows,
    isLoading,
    error,
  } = useDreAudit({
    dateFrom: period.range.dateFrom,
    dateTo: period.range.dateTo,
  });

  const { data: summary } = useDreAuditSummary({
    dateFrom: period.range.dateFrom,
    dateTo: period.range.dateTo,
  });

  const filteredRows = (rows ?? []).filter((r) => {
    if (severityFilter && r.severity !== severityFilter) return false;
    if (!filterText.trim()) return true;
    const ft = filterText.toLowerCase();
    return (
      (r.quote_code ?? '').toLowerCase().includes(ft) ||
      (r.os_number ?? '').toLowerCase().includes(ft) ||
      r.description.toLowerCase().includes(ft)
    );
  });

  const totalHigh = (rows ?? []).filter((r) => r.severity === 'high').length;
  const totalMedium = (rows ?? []).filter((r) => r.severity === 'medium').length;
  const totalLow = (rows ?? []).filter((r) => r.severity === 'low').length;

  return (
    <div className="space-y-6">
      {/* Header + filtro de período */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Auditoria COT / OS</h2>
          <span className="text-xs text-muted-foreground">
            Identifica pares com dados incompletos que divergem da metodologia Presumido vs Real
          </span>
        </div>
        <DrePeriodFilter value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-red-700 font-medium">Erro ao carregar auditoria</p>
          <p className="text-sm text-red-600 mt-1">
            {(error as Error)?.message ??
              'Verifique se a view v_dre_audit_mismatches existe no banco de dados.'}
          </p>
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            Nenhuma inconsistência encontrada no período.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os pares COT/OS possuem dados completos para DRE comparativo.
          </p>
        </div>
      ) : (
        <>
          {/* Cards de resumo por severidade */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs text-red-700 mb-1">Crítico</p>
              <p className="text-2xl font-bold text-red-700">{totalHigh}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-700 mb-1">Médio</p>
              <p className="text-2xl font-bold text-amber-700">{totalMedium}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs text-blue-700 mb-1">Baixo</p>
              <p className="text-2xl font-bold text-blue-700">{totalLow}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-2xl font-bold">{rows.length}</p>
            </div>
          </div>

          {/* Cards de tipos de problema */}
          {summary && Object.keys(summary).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary).map(([type, count]) => {
                const meta = TYPE_LABELS[type] ?? {
                  label: type,
                  color: 'text-gray-600 bg-gray-50 border-gray-200',
                };
                return (
                  <div
                    key={type}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm flex items-center gap-2',
                      meta.color
                    )}
                  >
                    <span className="font-medium">{meta.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por COT, OS ou descrição..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1.5">
              {(['high', 'medium', 'low'] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={severityFilter === s ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
                >
                  {s === 'high' ? 'Crítico' : s === 'medium' ? 'Médio' : 'Baixo'}
                </Button>
              ))}
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Severidade</TableHead>
                  <TableHead className="w-[140px]">Tipo</TableHead>
                  <TableHead className="w-[120px]">COT</TableHead>
                  <TableHead className="w-[120px]">OS</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[100px]">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row, i) => {
                  const SeverityIcon = SEVERITY_ICONS[row.severity];
                  const typeMeta = TYPE_LABELS[row.mismatch_type] ?? {
                    label: row.mismatch_type,
                    color: 'text-gray-600 bg-gray-50 border-gray-200',
                  };
                  return (
                    <TableRow key={`${row.mismatch_type}-${i}`}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('gap-1 text-xs', SEVERITY_CLASSES[row.severity])}
                        >
                          <SeverityIcon className="w-3 h-3" />
                          {row.severity === 'high'
                            ? 'Crítico'
                            : row.severity === 'medium'
                              ? 'Médio'
                              : 'Baixo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-xs px-2 py-0.5 rounded border', typeMeta.color)}>
                          {typeMeta.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.quote_code ?? row.quote_id ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.os_number ?? row.order_id ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">{row.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.reference_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredRows.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum resultado com os filtros selecionados.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
