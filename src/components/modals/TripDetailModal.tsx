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
            {reconciliation?.trip_reconciled && (
              <Badge variant="outline" className="text-success border-success/50">
                Conciliado
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Resumo financeiro */}
          {summary && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
              <h4 className="font-semibold text-foreground">Resumo financeiro</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Receita</p>
                  <p className="font-semibold">{formatCurrency(summary.receita_bruta)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Custos TRIP</p>
                  <p className="font-semibold">{formatCurrency(summary.custos_trip)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Custos OS</p>
                  <p className="font-semibold">{formatCurrency(summary.custos_os)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Margem</p>
                  <p
                    className={cn(
                      'font-semibold',
                      summary.margem_bruta >= 0 ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {formatCurrency(summary.margem_bruta)}
                    {summary.margem_percent != null && (
                      <span className="text-muted-foreground text-xs ml-1">
                        ({summary.margem_percent}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>
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
          {tripCosts.length > 0 && (
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

          {/* Custos OS (por ordem) */}
          {osCosts.length > 0 && (
            <div>
              <h4 className="font-semibold text-foreground mb-2">Custos por OS</h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {osCosts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{CATEGORY_LABELS[c.category] ?? c.category}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {c.order_id ? c.order_id.slice(0, 8) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(c.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
