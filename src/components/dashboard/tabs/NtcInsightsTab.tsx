import { useMarketIndices, useLatestMarketIndex } from '@/hooks/useMarketIndices';
import {
  TrendingUp,
  TrendingDown,
  Fuel,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Truck,
  Loader2,
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function pct(v: number | null, raw = false): string {
  if (v == null) return '—';
  const val = raw ? v : v * 100;
  return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function AlertBadge({ nivel }: { nivel: string | null }) {
  if (!nivel) return null;
  if (nivel === 'urgente') return <Badge variant="destructive">Urgente</Badge>;
  if (nivel === 'atencao')
    return <Badge className="bg-amber-100 text-amber-700 border border-amber-200">Atencao</Badge>;
  return (
    <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">Estavel</Badge>
  );
}

function InsightCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number | null;
}) {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
          {title}
        </span>
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {trend != null && (
        <div
          className={`flex items-center gap-1 text-xs font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}
        >
          {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {pct(trend)} em 12 meses
        </div>
      )}
    </div>
  );
}

export function NtcInsightsTab() {
  const { data: series = [], isLoading } = useMarketIndices(12);
  const { data: latest } = useLatestMarketIndex();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <BarChart3 size={40} className="text-muted-foreground mx-auto mb-3" />
        <p className="font-medium text-foreground">Sem dados de mercado</p>
        <p className="text-sm text-muted-foreground mt-1">
          Envie o relatorio mensal NTC para popular os indices.
        </p>
      </div>
    );
  }

  // Dados para o grafico — series ja vem desc, revertemos para asc
  const chartData = [...series].reverse().map((m) => ({
    name: m.periodo_referencia.replace('/20', '/'),
    INCTF: m.inctf_12meses != null ? +(m.inctf_12meses * 100).toFixed(2) : null,
    INCTL: m.inctl_12meses != null ? +(m.inctl_12meses * 100).toFixed(2) : null,
    Reajuste: m.reajuste_sugerido_pct,
  }));

  return (
    <div className="space-y-6">
      {/* Cards de destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightCard
          title="INCTF Mensal"
          value={pct(latest.inctf_mensal)}
          subtitle={`Acum. 12m: ${pct(latest.inctf_12meses)}`}
          icon={Truck}
          trend={latest.inctf_12meses}
        />
        <InsightCard
          title="INCTL Mensal"
          value={pct(latest.inctl_mensal)}
          subtitle={`Acum. 12m: ${pct(latest.inctl_12meses)}`}
          icon={Truck}
          trend={latest.inctl_12meses}
        />
        <InsightCard
          title="Diesel S10"
          value={
            latest.diesel_s10_preco
              ? `R$ ${latest.diesel_s10_preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L`
              : '—'
          }
          subtitle={`Var. 12m: ${pct(latest.diesel_s10_12meses)}`}
          icon={Fuel}
          trend={latest.diesel_s10_12meses}
        />
        <InsightCard
          title="Reajuste Sugerido"
          value={latest.reajuste_sugerido_pct ? `${latest.reajuste_sugerido_pct.toFixed(2)}%` : '—'}
          subtitle={`Ref: ${latest.periodo_referencia}`}
          icon={BarChart3}
          trend={null}
        />
      </div>

      {/* Grafico de evolucao */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-1">Evolucao dos Indices NTC</h3>
        <p className="text-xs text-muted-foreground mb-4">Variacao acumulada 12 meses (%)</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="INCTF"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="INCTF (Fracinado)"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="INCTL"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="INCTL (Lotacao)"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Reajuste"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={{ r: 3 }}
              name="Reajuste Sugerido"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela historica */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Historico de Indices de Mercado</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ultimos periodos — Fonte: Portal NTC & Logistica
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periodo</TableHead>
              <TableHead className="text-right">INCTF 12m</TableHead>
              <TableHead className="text-right">INCTL 12m</TableHead>
              <TableHead className="text-right">Diesel S10</TableHead>
              <TableHead className="text-right">Reajuste</TableHead>
              <TableHead className="text-right">Alerta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.periodo_referencia}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {pct(m.inctf_12meses)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {pct(m.inctl_12meses)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {m.diesel_s10_preco
                    ? `R$ ${Number(m.diesel_s10_preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {m.reajuste_sugerido_pct ? `${Number(m.reajuste_sugerido_pct).toFixed(2)}%` : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <AlertBadge nivel={m.alerta_nivel} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
