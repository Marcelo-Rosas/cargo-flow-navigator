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

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useMirofishRoutes() {
  return useQuery({
    queryKey: ['mirofish_route_insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mirofish_route_insights')
        .select('*, mirofish_reports(generated_at)')
        .order('avg_ticket', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useMirofishShippers() {
  return useQuery({
    queryKey: ['mirofish_shipper_insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mirofish_shipper_insights')
        .select('*')
        .order('revenue', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useMirofishRecommendations() {
  return useQuery({
    queryKey: ['mirofish_recommendations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mirofish_recommendations')
        .select('*')
        .neq('status', 'dismissed')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
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
    onSuccess: (data: any) => {
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

// ─── Main component ───────────────────────────────────────────────────────────

export function MirofishInsightsTab() {
  const routes = useMirofishRoutes();
  const shippers = useMirofishShippers();
  const recs = useMirofishRecommendations();

  const queryClient = useQueryClient();

  async function dismissRec(id: string) {
    await supabase.from('mirofish_recommendations').update({ status: 'dismissed' }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['mirofish_recommendations'] });
  }

  const isEmpty = !routes.data?.length && !shippers.data?.length && !recs.data?.length;
  const isLoading = routes.isLoading || shippers.isLoading || recs.isLoading;

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

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <RefreshCw size={14} className="animate-spin" />
          Carregando dados...
        </div>
      )}

      {!isLoading && isEmpty && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">Nenhum insight sincronizado ainda.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Clique em "Sincronizar MiroFish" para importar relatórios.
          </p>
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
              {routes.data.map((r: any) => (
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
              {shippers.data.map((s: any) => (
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
            {recs.data.map((rec: any) => (
              <div key={rec.id} className="flex items-start gap-3 px-5 py-4">
                <StatusIcon status={rec.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{rec.action}</p>
                  {rec.target_routes?.length > 0 && (
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
