import { Truck, DollarSign, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { useTrip, useTripCostItems, useTripOrdersWithOrders } from '@/hooks/useTrips';
import { useTripReconciliation } from '@/hooks/useReconciliation';
import { useTripFinancialSummary } from '@/hooks/useTripFinancialSummary';
import { useTripFinancialDetails } from '@/hooks/useTripFinancialDetails';
import { cn } from '@/lib/utils';

interface TripDetailModalProps {
  open: boolean;
  onClose: () => void;
  tripId: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 font-mono text-lg">
              <Truck className="w-5 h-5 text-muted-foreground" />
              {trip.trip_number}
            </span>
            <Badge variant="secondary">{trip.status_operational}</Badge>
            {reconciliation?.trip_reconciled && <Badge variant="success">Conciliado</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
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
      </DialogContent>
    </Dialog>
  );
}
