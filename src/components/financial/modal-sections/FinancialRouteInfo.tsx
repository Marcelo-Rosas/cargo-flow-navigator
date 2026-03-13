// src/components/financial/modal-sections/FinancialRouteInfo.tsx
import { MapPin, ChevronRight } from 'lucide-react';

/** Parada intermediária (city_uf ou CEP para exibição) */
export interface RouteStopDisplay {
  city_uf?: string | null;
  cep?: string | null;
  name?: string | null;
}

interface FinancialRouteInfoProps {
  origin?: string | null;
  destination?: string | null;
  originCep?: string | null;
  destinationCep?: string | null;
  /** Paradas intermediárias para rota origem → paradas → destino */
  routeStops?: RouteStopDisplay[];
}

/** Mini-card de ponto da rota (origem, parada ou destino) */
function RoutePointCard({
  label,
  address,
  cep,
}: {
  label: string;
  address: string;
  cep?: string | null;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border min-w-[140px] flex-1 shrink-0">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <MapPin className="w-4 h-4 shrink-0" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-medium text-sm">{address}</p>
      {cep && cep.replace(/\D/g, '').length === 8 && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          CEP: {cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
        </p>
      )}
    </div>
  );
}

export function FinancialRouteInfo({
  origin,
  destination,
  originCep,
  destinationCep,
  routeStops = [],
}: FinancialRouteInfoProps) {
  if (!origin || !destination) return null;

  const validStops = routeStops.filter((s) => {
    const cep = (s.cep ?? '').replace(/\D/g, '');
    const cityUf = (s.city_uf ?? '').trim();
    const name = (s.name ?? '').trim();
    return cep.length === 8 || cityUf.length > 0 || name.length > 0;
  });

  return (
    <div className="space-y-3">
      {/* Fluxo visual: Origem → Parada(s) → Destino — sem scroll, cards fluem e quebram linha */}
      <div className="flex flex-wrap items-stretch gap-2">
        <RoutePointCard label="Origem" address={origin} cep={originCep} />
        {validStops.map((stop, idx) => (
          <div key={idx} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <RoutePointCard
              label={`Parada ${idx + 1}`}
              address={stop.city_uf?.trim() || stop.name?.trim() || stop.cep || '—'}
              cep={stop.cep}
            />
          </div>
        ))}
        {validStops.length > 0 && (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
        )}
        <RoutePointCard label="Destino" address={destination} cep={destinationCep} />
      </div>
    </div>
  );
}
