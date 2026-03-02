import { Truck } from 'lucide-react';

interface KanbanTripChipProps {
  tripId?: string | null;
  tripNumber?: string | null;
}

export function KanbanTripChip({ tripId, tripNumber }: KanbanTripChipProps) {
  if (!tripId && !tripNumber) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
        <Truck className="w-3 h-3" />
        {tripNumber ?? 'Trip'}
      </span>
    </div>
  );
}
