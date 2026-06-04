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
  /** Custos diretos (motorista + pedágio + seguros + …) para R$/km realista */
  custosDiretos?: number | null;
  /** Resultado líquido (margem operacional) */
  resultadoLiquido?: number | null;
  /** Piso ANTT total de referência */
  pisoAntt?: number | null;
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
  custosDiretos,
  resultadoLiquido,
  pisoAntt,
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

      {/* Performance R$/KM — margem líquida (não confundir com venda − só motorista) */}
      {kmDistance != null &&
        kmDistance > 0 &&
        totalCliente != null &&
        totalCliente > 0 &&
        (() => {
          const vendaPerKm = totalCliente / kmDistance;
          const margemPerKm =
            resultadoLiquido != null && resultadoLiquido > 0 ? resultadoLiquido / kmDistance : null;
          const custosPerKm =
            custosDiretos != null && custosDiretos > 0
              ? custosDiretos / kmDistance
              : custoMotorista != null
                ? custoMotorista / kmDistance
                : null;
          const pisoPerKm = pisoAntt != null && pisoAntt > 0 ? pisoAntt / kmDistance : null;
          return (
            <div className="col-span-2 mt-4 space-y-3">
              {margemPerKm != null && (
                <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-4">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                    Margem líquida / km
                  </p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    R${' '}
                    {margemPerKm.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    /km
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {custosDiretos != null ? 'Custos diretos/km' : 'Motorista/km'}
                  </p>
                  <p className="text-base font-bold tabular-nums text-destructive">
                    R${' '}
                    {(custosPerKm ?? 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    /km
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Venda (cobrado do cliente)</p>
                  <p className="text-base font-bold tabular-nums text-green-600 dark:text-green-500">
                    R${' '}
                    {vendaPerKm.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    /km
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
