// [DASHBOARD] — src/components/dashboard/NtcIndicesCard.tsx
// Usa useNtcIndices (ntc_cost_indices + ntc_fuel_reference + RPC get_ntc_variation_12m)
// Insumos: tenta market_indices (lotacao_salario_12m, lotacao_pneu_12m); fallback estático

import { useNtcIndices } from '@/hooks/useNtcIndices';
import { useLatestMarketIndex } from '@/hooks/useMarketIndices';
import { TrendingUp, AlertTriangle, Info, Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3 text-xs shadow-sm">
      <p className="font-medium text-zinc-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === 'inctl'
            ? `INCTL: ${fmtPct(p.value)}`
            : `Diesel: R$ ${p.value.toFixed(2)}/L`}
        </p>
      ))}
    </div>
  );
};

export function NtcIndicesCard() {
  const { data, isLoading, isError } = useNtcIndices();
  const { data: latestMarket } = useLatestMarketIndex();

  const periodoLabel = data?.inctl_periodo
    ? new Date(data.inctl_periodo).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : '—';

  if (isLoading)
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-5 flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-zinc-400" size={20} />
      </div>
    );

  if (isError || !data)
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-5 text-sm text-zinc-400">
        Não foi possível carregar os índices NTC.
      </div>
    );

  const cards = [
    {
      label: 'INCTF 12M',
      value: `+${data.inctf_pct.toFixed(2)}%`,
      sub: 'Carga Fracionada',
      color: 'emerald',
      arrow: true,
    },
    {
      label: 'INCTL 12M',
      value: `+${data.inctl_pct.toFixed(2)}%`,
      sub: 'Carga Lotação',
      color: 'emerald',
      arrow: true,
    },
    {
      label: 'Diesel S-10',
      value: `R$ ${data.diesel_price.toFixed(2)}/L`,
      sub: 'Preço médio nacional',
      color: 'amber',
      arrow: false,
    },
    {
      label: 'Reajuste sugerido',
      value: `${data.reajuste_sugerido.toFixed(2)}%`,
      sub: 'Acumulado 12 meses',
      color: 'blue',
      arrow: true,
    },
  ];

  const insumos = [
    {
      label: 'Salário motorista',
      value:
        latestMarket?.lotacao_salario_12m != null
          ? fmtPct(latestMarket.lotacao_salario_12m * 100)
          : '+7,00%',
    },
    {
      label: 'Pneu 295/80 R22,5',
      value:
        latestMarket?.lotacao_pneu_12m != null
          ? fmtPct(latestMarket.lotacao_pneu_12m * 100)
          : '+8,10%',
    },
  ];

  const firstMes = data.evolution[0]?.mes ?? '';
  const lastMes = data.evolution[data.evolution.length - 1]?.mes ?? '';

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase">
            Índices NTC &amp; Logística
          </p>
          <p className="text-xl font-medium text-zinc-900 mt-0.5 capitalize">{periodoLabel}</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle size={12} />
          Atenção
        </span>
      </div>

      {/* 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-2.5">
        {cards.map(({ label, value, sub, color, arrow }) => (
          <div
            key={label}
            className={`rounded-r-xl border-y border-r border-l-[2.5px] border-zinc-200 pl-3.5 pr-3 py-3 ${
              color === 'emerald'
                ? 'border-l-emerald-600'
                : color === 'amber'
                  ? 'border-l-amber-600'
                  : 'border-l-blue-500'
            }`}
          >
            <p className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase mb-1.5">
              {label}
            </p>
            <div
              className={`flex items-center gap-1.5 text-[22px] font-medium leading-none mb-1 ${
                color === 'emerald'
                  ? 'text-emerald-700'
                  : color === 'amber'
                    ? 'text-amber-700'
                    : 'text-blue-700'
              }`}
            >
              {value}
              {arrow && <TrendingUp size={16} strokeWidth={2} />}
            </div>
            <p className="text-[12px] text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>

      {/* Insumos Lotação — usa market_indices quando houver; senão fallback estático */}
      <div className="rounded-xl border border-zinc-200 px-4 py-3 mb-2.5">
        <p className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase mb-2">
          Insumos Lotação 12M
        </p>
        {insumos.map(({ label, value }, i) => (
          <div
            key={label}
            className={`flex items-center justify-between py-2 text-sm ${i > 0 ? 'border-t border-zinc-100' : ''}`}
          >
            <span className="text-zinc-500">{label}</span>
            <span className="font-medium text-emerald-700">{value}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      {data.evolution.length > 0 && (
        <div className="rounded-xl border border-zinc-200 px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-medium tracking-widest text-zinc-400 uppercase">
              Evolução INCTL 12M
            </p>
            <div className="flex gap-3 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-600" />
                INCTL
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-600" />
                Diesel
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={data.evolution} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0efe8" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: '#a1a09a' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#059669' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v.toFixed(1)}%`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#d97706' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${v.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="inctl"
                stroke="#059669"
                strokeWidth={2}
                dot={{ r: 3, fill: '#059669' }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="diesel"
                stroke="#d97706"
                strokeWidth={2}
                dot={{ r: 3, fill: '#d97706' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
            <span>{firstMes}</span>
            <span>{lastMes}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-zinc-400">
        <Info size={12} />
        Fonte: Portal NTC &amp; Logística — Monitor automático seg/sex 08h10
      </div>
    </div>
  );
}
