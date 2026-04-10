import { useState } from 'react';
import { Fuel, Loader2, TrendingUp, Route, AlertTriangle } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDieselCostByRoute } from '@/hooks/useDieselCostByRoute';

// ─── Period presets ────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '2025 completo', from: '2025-01-01', to: '2025-12-31' },
  { label: '2026 até hoje', from: '2026-01-01', to: null },
  { label: 'Últimos 6 meses', from: sixMonthsAgo(), to: null },
  { label: 'Tudo', from: '2025-01-01', to: null },
] as const;

function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function brlLitro(value: number): string {
  return (
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value) + ' /L'
  );
}

function pctBadge(pct: number) {
  if (pct >= 60) return <Badge variant="destructive">{pct.toFixed(1)}%</Badge>;
  if (pct >= 40) return <Badge variant="warning">{pct.toFixed(1)}%</Badge>;
  return <Badge variant="outline">{pct.toFixed(1)}%</Badge>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DieselCostTab() {
  const [periodIdx, setPeriodIdx] = useState(1); // default: 2026 até hoje
  const period = PERIODS[periodIdx];

  const { data: rows, isLoading, isError } = useDieselCostByRoute(period.from, period.to ?? null);

  const totalDiesel = rows?.reduce((s, r) => s + r.diesel_total_soma, 0) ?? 0;
  const totalReceita = rows?.reduce((s, r) => s + r.receita_media * r.ctes, 0) ?? 0;
  const avgPctGlobal = totalReceita > 0 ? (totalDiesel / totalReceita) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Fuel className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-foreground">Custo de Diesel por Rota</h2>
          <span className="text-xs text-muted-foreground">
            Preços ANP históricos na data de emissão do CT-e · consumo 0,3 L/km (NTC)
          </span>
        </div>

        <Select value={String(periodIdx)} onValueChange={(v) => setPeriodIdx(Number(v))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p, i) => (
              <SelectItem key={i} value={String(i)}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI summary strip */}
      {rows && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Rotas analisadas</p>
            <p className="text-2xl font-bold text-foreground">{rows.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-1">
            <p className="text-xs text-muted-foreground">CT-es com diesel</p>
            <p className="text-2xl font-bold text-foreground">
              {rows.reduce((s, r) => s + r.ctes, 0)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total diesel estimado</p>
            <p className="text-2xl font-bold text-amber-600">{brl(totalDiesel)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-1">
            <p className="text-xs text-muted-foreground">% médio sobre ticket</p>
            <p className="text-2xl font-bold text-foreground">{avgPctGlobal.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-destructive py-8">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">Erro ao carregar dados de diesel.</span>
        </div>
      )}

      {!isLoading && !isError && rows && rows.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Fuel className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum CT-e com dados de diesel para o período selecionado.</p>
          <p className="text-xs mt-1">
            Verifique se as OS possuem km_distance preenchido e CT-e marcado.
          </p>
        </div>
      )}

      {!isLoading && !isError && rows && rows.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="text-right">CT-es</TableHead>
                <TableHead className="text-right">KM médio</TableHead>
                <TableHead className="text-right">
                  <span title="Preço ANP médio no estado de origem">Diesel Orig.</span>
                </TableHead>
                <TableHead className="text-right">
                  <span title="Preço ANP médio no estado de destino">Diesel Dest.</span>
                </TableHead>
                <TableHead className="text-right">
                  <span title="Média dos preços de origem e destino">Média rota</span>
                </TableHead>
                <TableHead className="text-right">
                  <span title="Média rota × 0,3 L/km">Custo/km</span>
                </TableHead>
                <TableHead className="text-right">
                  <span title="KM médio × Custo/km (por CT-e)">Diesel médio</span>
                </TableHead>
                <TableHead className="text-right">
                  <span title="Soma de todos os CT-es da rota">Diesel total</span>
                </TableHead>
                <TableHead className="text-right">
                  <span title="Diesel médio / Receita média do CT-e">% ticket</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.rota}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Route className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{row.rota}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.ctes}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.km_medio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km
                  </TableCell>
                  <TableCell className="text-right text-sm">{brlLitro(row.diesel_orig)}</TableCell>
                  <TableCell className="text-right text-sm">{brlLitro(row.diesel_dest)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {brlLitro(row.media_rota)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {new Intl.NumberFormat('pt-BR', {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    }).format(row.custo_por_km)}{' '}
                    /km
                  </TableCell>
                  <TableCell className="text-right">{brl(row.diesel_total_medio)}</TableCell>
                  <TableCell className="text-right font-medium text-amber-600">
                    {brl(row.diesel_total_soma)}
                  </TableCell>
                  <TableCell className="text-right">{pctBadge(row.pct_ticket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footnote */}
      <p className="text-xs text-muted-foreground">
        * Preços ANP Diesel S-10 — semana mais próxima anterior à emissão de cada CT-e. Consumo
        padrão NTC: 0,3 L/km. Valores em R$. Fonte: ANP Série Histórica semanal por estado.
      </p>
    </div>
  );
}
