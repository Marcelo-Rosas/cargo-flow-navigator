import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Route,
  Users,
  Lightbulb,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Lock,
  TrendingUp as ForecastIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { formatCurrency } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodType = 'historical' | 'forecast';

interface MirofishSyncResult {
  reports_synced?: number;
}
interface RouteInsight {
  id: string;
  route: string;
  avg_ticket: number | null;
  volume_ctes: number | null;
  revenue: number | null;
  ntc_impact: number | null;
}
interface ShipperInsight {
  id: string;
  shipper_name: string;
  ctes: number | null;
  revenue: number | null;
  avg_ticket: number | null;
  churn_risk: string | null;
}
interface MirofishRecommendation {
  id: string;
  status: string;
  action: string;
  target_routes: string[] | null;
  priority: string;
}
interface ReportMeta {
  id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useActiveReport(periodType: PeriodType) {
  return useQuery<ReportMeta | null>({
    queryKey: ['mirofish_active_report', periodType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mirofish_reports')
        .select('id, title, period_start, period_end')
        .eq('period_type', periodType)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useMirofishRoutes(reportId: string | null | undefined) {
  return useQuery<RouteInsight[]>({
    queryKey: ['mirofish_route_insights', reportId],
    queryFn: async () => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from('mirofish_route_insights')
        .select('id, route, avg_ticket, volume_ctes, revenue, ntc_impact')
        .eq('report_id', reportId)
        .order('avg_ticket', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!reportId,
    staleTime: 5 * 60 * 1000,
  });
}

function useMirofishShippers(reportId: string | null | undefined) {
  return useQuery<ShipperInsight[]>({
    queryKey: ['mirofish_shipper_insights', reportId],
    queryFn: async () => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from('mirofish_shipper_insights')
        .select('id, shipper_name, ctes, revenue, avg_ticket, churn_risk')
        .eq('report_id', reportId)
        .order('revenue', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!reportId,
    staleTime: 5 * 60 * 1000,
  });
}

function useMirofishRecommendations(reportId: string | null | undefined) {
  return useQuery<MirofishRecommendation[]>({
    queryKey: ['mirofish_recommendations', reportId],
    queryFn: async () => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from('mirofish_recommendations')
        .select('id, status, action, target_routes, priority')
        .eq('report_id', reportId)
        .neq('status', 'dismissed')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!reportId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChurnBadge({ risk }: { risk: string | null }) {
  if (!risk) return null;
  if (risk === 'high')
    return <Badge className="bg-red-100 text-red-700 border border-red-200">Risco alto</Badge>;
  if (risk === 'medium')
    return (
      <Badge className="bg-amber-100 text-amber-700 border border-amber-200">Risco médio</Badge>
    );
  return (
    <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">Estável</Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'high')
    return <Badge className="bg-orange-100 text-orange-700 border border-orange-200">Alta</Badge>;
  if (priority === 'low')
    return <Badge className="bg-slate-100 text-slate-600 border border-slate-200">Baixa</Badge>;
  return <Badge variant="outline">Média</Badge>;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (status === 'in_progress') return <Clock size={14} className="text-amber-500" />;
  return <AlertCircle size={14} className="text-slate-400" />;
}

function SyncButton() {
  const queryClient = useQueryClient();
  const [lastSync, setLastSync] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => invokeEdgeFunction('mirofish-sync', {}),
    onSuccess: (data: MirofishSyncResult | null) => {
      queryClient.invalidateQueries({ queryKey: ['mirofish_active_report'] });
      queryClient.invalidateQueries({ queryKey: ['mirofish_route_insights'] });
      queryClient.invalidateQueries({ queryKey: ['mirofish_shipper_insights'] });
      queryClient.invalidateQueries({ queryKey: ['mirofish_recommendations'] });
      setLastSync(
        `${data?.reports_synced ?? 0} relatórios sincronizados às ${new Date().toLocaleTimeString('pt-BR')}`
      );
    },
  });

  return (
    <div className="flex items-center gap-3">
      {lastSync && <span className="text-xs text-muted-foreground">{lastSync}</span>}
      <Button
        variant="outline"
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="gap-2"
      >
        <RefreshCw size={14} className={mutation.isPending ? 'animate-spin' : ''} />
        {mutation.isPending ? 'Sincronizando...' : 'Sincronizar MiroFish'}
      </Button>
    </div>
  );
}

// ─── Period tab selector ──────────────────────────────────────────────────────

interface PeriodTabProps {
  active: PeriodType;
  onChange: (p: PeriodType) => void;
}

function PeriodTabs({ active, onChange }: PeriodTabProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
      <button
        onClick={() => onChange('historical')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          active === 'historical'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Lock size={12} />
        Dados Reais 2025
      </button>
      <button
        onClick={() => onChange('forecast')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          active === 'forecast'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <ForecastIcon size={12} />
        Projeção 2026
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MirofishInsightsTab() {
  const [periodType, setPeriodType] = useState<PeriodType>('historical');

  const report = useActiveReport(periodType);
  const reportId = report.data?.id;

  const routes = useMirofishRoutes(reportId);
  const shippers = useMirofishShippers(reportId);
  const recs = useMirofishRecommendations(reportId);

  const queryClient = useQueryClient();

  async function dismissRec(id: string) {
    await supabase.from('mirofish_recommendations').update({ status: 'dismissed' }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['mirofish_recommendations', reportId] });
  }

  const isLoading = report.isLoading || routes.isLoading || shippers.isLoading || recs.isLoading;
  const isEmpty = !routes.data?.length && !shippers.data?.length && !recs.data?.length;
  const periodLabel = formatPeriod(
    report.data?.period_start ?? null,
    report.data?.period_end ?? null
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inteligência MiroFish</h2>
          <p className="text-sm text-muted-foreground">
            Insights de mercado sincronizados das simulações de inteligência logística.
          </p>
        </div>
        <SyncButton />
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-4">
        <PeriodTabs active={periodType} onChange={setPeriodType} />
        {periodLabel && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{periodLabel}</span>
            {periodType === 'historical' ? (
              <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-xs">
                Período fechado
              </Badge>
            ) : (
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">
                Projeção
              </Badge>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <RefreshCw size={14} className="animate-spin" />
          Carregando dados...
        </div>
      )}

      {!isLoading && !report.data && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum relatório {periodType === 'historical' ? 'histórico' : 'de projeção'}{' '}
            sincronizado.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Clique em "Sincronizar MiroFish" para importar relatórios.
          </p>
        </div>
      )}

      {!isLoading && report.data && isEmpty && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">Nenhum insight neste período.</p>
        </div>
      )}

      {/* Route Performance */}
      {!!routes.data?.length && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Route size={16} className="text-muted-foreground" />
            <span className="font-semibold text-sm">Performance por Rota</span>
            <Badge variant="secondary" className="ml-auto">
              {routes.data.length} rotas
            </Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Volume (CT-es)</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Impacto NTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-semibold">{r.route}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.avg_ticket != null ? (
                      <span className="flex items-center justify-end gap-1">
                        {formatCurrency(r.avg_ticket)}
                        {r.avg_ticket > 5000 ? (
                          <TrendingUp size={12} className="text-emerald-500" />
                        ) : (
                          <TrendingDown size={12} className="text-slate-400" />
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.volume_ctes ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.revenue != null ? formatCurrency(r.revenue) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {r.ntc_impact != null ? (
                      <span className="text-amber-600">+{formatCurrency(r.ntc_impact)}</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Shipper Profiles */}
      {!!shippers.data?.length && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Users size={16} className="text-muted-foreground" />
            <span className="font-semibold text-sm">Perfil de Embarcadores</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Embarcador</TableHead>
                <TableHead className="text-right">CT-es</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead>Risco Churn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shippers.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">{s.shipper_name}</TableCell>
                  <TableCell className="text-right font-mono">{s.ctes ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {s.revenue != null ? formatCurrency(s.revenue) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {s.avg_ticket != null ? formatCurrency(s.avg_ticket) : '—'}
                  </TableCell>
                  <TableCell>
                    <ChurnBadge risk={s.churn_risk} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Recommendations */}
      {!!recs.data?.length && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Lightbulb size={16} className="text-muted-foreground" />
            <span className="font-semibold text-sm">Recomendações Estratégicas</span>
          </div>
          <div className="divide-y divide-border">
            {recs.data.map((rec) => (
              <div key={rec.id} className="flex items-start gap-3 px-5 py-4">
                <StatusIcon status={rec.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{rec.action}</p>
                  {rec.target_routes && rec.target_routes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rec.target_routes.map((r: string) => (
                        <Badge
                          key={r}
                          variant="outline"
                          className="text-[10px] font-mono px-1.5 py-0"
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <PriorityBadge priority={rec.priority} />
                <button
                  onClick={() => dismissRec(rec.id)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                  title="Descartar"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
