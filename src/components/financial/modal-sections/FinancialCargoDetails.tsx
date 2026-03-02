import { Package, Scale, Box } from 'lucide-react';

interface FinancialCargoDetailsProps {
  cargoType?: string | null;
  weight?: number | null;
  volume?: number | null;
}

export function FinancialCargoDetails({ cargoType, weight, volume }: FinancialCargoDetailsProps) {
  const hasCargo = cargoType || weight != null || volume != null;
  if (!hasCargo) return null;

  return (
    <div>
      <h4 className="font-semibold text-foreground text-sm mb-2">Dados da Carga</h4>
      <div className="grid grid-cols-3 gap-2">
        {cargoType && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <Package className="w-3.5 h-3.5" />
              <span className="text-[10px]">Tipo</span>
            </div>
            <p className="font-medium text-xs">{cargoType}</p>
          </div>
        )}
        {weight != null && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <Scale className="w-3.5 h-3.5" />
              <span className="text-[10px]">Peso</span>
            </div>
            <p className="font-medium text-xs">
              {Number(weight) >= 1000
                ? `${(Number(weight) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`
                : `${Number(weight).toLocaleString('pt-BR')} kg`}
            </p>
          </div>
        )}
        {volume != null && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <Box className="w-3.5 h-3.5" />
              <span className="text-[10px]">Volume</span>
            </div>
            <p className="font-medium text-xs">{Number(volume).toLocaleString('pt-BR')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
