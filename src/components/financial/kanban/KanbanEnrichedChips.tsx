import { CreditCard, Package, Route, Landmark } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface KanbanEnrichedChipsProps {
  paymentTermName?: string | null;
  cargoType?: string | null;
  kmDistance?: number | null;
  tollValue?: number | null;
}

export function KanbanEnrichedChips({
  paymentTermName,
  cargoType,
  kmDistance,
  tollValue,
}: KanbanEnrichedChipsProps) {
  const hasEnrichedData =
    paymentTermName ||
    cargoType ||
    kmDistance != null ||
    (tollValue != null && Number(tollValue) > 0);

  if (!hasEnrichedData) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      {paymentTermName && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
          <CreditCard className="w-3 h-3" />
          {paymentTermName}
        </span>
      )}
      {cargoType && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
          <Package className="w-3 h-3" />
          {cargoType}
        </span>
      )}
      {kmDistance != null && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
          <Route className="w-3 h-3" />
          {Number(kmDistance).toLocaleString('pt-BR')} km
        </span>
      )}
      {tollValue != null && Number(tollValue) > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
          <Landmark className="w-3 h-3" />
          {formatCurrency(Number(tollValue))}
        </span>
      )}
    </div>
  );
}
