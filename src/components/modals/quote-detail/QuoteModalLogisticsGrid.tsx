import { MapPin, Truck, Scale, Box, Route, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface QuoteModalLogisticsGridProps {
  origin: string;
  originCep?: string | null;
  destination: string;
  destinationCep?: string | null;
  vehicleName?: string | null;
  vehicleCode?: string | null;
  weight?: number | null;
  volume?: number | null;
  kmDistance?: number | null;
  cargoType?: string | null;
  /** Custo efetivo pago ao motorista para indicador R$/KM */
  custoMotorista?: number | null;
  /** Total cobrado do cliente para indicador R$/KM */
  totalCliente?: number | null;
}

export function QuoteModalLogisticsGrid({
  origin,
  originCep,
  destination,
  destinationCep,
  vehicleName,
  vehicleCode,
  weight,
  volume,
  kmDistance,
  cargoType,
  custoMotorista,
  totalCliente,
}: QuoteModalLogisticsGridProps) {
  const weightFormatted =
    weight != null && weight > 0
      ? weight >= 1000
        ? `${(weight / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} t`
        : `${weight.toLocaleString('pt-BR')} kg`
      : null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Rota
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{origin}</p>
                {originCep && (
                  <p className="text-xs text-muted-foreground">
                    CEP: {originCep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                  </p>
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-sm">→</p>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{destination}</p>
                {destinationCep && (
                  <p className="text-xs text-muted-foreground">
                    CEP: {destinationCep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {vehicleName && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Veículo
            </p>
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-muted-foreground" />
              {vehicleName}
              {vehicleCode && <span className="text-muted-foreground">({vehicleCode})</span>}
            </p>
          </div>
        )}
        {(weightFormatted || volume != null) && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Carga
            </p>
            <div className="flex flex-wrap gap-3">
              {cargoType && (
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{cargoType}</span>
                </div>
              )}
              {weightFormatted && (
                <div className="flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{weightFormatted}</span>
                </div>
              )}
              {volume != null && volume > 0 && (
                <div className="flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{volume.toLocaleString('pt-BR')} m³</span>
                </div>
              )}
            </div>
          </div>
        )}
        {kmDistance != null && kmDistance > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Distância
            </p>
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <Route className="w-4 h-4 text-muted-foreground" />
              {Number(kmDistance).toLocaleString('pt-BR')} km
            </p>
          </div>
        )}
      </div>

      {/* Performance R$/KM — Spread como indicador principal */}
      {kmDistance != null &&
        kmDistance > 0 &&
        custoMotorista != null &&
        totalCliente != null &&
        totalCliente > 0 &&
        (() => {
          const spreadPerKm = (totalCliente - custoMotorista) / kmDistance;
          const custoPerKm = custoMotorista / kmDistance;
          const vendaPerKm = totalCliente / kmDistance;
          return (
            <div className="col-span-2 mt-4 space-y-3">
              {/* Spread em destaque — saúde da operação */}
              <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Spread de Operação (Venda — Custo)
                    </p>
                    <p className="text-xl font-bold text-primary tabular-nums">
                      R$ {spreadPerKm.toFixed(2)}/km
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-background">
                    R$/KM
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Custo (pago ao motorista)</p>
                  <p className="text-base font-bold tabular-nums text-destructive">
                    R$ {custoPerKm.toFixed(2)}/km
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Venda (cobrado do cliente)</p>
                  <p className="text-base font-bold tabular-nums text-green-600 dark:text-green-500">
                    R$ {vendaPerKm.toFixed(2)}/km
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
