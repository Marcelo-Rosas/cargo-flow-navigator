import {
  TrendingUp,
  TrendingDown,
  Fuel,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useMarketAlert, useMarketIndices } from '@/hooks/useMarketIndices';

const ALERTA = {
  estavel: {
    label: 'Estavel',
    Icon: CheckCircle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  atencao: {
    label: 'Atencao',
    Icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  urgente: {
    label: 'Urgente',
    Icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
  },
} as const;

function fmtPct(v: number | null): string {
  if (v == null) return '--';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function MetricBox({
  label,
  value,
  sub,
  trend,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}) {
  const color =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1 shadow-sm">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={`text-xl font-bold font-mono leading-none ${color}`}>{value}</span>
        {trend === 'up' && <TrendingUp size={14} className="text-emerald-500" />}
        {trend === 'down' && <TrendingDown size={14} className="text-red-500" />}
      </div>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Sparkbar({
  series,
}: {
  series: Array<{ inctl_12meses: number | null; periodo_referencia: string }>;
}) {
  if (series.length < 2) return null;
  const rev = [...series].reverse();
  const max = Math.max(...rev.map((m) => m.inctl_12meses ?? 0), 0.01);
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
        Evolucao INCTL 12m
      </p>
      <div className="flex items-end gap-1.5 h-10">
        {rev.map((m, i) => {
          const v = m.inctl_12meses ?? 0;
          const h = Math.max(4, Math.round((v / max) * 40));
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                style={{ height: h }}
                className="w-full rounded-sm bg-orange-400 hover:bg-orange-500 transition-colors cursor-default opacity-80"
                title={`${m.periodo_referencia}: ${fmtPct(+(v * 100).toFixed(2))}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>{series[series.length - 1]?.periodo_referencia?.split('/')[0]}</span>
        <span>{series[0]?.periodo_referencia}</span>
      </div>
    </div>
  );
}

export function MarketInsightsCard() {
  const alert = useMarketAlert();
  const { data: series = [], isLoading: seriesLoading } = useMarketIndices(6);

  if (alert.isLoading || seriesLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-pulse shadow-sm">
        <div className="h-4 bg-muted rounded w-40" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="h-12 bg-muted rounded" />
      </div>
    );
  }

  if (!alert.periodo) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center justify-center gap-3 text-center min-h-32 shadow-sm">
        <RefreshCw size={20} className="text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Sem dados de mercado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Envie o relatorio NTC para atualizar os indices.
          </p>
        </div>
      </div>
    );
  }

  const cfg = ALERTA[alert.alerta ?? 'estavel'];
  const { Icon: AlertIcon } = cfg;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Indices NTC &amp; Logistica
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{alert.periodo}</p>
        </div>
        <span
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}
        >
          <AlertIcon size={11} />
          {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricBox
          label="INCTF 12m"
          value={fmtPct(alert.inctf12m)}
          sub="Carga Fracionada"
          trend={alert.inctf12m != null ? (alert.inctf12m > 7 ? 'down' : 'up') : 'neutral'}
        />
        <MetricBox
          label="INCTL 12m"
          value={fmtPct(alert.inctl12m)}
          sub="Carga Lotacao"
          trend={alert.inctl12m != null ? (alert.inctl12m > 7 ? 'down' : 'up') : 'neutral'}
        />
        <MetricBox
          label="Diesel S-10"
          value={alert.diesel ? `R$ ${alert.diesel.toFixed(2)}/L` : '--'}
          sub="Preco medio nacional"
          trend="neutral"
          icon={<Fuel size={14} className="text-orange-500" />}
        />
        <MetricBox
          label="Reajuste sugerido"
          value={alert.reajuste != null ? `${alert.reajuste.toFixed(2)}%` : '--'}
          sub="Acumulado 12 meses"
          trend={alert.reajuste != null ? (alert.reajuste > 8 ? 'down' : 'up') : 'neutral'}
        />
      </div>

      {(alert.salario12m != null || alert.pneu12m != null) && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <p className="col-span-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
            Insumos Lotacao 12m
          </p>
          {alert.salario12m != null && (
            <>
              <span className="text-[11px] text-muted-foreground">Salario motorista</span>
              <span className="text-[11px] font-mono font-semibold text-foreground text-right">
                {fmtPct(alert.salario12m)}
              </span>
            </>
          )}
          {alert.pneu12m != null && (
            <>
              <span className="text-[11px] text-muted-foreground">Pneu 295/80 R22,5</span>
              <span className="text-[11px] font-mono font-semibold text-foreground text-right">
                {fmtPct(alert.pneu12m)}
              </span>
            </>
          )}
        </div>
      )}

      <Sparkbar series={series} />

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border">
        <Clock size={10} />
        Fonte: Portal NTC &amp; Logistica - Monitor automatico seg/sex 08h10
      </div>
    </div>
  );
}
