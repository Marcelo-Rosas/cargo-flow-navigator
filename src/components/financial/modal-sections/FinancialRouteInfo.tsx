// src/components/financial/modal-sections/FinancialRouteInfo.tsx
import { MapPin } from 'lucide-react';

/** Parada intermediária (city_uf ou CEP para exibição) */
export interface RouteStopDisplay {
  city_uf?: string | null;
  cep?: string | null;
}

interface FinancialRouteInfoProps {
  origin?: string | null;
  destination?: string | null;
  originCep?: string | null;
  destinationCep?: string | null;
  /** Paradas intermediárias para rota origem → paradas → destino */
  routeStops?: RouteStopDisplay[];
}

export function FinancialRouteInfo({
  origin,
  destination,
  originCep,
  destinationCep,
  routeStops = [],
}: FinancialRouteInfoProps) {
  if (!origin || !destination) return null;

  const validStops = routeStops.filter((s) => (s.cep ?? '').replace(/\D/g, '').length === 8);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MapPin className="w-4 h-4" />
            <span className="text-xs">Origem</span>
          </div>
          <p className="font-medium text-sm">{origin}</p>
          {originCep && (
            <p className="text-[10px] text-muted-foreground mt-0.5">CEP: {originCep}</p>
          )}
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
      {validStops.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1.5">Rota completa</p>
          <p className="text-sm font-medium">
            {origin}{' '}
            {validStops.map((s, i) => (
              <span key={i} className="text-muted-foreground">
                → {s.city_uf?.trim() || s.cep || '—'}{' '}
              </span>
            ))}
            <span className="text-muted-foreground">→ {destination}</span>
          </p>
        </div>
      )}
    </div>
  );
}
