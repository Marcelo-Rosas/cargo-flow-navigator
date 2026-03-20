import { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Download,
  CheckSquare,
  Trash2,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCashFlowSummary,
  usePendingInstallments,
  useSettledInstallments,
  useSettleInstallments,
  useDeleteInstallments,
} from '@/hooks/useCashFlowSummary';
import type {
  CashFlowByMonth,
  PendingInstallment,
  SettledInstallment,
} from '@/hooks/useCashFlowSummary';
import { formatCurrency } from '@/lib/formatters';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function getDefaultMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return {
    from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`,
    to: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

function exportToCSV(rows: CashFlowByMonth[], settled: SettledInstallment[]) {
  // Sheet 1: Summary
  const header =
    'Período,Entradas Realizadas,Entradas Previstas,Saídas Realizadas,Saídas Previstas,Saldo,Saldo Acumulado,Docs FAT,Docs PAG';
  const lines = rows.map(
    (r) =>
      `"${r.periodLabel}",${r.entradas},${r.entradasPrevistas},${r.saidas},${r.saidasPrevistas},${r.saldo},${r.saldoAcumulado},${r.fatDocCount},${r.pagDocCount}`
  );

  // Sheet 2: Settled installments detail
  const settledHeader =
    '\n\nParcelas Baixadas\nDocumento,Tipo,Forma Pagamento,Vencimento,Data Baixa,Valor';
  const settledLines = settled.map((s) => {
    const due = new Date(s.due_date + 'T12:00:00').toLocaleDateString('pt-BR');
    const settledDate = s.settled_at ? new Date(s.settled_at).toLocaleDateString('pt-BR') : '—';
    const tipo = s.document_type === 'FAT' ? 'Receber' : 'Pagar';
    return `"${s.document_code ?? '—'}","${tipo}","${s.payment_method ?? '—'}","${due}","${settledDate}",${s.amount}`;
  });

  const csv = [header, ...lines, settledHeader, ...settledLines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fluxo-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────
// Custom Recharts tooltip
// ─────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-popover-foreground shadow-md text-xs space-y-1">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────────────

function KpiCards({ items }: { items: CashFlowByMonth[] }) {
  const totals = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let prevEntradas = 0;
    let prevSaidas = 0;
    for (const r of items) {
      entradas += r.entradas;
      saidas += r.saidas;
      prevEntradas += r.entradasPrevistas;
      prevSaidas += r.saidasPrevistas;
    }
    return {
      entradas: Math.round(entradas * 100) / 100,
      saidas: Math.round(saidas * 100) / 100,
      saldo: Math.round((entradas - saidas) * 100) / 100,
      prevEntradas: Math.round(prevEntradas * 100) / 100,
      prevSaidas: Math.round(prevSaidas * 100) / 100,
    };
  }, [items]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard
        label="Entradas (Realizadas)"
        value={totals.entradas}
        sub={
          totals.prevEntradas > 0 ? `+ ${formatCurrency(totals.prevEntradas)} previstas` : undefined
        }
        color="text-emerald-600"
        icon={<TrendingUp className="w-4 h-4" />}
      />
      <KpiCard
        label="Saídas (Realizadas)"
        value={totals.saidas}
        sub={totals.prevSaidas > 0 ? `+ ${formatCurrency(totals.prevSaidas)} previstas` : undefined}
        color="text-red-500"
        icon={<TrendingDown className="w-4 h-4" />}
      />
      <KpiCard
        label="Saldo Período"
        value={totals.saldo}
        color={totals.saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}
        icon={<BarChart3 className="w-4 h-4" />}
      />
      <KpiCard
        label="Saldo Acumulado"
        value={items[0]?.saldoAcumulado ?? 0}
        color={(items[0]?.saldoAcumulado ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}
        icon={<FileSpreadsheet className="w-4 h-4" />}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────

export function CashFlowReport() {
  const defaults = getDefaultMonthRange();
  const [monthFrom, setMonthFrom] = useState(defaults.from);
  const [monthTo, setMonthTo] = useState(defaults.to);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: rows, isLoading, isError, error } = useCashFlowSummary({ monthFrom, monthTo });
  const {
    data: pendingInstallments,
    isLoading: pendingLoading,
    isError: pendingError,
    error: pendingErrorObj,
  } = usePendingInstallments();
  const { data: settledInstallments } = useSettledInstallments({ monthFrom, monthTo });
  const settleMutation = useSettleInstallments();
  const deleteMutation = useDeleteInstallments();

  const pendingRows = useMemo(() => pendingInstallments ?? [], [pendingInstallments]);
  const settledRows = useMemo(() => settledInstallments ?? [], [settledInstallments]);
  const items = useMemo(() => rows ?? [], [rows]);

  // Chart data in chronological order (reversed from display)
  const chartData = useMemo(() => [...items].reverse(), [items]);

  // ── Selection handlers ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === pendingRows.length ? new Set() : new Set(pendingRows.map((r) => r.id))
    );
  }, [pendingRows]);

  const handleSettleSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    settleMutation.mutate(ids, {
      onSuccess: () => {
        toast.success(`${ids.length} parcela(s) baixada(s) com sucesso`);
        setSelectedIds(new Set());
      },
    });
  }, [selectedIds, settleMutation]);

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} parcela(s)? Esta ação não pode ser desfeita.`))
      return;
    deleteMutation.mutate(ids, {
      onSuccess: () => {
        toast.success(`${ids.length} parcela(s) excluída(s)`);
        setSelectedIds(new Set());
      },
    });
  }, [selectedIds, deleteMutation]);

  // ── Loading / Error ──
  if (isLoading) {
    return <TableSkeleton rows={6} columns={4} title />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        Erro ao carregar fluxo de caixa:{' '}
        {error instanceof Error ? error.message : 'Erro desconhecido'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Filtros + Export ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">De</label>
          <Input
            type="month"
            value={monthFrom}
            onChange={(e) => setMonthFrom(e.target.value)}
            className="w-40 h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Até</label>
          <Input
            type="month"
            value={monthTo}
            onChange={(e) => setMonthTo(e.target.value)}
            className="w-40 h-9"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportToCSV(items, settledRows)}
          disabled={items.length === 0}
          className="gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <KpiCards items={items} />

      {/* ── Gráfico ── */}
      {chartData.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Fluxo de Caixa Mensal
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar
                dataKey="entradas"
                name="Entradas"
                fill="hsl(152, 60%, 45%)"
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="saidas"
                name="Saídas"
                fill="hsl(0, 72%, 51%)"
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="entradasPrevistas"
                name="Entradas Previstas"
                fill="hsl(152, 60%, 45%)"
                fillOpacity={0.3}
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="saidasPrevistas"
                name="Saídas Previstas"
                fill="hsl(0, 72%, 51%)"
                fillOpacity={0.3}
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
              <Line
                dataKey="saldoAcumulado"
                name="Saldo Acumulado"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2}
                dot={{ r: 3 }}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Tabela Resumo por Mês ── */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Resumo por mês
        </h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Entradas
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1 text-red-500">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Saídas
                  </span>
                </TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Acumulado</TableHead>
                <TableHead className="text-center">Docs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum dado de fluxo de caixa no período.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell className="font-medium">{row.periodLabel}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-emerald-600">{formatCurrency(row.entradas)}</span>
                      {row.entradasPrevistas > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          + {formatCurrency(row.entradasPrevistas)} prev.
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-500">{formatCurrency(row.saidas)}</span>
                      {row.saidasPrevistas > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          + {formatCurrency(row.saidasPrevistas)} prev.
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        row.saldo >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {formatCurrency(row.saldo)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        row.saldoAcumulado >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {formatCurrency(row.saldoAcumulado)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-muted-foreground">
                        {row.fatDocCount}F / {row.pagDocCount}P
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Parcelas Pendentes com seleção individual ── */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Parcelas pendentes
            {pendingRows.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingRows.length}
              </Badge>
            )}
          </h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSettleSelected}
              disabled={selectedIds.size === 0 || settleMutation.isPending}
              className="gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {settleMutation.isPending
                ? 'Processando...'
                : `Baixar selecionadas (${selectedIds.size})`}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deleteMutation.isPending}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? 'Excluindo...' : `Excluir (${selectedIds.size})`}
            </Button>
          </div>
        </div>

        {pendingLoading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : pendingError ? (
          <p className="text-sm text-destructive">
            Falha ao buscar parcelas pendentes:{' '}
            {(pendingErrorObj instanceof Error && pendingErrorObj.message) || 'Erro desconhecido'}
          </p>
        ) : pendingRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma parcela pendente encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pendingRows.length > 0 && selectedIds.size === pendingRows.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Conciliação</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRows.map((row) => {
                  const overdue = isOverdue(row.due_date);
                  return (
                    <TableRow
                      key={row.id}
                      className={overdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={() => toggleSelect(row.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.document_code ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.document_type === 'FAT' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {row.document_type === 'FAT' ? 'Receber' : 'Pagar'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {new Date(row.due_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          row.document_type === 'FAT' ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.document_type === 'FAT' && row.recon_paid != null ? (
                          <div className="space-y-0.5">
                            <span
                              className={`text-xs font-medium ${
                                row.recon_reconciled ? 'text-emerald-600' : 'text-destructive'
                              }`}
                            >
                              {row.recon_reconciled
                                ? 'Conciliado'
                                : formatCurrency(row.recon_delta ?? 0)}
                            </span>
                            {row.recon_proof_label && (
                              <p className="text-[10px] text-muted-foreground">
                                {row.recon_proof_label}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {overdue ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Vencida
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            A vencer
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {settleMutation.isError && (
          <p className="text-xs text-destructive">
            {settleMutation.error instanceof Error
              ? settleMutation.error.message
              : 'Não foi possível baixar as parcelas.'}
          </p>
        )}
        {deleteMutation.isError && (
          <p className="text-xs text-destructive">
            {deleteMutation.error instanceof Error
              ? deleteMutation.error.message
              : 'Não foi possível excluir as parcelas.'}
          </p>
        )}
      </div>
    </div>
  );
}
