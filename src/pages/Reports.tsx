import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Route,
  TrendingDown,
  TrendingUp,
  Loader2,
  Info,
  FileText,
  CheckCircle2,
  Download,
  Receipt,
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
  Cell,
} from 'recharts';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRsKmDetailedReport } from '@/hooks/useDashboardStats';
import { useReconciliationReport } from '@/hooks/useQuotePaymentProofs';
import { useDreComparativoReport } from '@/hooks/useDreComparativoReport';
import { useVehicleTypes } from '@/hooks/usePricingRules';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { DreComparativoRow, DreGroupBy } from '@/modules/dre';

const DELTA_REASON_LABELS: Record<string, string> = {
  mao_de_obra: 'Abatimento mão de obra',
  avaria: 'Desconto por avaria',
  atraso: 'Desconto por atraso',
  negociacao: 'Renegociação comercial',
  taxa_banco: 'Taxa bancária',
  arredondamento: 'Arredondamento',
  outro: 'Outro',
};

const PROOF_TYPE_LABELS: Record<string, string> = {
  a_vista: 'À vista',
  adiantamento: 'Adiantamento',
  saldo: 'Saldo',
  a_prazo: 'A prazo',
};

const REPORT_MONTHS = [
  { label: 'Janeiro', value: 1 },
  { label: 'Fevereiro', value: 2 },
  { label: 'Março', value: 3 },
  { label: 'Abril', value: 4 },
  { label: 'Maio', value: 5 },
  { label: 'Junho', value: 6 },
  { label: 'Julho', value: 7 },
  { label: 'Agosto', value: 8 },
  { label: 'Setembro', value: 9 },
  { label: 'Outubro', value: 10 },
  { label: 'Novembro', value: 11 },
  { label: 'Dezembro', value: 12 },
] as const;

const REPORT_THIS_YEAR = new Date().getFullYear();
const REPORT_YEARS = [REPORT_THIS_YEAR, REPORT_THIS_YEAR - 1, REPORT_THIS_YEAR - 2] as const;

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = 'text-foreground',
  delay = 0,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  colorClass?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className="bg-card rounded-xl border border-border shadow-card p-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn('text-2xl font-bold mt-1', colorClass)}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="p-2 rounded-lg bg-muted/50">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
}

const DRE_GROUP_OPTIONS: { value: DreGroupBy; label: string }[] = [
  { value: 'order', label: 'Por OS' },
  { value: 'trip', label: 'Por Viagem (VG)' },
  { value: 'quote', label: 'Por Cotação (COT)' },
];

export default function Reports() {
  const [reportYear, setReportYear] = useState<number | null>(REPORT_THIS_YEAR);
  const [reportMonth, setReportMonth] = useState<number | null>(null);
  const [vehicleTypeId, setVehicleTypeId] = useState<string | null>(null);
  const [dreGroupBy, setDreGroupBy] = useState<DreGroupBy>('order');
  const { data: vehicleTypes } = useVehicleTypes();
  const { data: routes, isLoading } = useRsKmDetailedReport({
    year: reportYear,
    month: reportMonth,
    vehicleTypeId,
  });
  const { data: reconRows, isLoading: isLoadingRecon } = useReconciliationReport({
    year: reportYear,
    month: reportMonth,
  });
  const { data: dreRows, isLoading: isLoadingDre } = useDreComparativoReport({
    year: reportYear,
    month: reportMonth,
    vehicleTypeId,
    groupBy: dreGroupBy,
    enabled: true,
  });

  // Resumo geral
  const allWithReal = routes?.filter((r) => r.count > 0) ?? [];
  const totalOs = allWithReal.reduce((s, r) => s + r.count, 0);
  const totalQuotes = routes?.reduce((s, r) => s + r.quoteCount, 0) ?? 0;

  const avgRsKmReal =
    allWithReal.length > 0
      ? allWithReal.reduce((s, r) => s + r.avgRsKmReal, 0) / allWithReal.length
      : 0;

  const bestRoute = allWithReal
    .filter((r) => r.avgRsKmPrevisto > 0)
    .sort((a, b) => a.deltaPercent - b.deltaPercent)[0];

  const worstRoute = allWithReal
    .filter((r) => r.avgRsKmPrevisto > 0)
    .sort((a, b) => b.deltaPercent - a.deltaPercent)[0];

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground flex items-center gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <BarChart3 className="w-8 h-8 text-primary" />
            Relatórios
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Análise comparativa de custo R$/km — previsto da cotação vs carreteiro real pago
          </motion.p>
        </div>
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <select
            value={reportMonth ?? ''}
            onChange={(e) => setReportMonth(e.target.value ? Number(e.target.value) : null)}
            className="text-sm border border-border rounded px-3 py-1.5 bg-background text-foreground cursor-pointer"
          >
            <option value="">Todos os meses</option>
            {REPORT_MONTHS.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={reportYear ?? ''}
            onChange={(e) => setReportYear(e.target.value ? Number(e.target.value) : null)}
            className="text-sm border border-border rounded px-3 py-1.5 bg-background text-foreground cursor-pointer"
          >
            <option value="">Todos os anos</option>
            {REPORT_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={vehicleTypeId ?? ''}
            onChange={(e) => setVehicleTypeId(e.target.value || null)}
            className="text-sm border border-border rounded px-3 py-1.5 bg-background text-foreground cursor-pointer min-w-[180px]"
          >
            <option value="">Todos os tipos</option>
            {(vehicleTypes ?? []).map((vt) => (
              <option key={vt.id} value={vt.id}>
                {vt.name}
              </option>
            ))}
          </select>
        </motion.div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              title="R$/km médio (real)"
              value={avgRsKmReal > 0 ? `R$ ${avgRsKmReal.toFixed(2)}/km` : '—'}
              subtitle={`${totalOs} OS com carreteiro real`}
              icon={Route}
              delay={0}
            />
            <StatCard
              title="Melhor rota"
              value={bestRoute ? bestRoute.route : '—'}
              subtitle={
                bestRoute
                  ? `${bestRoute.deltaPercent.toFixed(1)}% abaixo do previsto`
                  : 'Sem dados suficientes'
              }
              icon={TrendingDown}
              colorClass="text-success"
              delay={0.05}
            />
            <StatCard
              title="Rota mais cara"
              value={worstRoute ? worstRoute.route : '—'}
              subtitle={
                worstRoute
                  ? `+${worstRoute.deltaPercent.toFixed(1)}% acima do previsto`
                  : 'Sem dados suficientes'
              }
              icon={TrendingUp}
              colorClass="text-warning-foreground"
              delay={0.1}
            />
          </div>

          {/* Tabela detalhada */}
          <motion.div
            className="bg-card rounded-xl border border-border shadow-card p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Route className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Custo R$/km por Rota</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {totalQuotes} cotações · {totalOs} OS com valor real
              </span>
            </div>

            {!routes || routes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Info className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  Nenhuma OS com <strong>carreteiro real</strong> preenchido.
                </p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Para visualizar este relatório, abra uma OS no módulo Operacional e preencha o
                  valor do carreteiro real pago.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rota</TableHead>
                    <TableHead className="text-right">Cotações</TableHead>
                    <TableHead className="text-right">OS c/ real</TableHead>
                    <TableHead className="text-right">Previsto R$/km</TableHead>
                    <TableHead className="text-right">ANTT R$/km (ref)</TableHead>
                    <TableHead className="text-right">Real R$/km</TableHead>
                    <TableHead className="text-right">Δ absoluto</TableHead>
                    <TableHead className="text-right">Δ%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map((row) => {
                    const hasPrevisto = row.avgRsKmPrevisto > 0;
                    const hasAntt = row.avgRsKmAntt > 0;
                    const isAbove = row.deltaPercent > 0;
                    return (
                      <TableRow key={row.route}>
                        <TableCell className="font-semibold">{row.route}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.quoteCount > 0 ? row.quoteCount : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.count > 0 ? row.count : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {hasPrevisto ? `R$ ${row.avgRsKmPrevisto.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {hasAntt ? `R$ ${row.avgRsKmAntt.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.count > 0 ? `R$ ${row.avgRsKmReal.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasPrevisto && row.count > 0 ? (
                            <span
                              className={cn(
                                'text-sm font-medium',
                                isAbove ? 'text-warning-foreground' : 'text-success'
                              )}
                            >
                              {isAbove ? '+' : ''}R$ {row.delta.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasPrevisto && row.count > 0 ? (
                            <Badge
                              variant={isAbove ? 'outline' : 'default'}
                              className={
                                isAbove
                                  ? 'text-warning-foreground border-warning/50'
                                  : 'bg-success text-success-foreground'
                              }
                            >
                              {isAbove ? '+' : ''}
                              {row.deltaPercent.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </motion.div>

          {/* DRE Presumido vs Real */}
          <DreComparativoSection
            dreRows={dreRows ?? []}
            isLoading={isLoadingDre}
            groupBy={dreGroupBy}
            onGroupByChange={setDreGroupBy}
          />

          {/* Conciliação de Recebimento */}
          <motion.div
            className="bg-card rounded-xl border border-border shadow-card p-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Conciliação de Recebimento</h2>
              {reconRows && reconRows.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {reconRows.length} comprovantes
                </span>
              )}
            </div>

            {isLoadingRecon ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !reconRows || reconRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Info className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  Nenhum comprovante Doc Fat com valor informado no período.
                </p>
              </div>
            ) : (
              <>
                {/* Summary by delta_reason */}
                <ReconReasonSummary rows={reconRows} />

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cotação</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconRows.map((row, i) => {
                      const hasDelta = Math.abs(row.delta_amount) > 1;
                      return (
                        <TableRow key={`${row.quote_id}-${row.proof_type}-${i}`}>
                          <TableCell className="font-mono text-xs">{row.quote_code}</TableCell>
                          <TableCell className="text-sm truncate max-w-[200px]">
                            {row.client_name ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {PROOF_TYPE_LABELS[row.proof_type] ?? row.proof_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatReconCurrency(row.expected_amount)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatReconCurrency(row.paid_amount)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-semibold',
                              hasDelta ? 'text-destructive' : 'text-success'
                            )}
                          >
                            {formatReconCurrency(row.delta_amount)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.delta_reason ? (
                              (DELTA_REASON_LABELS[row.delta_reason] ?? row.delta_reason)
                            ) : hasDelta ? (
                              <span className="text-warning-foreground text-xs">Sem motivo</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-success text-xs">
                                <CheckCircle2 className="w-3 h-3" />
                                OK
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </motion.div>
        </>
      )}
    </MainLayout>
  );
}

function formatReconCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function DreComparativoSection({
  dreRows,
  isLoading,
  groupBy,
  onGroupByChange,
}: {
  dreRows: DreComparativoRow[];
  isLoading: boolean;
  groupBy: DreGroupBy;
  onGroupByChange: (v: DreGroupBy) => void;
}) {
  const exportDreCsv = () => {
    const header =
      'Entidade,Receita Presumida,Receita Real,Custos Diretos Presumidos,Custos Diretos Reais,Resultado Presumido,Resultado Real,Δ Resultado,Δ %,Margem Presumida %,Margem Real %';
    const lines = dreRows.map(
      (r) =>
        `"${r.entityLabel}",${r.receitaPresumida},${r.receitaReal},${r.custosDiretosPresumidos},${r.custosDiretosReais},${r.resultadoPresumido},${r.resultadoReal},${r.deltaResultado},${r.deltaPercent.toFixed(2)},${r.margemPresumidaPercent.toFixed(2)},${r.margemRealPercent.toFixed(2)}`
    );
    const csv = ['\uFEFF' + header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dre-presumido-vs-real-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = dreRows.slice(0, 10).map((r) => ({
    name: r.entityLabel.length > 12 ? r.entityLabel.slice(0, 12) + '…' : r.entityLabel,
    fullName: r.entityLabel,
    presumido: r.resultadoPresumido,
    real: r.resultadoReal,
    delta: r.deltaResultado,
  }));

  return (
    <motion.div
      className="bg-card rounded-xl border border-border shadow-card p-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            DRE Presumido vs Real Operacional
          </h2>
          <span
            className="text-xs text-muted-foreground cursor-help"
            title="Faturamento e tributos permanecem fixos; apenas custos operacionais reais (carreteiro, pedágio, descarga) alteram a margem."
          >
            (i)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as DreGroupBy)}
            className="text-sm border border-border rounded px-3 py-1.5 bg-background text-foreground cursor-pointer"
          >
            {DRE_GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportDreCsv}
            disabled={dreRows.length === 0}
            className="text-sm border border-border rounded px-3 py-1.5 bg-background hover:bg-muted/50 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : dreRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Info className="w-10 h-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            Nenhuma OS com <strong>carreteiro real</strong> no período.
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            Preencha o valor do carreteiro real nas OS do módulo Operacional para comparar margem
            presumida vs real.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(Number(v))}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend />
                <Bar
                  dataKey="presumido"
                  name="Resultado Presumido"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar dataKey="real" name="Resultado Real" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.delta >= 0 ? 'hsl(142 76% 36%)' : 'hsl(0 84% 60%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entidade</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Custos Dir. Presumidos</TableHead>
                <TableHead className="text-right">Custos Dir. Reais</TableHead>
                <TableHead className="text-right">Resultado Presumido</TableHead>
                <TableHead className="text-right">Resultado Real</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="text-right">Δ%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dreRows.map((r) => {
                const deltaPositive = r.deltaResultado >= 0;
                return (
                  <TableRow key={`${r.entityType}-${r.entityId}`}>
                    <TableCell className="font-medium">{r.entityLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.receitaPresumida)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(r.custosDiretosPresumidos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(r.custosDiretosReais)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.resultadoPresumido)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(r.resultadoReal)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums font-semibold',
                        deltaPositive ? 'text-green-600 dark:text-green-500' : 'text-destructive'
                      )}
                    >
                      {r.deltaResultado >= 0 ? '+' : ''}
                      {formatCurrency(r.deltaResultado)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={deltaPositive ? 'default' : 'destructive'}
                        className={deltaPositive ? 'bg-green-600' : ''}
                      >
                        {r.deltaResultado >= 0 ? '+' : ''}
                        {r.deltaPercent.toFixed(2)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </motion.div>
  );
}

function ReconReasonSummary({
  rows,
}: {
  rows: { delta_amount: number; delta_reason: string | null }[];
}) {
  const withDelta = rows.filter((r) => Math.abs(r.delta_amount) > 1);
  if (withDelta.length === 0) return null;

  const byReason = new Map<string, { count: number; total: number }>();
  for (const r of withDelta) {
    const key = r.delta_reason ?? '_sem_motivo';
    const cur = byReason.get(key) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += r.delta_amount;
    byReason.set(key, cur);
  }

  const totalDelta = withDelta.reduce((s, r) => s + r.delta_amount, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">Total divergências</p>
        <p className="text-lg font-bold text-destructive">{formatReconCurrency(totalDelta)}</p>
        <p className="text-[10px] text-muted-foreground">{withDelta.length} comprovantes</p>
      </div>
      {Array.from(byReason.entries())
        .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
        .slice(0, 3)
        .map(([key, val]) => (
          <div key={key} className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              {key === '_sem_motivo' ? 'Sem motivo' : (DELTA_REASON_LABELS[key] ?? key)}
            </p>
            <p className="text-lg font-bold text-foreground">{formatReconCurrency(val.total)}</p>
            <p className="text-[10px] text-muted-foreground">{val.count}x</p>
          </div>
        ))}
    </div>
  );
}
