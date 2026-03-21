import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type {
  RouteMetricRow,
  RouteMetricsConfigRow,
  UpsertRouteMetricsConfigInput,
} from '@/hooks/useRouteMetrics';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBRLPerKm(v: number) {
  return `${formatBRL(v)}/km`;
}

function safeNumber(v: unknown): number | null {
  if (typeof v !== 'number') return null;
  if (!Number.isFinite(v)) return null;
  return v;
}

function findConfig(
  configs: RouteMetricsConfigRow[],
  metric: RouteMetricRow,
  vehicleTypeId?: string | null
): RouteMetricsConfigRow | null {
  return (
    configs.find(
      (c) =>
        c.origin_uf === metric.origin_uf &&
        c.destination_uf === metric.destination_uf &&
        (vehicleTypeId ? c.vehicle_type_id === vehicleTypeId : c.vehicle_type_id == null)
    ) ?? null
  );
}

interface RouteMetricsCardsProps {
  metrics: RouteMetricRow[];
  configs: RouteMetricsConfigRow[];
  vehicleTypeId?: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onUpsert: (input: UpsertRouteMetricsConfigInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isMutating?: boolean;
}

export function RouteMetricsCards(props: RouteMetricsCardsProps) {
  const [selected, setSelected] = useState<RouteMetricRow | null>(null);
  const selectedConfig = useMemo(
    () => (selected ? findConfig(props.configs, selected, props.vehicleTypeId) : null),
    [props.configs, props.vehicleTypeId, selected]
  );

  const [form, setForm] = useState<UpsertRouteMetricsConfigInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openEditor = (metric: RouteMetricRow) => {
    const existing = findConfig(props.configs, metric, props.vehicleTypeId);
    setSelected(metric);
    setForm({
      id: existing?.id,
      origin_uf: metric.origin_uf,
      destination_uf: metric.destination_uf,
      vehicle_type_id: props.vehicleTypeId ?? null,
      is_active: existing?.is_active ?? true,
      target_rs_per_km: existing?.target_rs_per_km ?? null,
      min_rs_per_km: existing?.min_rs_per_km ?? null,
      max_rs_per_km: existing?.max_rs_per_km ?? null,
      notes: existing?.notes ?? null,
    });
  };

  const closeEditor = () => {
    setSelected(null);
    setForm(null);
  };

  if (props.isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando métricas...</div>;
  }

  if (props.isError) {
    return (
      <div className="text-sm text-destructive">
        Erro ao carregar métricas{props.errorMessage ? `: ${props.errorMessage}` : '.'}
      </div>
    );
  }

  if (!props.metrics.length) {
    return (
      <div className="text-sm text-muted-foreground">Sem dados para o período selecionado.</div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {props.metrics.map((m) => {
          const avg = safeNumber(m.avg_rs_per_km);
          const p50 = safeNumber(m.p50_rs_per_km);
          const p90 = safeNumber(m.p90_rs_per_km);
          const avgKm = safeNumber(m.avg_km);
          const avgPaid = safeNumber(m.avg_paid);

          const cfg = findConfig(props.configs, m, props.vehicleTypeId);
          const target = cfg?.target_rs_per_km ?? null;
          const min = cfg?.min_rs_per_km ?? null;
          const max = cfg?.max_rs_per_km ?? null;

          const within = avg != null && (min == null || avg >= min) && (max == null || avg <= max);

          return (
            <Card key={`${m.route_key}-${m.vehicle_type_id ?? 'all'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {m.origin_uf} → {m.destination_uf}
                  </span>
                  <div className="flex items-center gap-2">
                    {cfg?.is_active === false && (
                      <Badge variant="outline" className="text-[10px]">
                        Inativo
                      </Badge>
                    )}
                    {avg != null && (min != null || max != null) && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          within
                            ? 'border-emerald-300 text-emerald-600'
                            : 'border-amber-300 text-amber-700'
                        )}
                      >
                        {within ? 'Dentro' : 'Fora'}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
                {m.vehicle_type_name && (
                  <div className="text-xs text-muted-foreground">{m.vehicle_type_name}</div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-[10px] text-muted-foreground">Média R$/KM</div>
                    <div className="font-semibold">{avg != null ? formatBRLPerKm(avg) : '—'}</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-[10px] text-muted-foreground">Qtd OS</div>
                    <div className="font-semibold">{m.orders_count}</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-[10px] text-muted-foreground">P50</div>
                    <div className="font-semibold">{p50 != null ? formatBRLPerKm(p50) : '—'}</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-[10px] text-muted-foreground">P90</div>
                    <div className="font-semibold">{p90 != null ? formatBRLPerKm(p90) : '—'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    KM médio:{' '}
                    <span className="text-foreground font-medium">
                      {avgKm != null ? avgKm.toFixed(0) : '—'}
                    </span>
                  </div>
                  <div>
                    Carreteiro médio:{' '}
                    <span className="text-foreground font-medium">
                      {avgPaid != null ? formatBRL(avgPaid) : '—'}
                    </span>
                  </div>
                </div>

                {(target != null || min != null || max != null) && (
                  <div className="text-xs text-muted-foreground">
                    {target != null && (
                      <span className="mr-2">
                        Meta:{' '}
                        <span className="text-foreground font-medium">
                          {formatBRLPerKm(target)}
                        </span>
                      </span>
                    )}
                    {min != null && (
                      <span className="mr-2">
                        Min:{' '}
                        <span className="text-foreground font-medium">{formatBRLPerKm(min)}</span>
                      </span>
                    )}
                    {max != null && (
                      <span>
                        Max:{' '}
                        <span className="text-foreground font-medium">{formatBRLPerKm(max)}</span>
                      </span>
                    )}
                  </div>
                )}

                <Button size="sm" variant="outline" onClick={() => openEditor(m)}>
                  Configurar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selected && !!form} onOpenChange={(open) => (!open ? closeEditor() : null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              Configurar rota {selected ? `${selected.origin_uf} → ${selected.destination_uf}` : ''}
            </DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Meta (R$/KM)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.target_rs_per_km ?? ''}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              target_rs_per_km: e.target.value ? Number(e.target.value) : null,
                            }
                          : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Min (R$/KM)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.min_rs_per_km ?? ''}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              min_rs_per_km: e.target.value ? Number(e.target.value) : null,
                            }
                          : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max (R$/KM)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.max_rs_per_km ?? ''}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              max_rs_per_km: e.target.value ? Number(e.target.value) : null,
                            }
                          : prev
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  rows={3}
                  value={form.notes ?? ''}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, notes: e.target.value || null } : prev))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {selectedConfig
                    ? `Atualizado em ${new Date(selectedConfig.updated_at).toLocaleString('pt-BR')}`
                    : 'Sem configuração ainda'}
                </div>
                <div className="flex gap-2">
                  {selectedConfig && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={props.isMutating || isSaving}
                      onClick={() => {
                        setIsSaving(true);
                        props
                          .onDelete(selectedConfig.id)
                          .then(() => closeEditor())
                          .finally(() => setIsSaving(false));
                      }}
                    >
                      Remover
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeEditor}
                    disabled={props.isMutating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={props.isMutating}
                    onClick={() => {
                      if (!form) return;
                      setIsSaving(true);
                      props
                        .onUpsert(form)
                        .then(() => closeEditor())
                        .finally(() => setIsSaving(false));
                    }}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
