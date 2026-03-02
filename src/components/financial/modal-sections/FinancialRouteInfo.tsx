// src/components/financial/modal-sections/FinancialRouteInfo.tsx
import { MapPin } from 'lucide-react';

interface FinancialRouteInfoProps {
  origin?: string | null;
  destination?: string | null;
  originCep?: string | null;
  destinationCep?: string | null;
}

export function FinancialRouteInfo({
  origin,
  destination,
  originCep,
  destinationCep,
}: FinancialRouteInfoProps) {
  if (!origin || !destination) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <MapPin className="w-4 h-4" />
          <span className="text-xs">Origem</span>
        </div>
        <p className="font-medium text-sm">{origin}</p>
        {originCep && <p className="text-[10px] text-muted-foreground mt-0.5">CEP: {originCep}</p>}
      </div>
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <MapPin className="w-4 h-4" />
          <span className="text-xs">Destino</span>
        </div>
        <p className="font-medium text-sm">{destination}</p>
        {destinationCep && (
          <p className="text-[10px] text-muted-foreground mt-0.5">CEP: {destinationCep}</p>
        )}
      </div>
    </div>
  );
}
