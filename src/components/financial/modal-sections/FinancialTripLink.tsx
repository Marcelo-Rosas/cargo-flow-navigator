import { Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FinancialTripLinkProps {
  currentTripNumber?: string | null;
  linkableTrips: Array<{
    id: string;
    trip_number?: string | null;
    driver?: { name?: string | null } | null;
  }>;
  selectedTripId: string;
  onSelectedChange: (id: string) => void;
  onLink: () => void;
  isPending: boolean;
}

export function FinancialTripLink({
  currentTripNumber,
  linkableTrips,
  selectedTripId,
  onSelectedChange,
  onLink,
  isPending,
}: FinancialTripLinkProps) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
      <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
        <Link2 className="w-4 h-4" />
        Vincular à Trip
      </h4>
      {currentTripNumber && (
        <p className="text-xs text-muted-foreground">
          Trip atual: <span className="font-mono font-medium">{currentTripNumber}</span>
        </p>
      )}
      <div className="flex gap-2">
        <Select value={selectedTripId} onValueChange={onSelectedChange} disabled={isPending}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecionar Trip (VG-xxx)" />
          </SelectTrigger>
          <SelectContent>
            {linkableTrips.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.trip_number ?? t.id.slice(0, 8)}
                {t.driver?.name && ` — ${t.driver.name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onLink} disabled={!selectedTripId || isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vincular'}
        </Button>
      </div>
    </div>
  );
}
