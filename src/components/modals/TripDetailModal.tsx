import { useMemo, useState } from 'react';
import { Truck, DollarSign, Loader2, ShieldCheck, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useTrip,
  useTripCostItems,
  useTripOrdersWithOrders,
  useAddOrderToTrip,
  useRemoveOrderFromTrip,
  useSearchOrdersForTrip,
} from '@/hooks/useTrips';
import { useTripReconciliation } from '@/hooks/useReconciliation';
import { useTripFinancialSummary } from '@/hooks/useTripFinancialSummary';
import { useTripFinancialDetails } from '@/hooks/useTripFinancialDetails';
import { useRiskEvaluationByEntity, useTripOrdersRiskStatus } from '@/hooks/useRiskEvaluation';
import { CRITICALITY_CONFIG, REQUIREMENT_LABELS } from '@/types/risk';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog as InlineDialog,
  DialogContent as InlineDialogContent,
  DialogDescription as InlineDialogDescription,
  DialogHeader as InlineDialogHeader,
  DialogTitle as InlineDialogTitle,
} from '@/components/ui/dialog';

interface TripDetailModalProps {
  open: boolean;
  onClose: () => void;
  tripId: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Regra única: valor numérico (incl. 0) → R$ X,XX; null/undefined → "—" */
function formatPivotCell(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return formatCurrency(Number(amount));
}

const CATEGORY_LABELS: Record<string, string> = {
  pedagio: 'Pedágio',
  carreteiro: 'Carreteiro',
  descarga: 'Descarga',
  carga: 'Carga',
  das: 'DAS',
  icms: 'ICMS',
  gris: 'GRIS',
  tso: 'TSO',
  seguro: 'Seguro',
  combustivel: 'Combustível',
  diaria: 'Diária',
  manutencao: 'Manutenção',
  outros: 'Outros',
};

export function TripDetailModal({ open, onClose, tripId }: TripDetailModalProps) {
  const { data: trip, isLoading: tripLoading } = useTrip(tripId);
  const { data: costItems } = useTripCostItems(tripId);
  const { data: tripOrders } = useTripOrdersWithOrders(tripId);
  const { data: reconciliation } = useTripReconciliation(tripId);
  const { data: summary } = useTripFinancialSummary(tripId);
  const { data: financialDetails } = useTripFinancialDetails(tripId);
  const addOrderMutation = useAddOrderToTrip();
  const removeOrderMutation = useRemoveOrderFromTrip();

  const [showAddOsDialog, setShowAddOsDialog] = useState(false);
  const [osSearch, setOsSearch] = useState('');

  const { data: osSearchResults, isLoading: isSearchingOs } = useSearchOrdersForTrip(
    tripId,
    osSearch
  );

  // VG Risk
  const orderIds = useMemo(
    () => tripOrders?.map((to) => to.order_id).filter((id): id is string => !!id),
    [tripOrders]
  );
  const { data: tripRiskEval } = useRiskEvaluationByEntity('trip', tripId ?? undefined);
  const { data: orderRiskStatuses } = useTripOrdersRiskStatus(orderIds);

  const vgSummary = useMemo(() => {
    if (!orderRiskStatuses || orderRiskStatuses.length === 0) return null;
    const totalCargoValue = orderRiskStatuses.reduce(
      (sum, s) => sum + Number(s.cargo_value ?? 0),
      0
    );
    const allApproved = orderRiskStatuses.every(
      (s) => s.risk_status === 'approved' || s.risk_status === null
    );
    const totalRiskCost = orderRiskStatuses.reduce(
      (sum, s) => sum + Number(s.total_risk_cost ?? 0),
      0
    );
    return {
      orderCount: orderRiskStatuses.length,
      totalCargoValue,
      allApproved,
      totalRiskCost,
    };
  }, [orderRiskStatuses]);

  const hasRealDetails = (financialDetails?.length ?? 0) > 0;
  const receitaRealTotal =
    financialDetails?.reduce((acc, row) => acc + Number(row.receita_real ?? 0), 0) ?? 0;
  const custosDiretosRealTotal =
    financialDetails?.reduce(
      (acc, row) =>
        acc +
        Number(row.carreteiro_real ?? 0) +
        Number(row.pedagio_real ?? 0) +
        Number(row.descarga_real ?? 0),
      0
    ) ?? 0;
  const margemReal = receitaRealTotal - custosDiretosRealTotal;
  const margemRealPercent = receitaRealTotal > 0 ? (margemReal / receitaRealTotal) * 100 : null;

  if (!tripId) return null;

  const tripCosts = (costItems ?? []).filter((c) => c.scope === 'TRIP');
  const osCosts = (costItems ?? []).filter((c) => c.scope === 'OS');

  if (tripLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader className="sr-only">
            <DialogTitle>Carregando viagem</DialogTitle>
            <DialogDescription>
              Carrega os dados detalhados da viagem selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!trip) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[96vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 font-mono text-lg">
              <Truck className="w-5 h-5 text-muted-foreground" />
              {trip.trip_number}
            </span>
            <Badge variant="secondary">{trip.status_operational}</Badge>
            {reconciliation?.trip_reconciled && <Badge variant="success">Conciliado</Badge>}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Visualize os detalhes da viagem, ordens vinculadas, risco e conciliação financeira.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto space-y-6 pt-2">
          {/* Painel VG — Risco */}
          {(tripRiskEval || vgSummary) && (
            <div className="p-4 rounded-lg border border-border space-y-3 bg-muted/20">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                {vgSummary?.allApproved ? (
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-yellow-600" />
                )}
                Risco / VG
                {tripRiskEval && (
                  <Badge
                    variant={
                      CRITICALITY_CONFIG[tripRiskEval.criticality]?.badgeVariant ?? 'secondary'
                    }
                    className="ml-1 text-[10px]"
                  >
                    {CRITICALITY_CONFIG[tripRiskEval.criticality]?.label ??
                      tripRiskEval.criticality}
                  </Badge>
                )}
                {tripRiskEval && (
                  <Badge variant="outline" className="text-[10px]">
                    {tripRiskEval.status}
                  </Badge>
                )}
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {vgSummary && (
                  <>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor carga (soma)</p>
                      <p className="font-semibold">{formatCurrency(vgSummary.totalCargoValue)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Ordens</p>
                      <p className="font-semibold">{vgSummary.orderCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Custo risco</p>
                      <p className="font-semibold">{formatCurrency(vgSummary.totalRiskCost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">VG Gate</p>
                      <p
                        className={cn(
                          'font-semibold',
                          vgSummary.allApproved ? 'text-green-600' : 'text-yellow-600'
                        )}
                      >
                        {vgSummary.allApproved ? 'Liberado' : 'Pendente'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Per-order risk status */}
              {orderRiskStatuses && orderRiskStatuses.length > 0 && (
                <div className="rounded-lg border overflow-hidden mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OS</TableHead>
                        <TableHead>Criticidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Custo risco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderRiskStatuses.map((s) => (
                        <TableRow key={s.order_id}>
                          <TableCell className="font-mono">
                            {s.os_number ?? s.order_id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            {s.criticality ? (
                              <Badge
                                variant={
                                  CRITICALITY_CONFIG[s.criticality]?.badgeVariant ?? 'secondary'
                                }
                                className="text-[10px]"
                              >
                                {CRITICALITY_CONFIG[s.criticality]?.label ?? s.criticality}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.risk_status ? (
                              <Badge
                                variant={s.risk_status === 'approved' ? 'default' : 'outline'}
                                className="text-[10px]"
                              >
                                {s.risk_status}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(s.total_risk_cost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* Resumo financeiro */}
          {summary && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
              <h4 className="font-semibold text-foreground">Resumo financeiro</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">
                    Receita {hasRealDetails ? '(real)' : '(prevista)'}
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(hasRealDetails ? receitaRealTotal : summary.receita_bruta)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    {hasRealDetails ? 'Custos diretos (real)' : 'Custos TRIP'}
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(hasRealDetails ? custosDiretosRealTotal : summary.custos_trip)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    {hasRealDetails ? 'Custos previstos' : 'Custos OS'}
                  </p>
                  <p className="font-semibold">{formatCurrency(summary.custos_os)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    Margem {hasRealDetails ? '(real)' : '(prevista)'}
                  </p>
                  <p
                    className={cn(
                      'font-semibold',
                      (hasRealDetails ? margemReal : summary.margem_bruta) >= 0
                        ? 'text-success'
                        : 'text-destructive'
                    )}
                  >
                    {formatCurrency(hasRealDetails ? margemReal : summary.margem_bruta)}
                    {(hasRealDetails ? margemRealPercent : summary.margem_percent) != null && (
                      <span className="text-muted-foreground text-xs ml-1">
                        (
                        {Number(
                          hasRealDetails ? margemRealPercent : summary.margem_percent
                        ).toFixed(2)}
                        %)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Previsto vs Real por OS */}
          {financialDetails && financialDetails.length > 0 && (
            <div>
              <h4 className="font-semibold text-foreground mb-2">Previsto vs Real por OS</h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Pedágio</TableHead>
                      <TableHead className="text-right">Descarga</TableHead>
                      <TableHead className="text-right">Carreteiro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialDetails.map((row) => (
                      <TableRow key={row.order_id}>
                        <TableCell className="font-mono">{row.os_number ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.receita_real)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">
                            {formatCurrency(row.pedagio_previsto)}
                          </span>
                          {row.pedagio_real > 0 && (
                            <span className="ml-1 font-medium">
                              / {formatCurrency(row.pedagio_real)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">
                            {formatCurrency(row.descarga_previsto)}
                          </span>
                          {row.descarga_real > 0 && (
                            <span className="ml-1 font-medium">
                              / {formatCurrency(row.descarga_real)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">
                            {formatCurrency(row.carreteiro_previsto)}
                          </span>
                          {row.carreteiro_real > 0 && (
                            <span className="ml-1 font-medium">
                              / {formatCurrency(row.carreteiro_real)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Formato: previsto / real</p>
            </div>
          )}

          {/* Conciliação PAG */}
          {reconciliation && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <h4 className="font-semibold text-foreground mb-2">Conciliação</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Esperado</p>
                  <p className="font-semibold">{formatCurrency(reconciliation.expected_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pago</p>
                  <p className="font-semibold">{formatCurrency(reconciliation.paid_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Delta</p>
                  <p
                    className={cn(
                      'font-semibold',
                      Math.abs(reconciliation.delta_amount) <= 1
                        ? 'text-success'
                        : 'text-destructive'
                    )}
                  >
                    {formatCurrency(reconciliation.delta_amount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Custos TRIP (rateados) */}
          {(tripCosts.length > 0 || (financialDetails && financialDetails.length > 0)) && (
            <div>
              <h4 className="font-semibold text-foreground mb-2">Custos da viagem (rateados)</h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tripCosts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{CATEGORY_LABELS[c.category] ?? c.category}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(c.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {financialDetails && financialDetails.length > 0 && (
                      <TableRow>
                        <TableCell>Carreteiro (real)</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(
                            financialDetails.reduce((acc, r) => acc + (r.carreteiro_real ?? 0), 0)
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Resumo de rateio */}
          {tripOrders && tripOrders.length > 0 && summary && (
            <div>
              <h4 className="font-semibold text-foreground mb-2">Rateio por receita</h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Fator</TableHead>
                      <TableHead className="text-right">Custos TRIP rateado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tripOrders.map((to) => {
                      const factor = Number(to.apportion_factor);
                      const orderValue = to.order?.value ?? 0;
                      const rateado = summary.receita_bruta > 0 ? summary.custos_trip * factor : 0;
                      return (
                        <TableRow key={to.id}>
                          <TableCell className="font-mono">
                            {to.order?.os_number ?? to.order_id?.slice(0, 8) ?? '—'}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(orderValue)}</TableCell>
                          <TableCell className="text-right">{(factor * 100).toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(rateado)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* CRUD de OS vinculadas à viagem */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground">Ordens de Serviço da viagem</h4>
              <Button size="sm" className="gap-2" onClick={() => setShowAddOsDialog(true)}>
                <Plus className="w-4 h-4" />
                Adicionar OS
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Gerencie quais OS estão vinculadas a esta viagem. Adicionar ou remover aqui atualiza o
              rateio e os resumos financeiros automaticamente.
            </p>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OS</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Fator rateio</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tripOrders && tripOrders.length > 0 ? (
                    tripOrders.map((to) => (
                      <TableRow key={to.id}>
                        <TableCell className="font-mono">
                          {to.order?.os_number ?? to.order_id?.slice(0, 8) ?? '—'}
                        </TableCell>
                        <TableCell className="truncate max-w-[180px] text-xs text-muted-foreground">
                          {to.order?.id ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(to.order?.value ?? 0))}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {(Number(to.apportion_factor ?? 0) * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            disabled={removeOrderMutation.isPending}
                            onClick={() => {
                              if (!tripId || !to.order_id) return;
                              if (
                                !window.confirm(
                                  'Remover esta OS da viagem? O rateio e os custos serão atualizados.'
                                )
                              ) {
                                return;
                              }
                              removeOrderMutation.mutate({
                                tripOrderId: to.id,
                                tripId,
                                orderId: to.order_id,
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-xs text-muted-foreground text-center">
                        Nenhuma OS vinculada a esta viagem ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Custos por OS (pivot: OS=linhas, Categoria=colunas) */}
          {tripOrders && tripOrders.length > 0 && (
            <div>
              <h4 className="font-semibold text-foreground mb-2">Custos por OS</h4>
              <div className="rounded-lg border overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
                      <TableHead className="text-right">DAS</TableHead>
                      <TableHead className="text-right">Descarga</TableHead>
                      <TableHead className="text-right">GRIS</TableHead>
                      <TableHead className="text-right">TSO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const pivot = new Map<string, Record<string, number>>();
                      for (const c of osCosts) {
                        const oid = c.order_id ?? '';
                        if (!oid) continue;
                        if (!pivot.has(oid)) pivot.set(oid, {});
                        const row = pivot.get(oid)!;
                        const cat = (c.category ?? '').toLowerCase();
                        row[cat] = Number(c.amount);
                      }
                      return tripOrders.map((to) => {
                        const oid = to.order_id ?? '';
                        const row = pivot.get(oid) ?? {};
                        return (
                          <TableRow key={to.id}>
                            <TableCell className="font-mono">
                              {to.order?.os_number ?? oid.slice(0, 8) ?? '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPivotCell(row['das'])}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPivotCell(row['descarga'])}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPivotCell(row['gris'])}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPivotCell(row['tso'])}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Valor numérico → R$ X,XX; sem valor → —
              </p>
            </div>
          )}
        </div>

        {/* Dialog interno para adicionar OS à viagem */}
        <InlineDialog open={showAddOsDialog} onOpenChange={setShowAddOsDialog}>
          <InlineDialogContent className="sm:max-w-[700px]">
            <InlineDialogHeader>
              <InlineDialogTitle>Adicionar OS à viagem</InlineDialogTitle>
              <InlineDialogDescription className="sr-only">
                Busque ordens de serviço elegíveis para vincular à viagem atual.
              </InlineDialogDescription>
            </InlineDialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">
                    Buscar OS (mínimo 3 caracteres)
                  </label>
                  <Input
                    placeholder="OS-2026-03-0001"
                    value={osSearch}
                    onChange={(e) => setOsSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isSearchingOs ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-xs text-muted-foreground py-4">
                          Buscando OS...
                        </TableCell>
                      </TableRow>
                    ) : osSearchResults && osSearchResults.length > 0 ? (
                      osSearchResults.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono">{o.os_number ?? o.id}</TableCell>
                          <TableCell className="truncate max-w-[200px] text-xs text-muted-foreground">
                            {o.client_name ?? '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(o.value ?? 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={addOrderMutation.isPending || !tripId}
                              onClick={() => {
                                if (!tripId) return;
                                addOrderMutation.mutate({ orderId: o.id, tripId });
                              }}
                            >
                              Vincular
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-xs text-muted-foreground py-4">
                          Nenhuma OS encontrada. Digite ao menos 3 caracteres do número da OS.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </InlineDialogContent>
        </InlineDialog>
      </DialogContent>
    </Dialog>
  );
}
