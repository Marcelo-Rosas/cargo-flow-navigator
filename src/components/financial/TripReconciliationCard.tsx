import { Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TripPaymentReconciliation } from '@/hooks/useReconciliation';

interface TripReconciliationCardProps {
  trip: TripPaymentReconciliation;
  onClick?: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function TripReconciliationCard({ trip, onClick }: TripReconciliationCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card rounded-lg border shadow-sm p-4 cursor-pointer',
        'hover:shadow-md hover:border-primary/40 transition-all duration-200'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-mono text-sm font-medium">
              <Truck className="w-4 h-4 text-muted-foreground" />
              {trip.trip_number}
            </span>
            {trip.trip_reconciled ? (
              <Badge variant="outline" className="text-success border-success/50 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-0.5" />
                OK
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-warning-foreground border-warning/50 text-xs"
              >
                <AlertCircle className="w-3 h-3 mr-0.5" />
                Pendente
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {trip.orders_count} OS · {trip.status_operational}
          </p>
          <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
            <div>
              <p className="text-muted-foreground">Esperado</p>
              <p className="font-semibold">{formatCurrency(trip.expected_amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pago</p>
              <p className="font-semibold">{formatCurrency(trip.paid_amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Delta</p>
              <p
                className={cn(
                  'font-semibold',
                  Math.abs(trip.delta_amount) <= 1
                    ? 'text-success'
                    : trip.delta_amount > 0
                      ? 'text-warning-foreground'
                      : 'text-destructive'
                )}
              >
                {formatCurrency(trip.delta_amount)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
