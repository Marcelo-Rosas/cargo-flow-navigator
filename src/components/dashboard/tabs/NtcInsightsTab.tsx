import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Fuel,
  BarChart3,
  AlertCircle,
  Truck,
  Package,
  Loader2,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useNtcInsights, NtcCostIndex } from '@/hooks/useNtcInsights';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/* ------------------------------------------------------------------ */
/*  Helper — formata período "2026-01-01" para "Jan/26"                */
/* ------------------------------------------------------------------ */

const MONTH_SHORT: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

function fmtPeriod(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 2) return dateStr;
  const monthKey = parts[1];
  const year = parts[0].slice(2);
  return `${MONTH_SHORT[monthKey] || monthKey}/${year}`;
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
}

function fmtCurrency(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ------------------------------------------------------------------ */
/*  Insight Card                                                       */
/* ------------------------------------------------------------------ */

interface InsightCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number | null;
  color: 'blue' | 'green' | 'orange' | 'purple';
  delay?: number;
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  green:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  orange:
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  purple:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
};

const iconBgMap = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
};

function InsightCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  delay = 0,
}: InsightCardProps) {
  return (
    <motion.div
      className={`rounded-xl border p-4 ${colorMap[color]}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium opacity-75 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${iconBgMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend !== null && trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {trend > 0 ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          <span className="text-xs font-medium">{fmtPct(trend)} em 12 meses</span>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Smart Alert Card                                                   */
/* ------------------------------------------------------------------ */

interface AlertItem {
  icon: React.ElementType;
  message: string;
  severity: 'info' | 'warning' | 'success';
}

const severityStyle = {
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300',
  warning:
    'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300',
  success:
    'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300',
};

/* ------------------------------------------------------------------ */
/*  Chart Data Transformer                                             */
/* ------------------------------------------------------------------ */

interface ChartPoint {
  period: string;
  label: string;
  d50?: number;
  d400?: number;
  d800?: number;
  d2400?: number;
  d6000?: number;
}

function buildInctlChartData(inctlSeries: NtcCostIndex[]): ChartPoint[] {
  const byPeriod = new Map<string, ChartPoint>();

  // Sort ascending
  const sorted = [...inctlSeries].sort((a, b) => a.period.localeCompare(b.period));

  for (const row of sorted) {
    if (!byPeriod.has(row.period)) {
      byPeriod.set(row.period, {
        period: row.period,
        label: fmtPeriod(row.period),
      });
    }
    const pt = byPeriod.get(row.period)!;
    const key = `d${row.distance_km}` as keyof ChartPoint;
    if (key in pt || ['d50', 'd400', 'd800', 'd2400', 'd6000'].includes(key as string)) {
      (pt as Record<string, unknown>)[key] = Math.round(row.index_value * 100) / 100;
    }
  }

  return Array.from(byPeriod.values());
}

/* ------------------------------------------------------------------ */
/*  INCTL R$/Ton Table                                                 */
/* ------------------------------------------------------------------ */

function InctlLatestTable({ inctlSeries }: { inctlSeries: NtcCostIndex[] }) {
  // Get latest period
  const sorted = [...inctlSeries].sort((a, b) => b.period.localeCompare(a.period));
  if (sorted.length === 0) return null;

  const latestPeriod = sorted[0].period;
  const latestRows = sorted.filter((r) => r.period === latestPeriod);

  // Get period 12 months ago for comparison
  const latestDate = new Date(latestPeriod);
  const prevDate = new Date(latestDate);
  prevDate.setFullYear(prevDate.getFullYear() - 1);
  const prevPeriod = prevDate.toISOString().slice(0, 10);
  const prevRows = inctlSeries.filter((r) => r.period === prevPeriod);

  const distLabels: Record<number, string> = {
    50: 'Muito Curta (50 km)',
    400: 'Curta (400 km)',
    800: 'Média (800 km)',
    2400: 'Longa (2.400 km)',
    6000: 'Muito Longa (6.000 km)',
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Distância</TableHead>
          <TableHead className="text-right">R$/Ton Atual</TableHead>
          <TableHead className="text-right">R$/Ton 12m atrás</TableHead>
          <TableHead className="text-right">Variação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {latestRows
          .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0))
          .map((row) => {
            const prev = prevRows.find((p) => p.distance_km === row.distance_km);
            const variation =
              prev && prev.index_value > 0
                ? ((row.index_value - prev.index_value) / prev.index_value) * 100
                : null;

            return (
              <TableRow key={row.distance_km}>
                <TableCell className="font-medium">
                  {distLabels[row.distance_km || 0] || `${row.distance_km} km`}
                </TableCell>
                <TableCell className="text-right">{fmtCurrency(row.index_value)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {prev ? fmtCurrency(prev.index_value) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {variation !== null ? (
                    <Badge
                      variant="outline"
                      className={
                        variation > 0
                          ? 'text-red-600 border-red-300 dark:text-red-400'
                          : 'text-green-600 border-green-300 dark:text-green-400'
                      }
                    >
                      {fmtPct(variation)}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function NtcInsightsTab() {
  const { inctlSeries, inctfSeries, fuelReference, summary, isLoading, isError } = useNtcInsights();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando dados NTC...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p>Erro ao carregar dados NTC. Tente novamente mais tarde.</p>
      </div>
    );
  }

  const hasNoData = inctlSeries.length === 0 && inctfSeries.length === 0 && !fuelReference;

  // Prepare chart data
  const chartData = buildInctlChartData(inctlSeries);

  // Build alerts
  const alerts: AlertItem[] = [];

  if (summary.inctlVar12m !== null && summary.inctlVar12m > 5) {
    alerts.push({
      icon: TrendingUp,
      message: `INCTL subiu ${summary.inctlVar12m.toFixed(1)}% em 12 meses — considere reajustar tabelas de frete lotação`,
      severity: 'warning',
    });
  }

  if (summary.inctfVar12m !== null && summary.inctfVar12m > 5) {
    alerts.push({
      icon: TrendingUp,
      message: `INCTF subiu ${summary.inctfVar12m.toFixed(1)}% em 12 meses — considere reajustar tabelas de frete fracionado`,
      severity: 'warning',
    });
  }

  if (
    fuelReference &&
    fuelReference.monthly_variation_pct !== null &&
    fuelReference.monthly_variation_pct > 2
  ) {
    alerts.push({
      icon: Fuel,
      message: `Diesel subiu ${fuelReference.monthly_variation_pct.toFixed(1)}% no mês — impacto direto no custo do frete`,
      severity: 'warning',
    });
  }

  if (summary.inctlVar12m !== null && summary.inctlVar12m < 3) {
    alerts.push({
      icon: Info,
      message: `Custos de frete lotação estáveis: variação de apenas ${summary.inctlVar12m.toFixed(1)}% em 12 meses`,
      severity: 'success',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      icon: Info,
      message: 'Sem alertas relevantes no momento. Índices dentro da normalidade.',
      severity: 'info',
    });
  }

  return (
    <div className="space-y-6">
      {/* Empty state banner */}
      {hasNoData && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/40">
          <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Dados NTC não disponíveis</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Os índices INCTL, INCTF e preço do diesel são importados periodicamente. Aguarde a
              próxima atualização ou contate o suporte.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightCard
          title="INCTL Lotação"
          value={fmtPct(summary.inctlVar12m)}
          subtitle={
            summary.latestInctlPeriod ? `Ref. ${fmtPeriod(summary.latestInctlPeriod)}` : undefined
          }
          icon={Truck}
          trend={summary.inctlVar12m}
          color="blue"
          delay={0}
        />
        <InsightCard
          title="INCTF Fracionado"
          value={fmtPct(summary.inctfVar12m)}
          subtitle={
            summary.latestInctfPeriod ? `Ref. ${fmtPeriod(summary.latestInctfPeriod)}` : undefined
          }
          icon={Package}
          trend={summary.inctfVar12m}
          color="green"
          delay={0.05}
        />
        <InsightCard
          title="Diesel Médio"
          value={summary.dieselPrice ? `R$ ${summary.dieselPrice.toFixed(2)}/L` : '—'}
          subtitle={
            fuelReference?.reference_month
              ? `Ref. ${fmtPeriod(fuelReference.reference_month)}`
              : undefined
          }
          icon={Fuel}
          trend={summary.dieselVariation}
          color="orange"
          delay={0.1}
        />
        <InsightCard
          title="Faixas de Distância"
          value={
            inctlSeries.length > 0 ? `${new Set(inctlSeries.map((r) => r.distance_km)).size}` : '—'
          }
          subtitle={inctlSeries.length > 0 ? 'Monitoradas no INCTL' : 'Sem dados importados'}
          icon={BarChart3}
          color="purple"
          delay={0.15}
        />
      </div>

      {/* INCTL Trend Chart */}
      {chartData.length > 0 && (
        <motion.div
          className="bg-card rounded-xl border border-border shadow-card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Tendência INCTL — R$/Tonelada por Distância
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Evolução do custo de frete lotação nos últimos 12 meses (NTC&Logística)
          </p>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => fmtCurrency(value)}
                labelFormatter={(label: string) => `Período: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="d800"
                name="800 km"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="d400"
                name="400 km"
                stroke="#10b981"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="d2400"
                name="2.400 km"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Bottom row: INCTL Table + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INCTL Latest R$/Ton Table */}
        <motion.div
          className="bg-card rounded-xl border border-border shadow-card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">INCTL — R$/Tonelada Atual</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Referência NTC por faixa de distância
          </p>
          {inctlSeries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhum dado INCTL disponível</p>
              <p className="text-xs mt-1 opacity-70">Os índices são importados periodicamente</p>
            </div>
          ) : (
            <InctlLatestTable inctlSeries={inctlSeries} />
          )}
        </motion.div>

        {/* Smart Alerts */}
        <motion.div
          className="bg-card rounded-xl border border-border shadow-card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">Alertas Inteligentes</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Baseado nos dados NTC e suas cotações
          </p>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${severityStyle[alert.severity]}`}
              >
                <alert.icon className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* INCTF Series Mini Card */}
      {inctfSeries.length > 0 && (
        <motion.div
          className="bg-card rounded-xl border border-border shadow-card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">
            INCTF — Índice de Frete Fracionado
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Evolução do índice geral de custo do frete fracionado (NTC&Logística)
          </p>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={[...inctfSeries]
                .sort((a, b) => a.period.localeCompare(b.period))
                .map((r) => ({
                  label: fmtPeriod(r.period),
                  value: Math.round(r.index_value * 100) / 100,
                }))}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value: number) => [value.toFixed(2), 'Índice INCTF']}
                labelFormatter={(label: string) => `Período: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="INCTF"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}
