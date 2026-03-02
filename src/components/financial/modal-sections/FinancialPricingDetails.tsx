import { Truck, CreditCard, Route, Landmark } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface FinancialPricingDetailsProps {
  vehicleTypeName?: string | null;
  vehicleTypeCode?: string | null;
  paymentTermName?: string | null;
  kmDistance?: number | null;
  tollValue?: number;
}

export function FinancialPricingDetails({
  vehicleTypeName,
  vehicleTypeCode,
  paymentTermName,
  kmDistance,
  tollValue = 0,
}: FinancialPricingDetailsProps) {
  const hasPricing = vehicleTypeName || paymentTermName || kmDistance != null || tollValue > 0;
  if (!hasPricing) return null;

  return (
    <div>
      <h4 className="font-semibold text-foreground text-sm mb-2">Detalhes de Precificação</h4>
      <div className="grid grid-cols-2 gap-2">
        {vehicleTypeName && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <Truck className="w-3.5 h-3.5" />
              <span className="text-[10px]">Veículo</span>
            </div>
            <p className="font-medium text-xs">
              {vehicleTypeName}
              {vehicleTypeCode && (
                <span className="text-muted-foreground"> ({vehicleTypeCode})</span>
              )}
            </p>
          </div>
        )}
        {paymentTermName && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="text-[10px]">Prazo Pagamento</span>
            </div>
            <p className="font-medium text-xs">{paymentTermName}</p>
          </div>
        )}
        {kmDistance != null && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <Route className="w-3.5 h-3.5" />
              <span className="text-[10px]">Distância</span>
            </div>
            <p className="font-medium text-xs">{Number(kmDistance).toLocaleString('pt-BR')} km</p>
          </div>
        )}
        {tollValue > 0 && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <Landmark className="w-3.5 h-3.5" />
              <span className="text-[10px]">Pedágio</span>
            </div>
            <p className="font-medium text-xs">{formatCurrency(tollValue)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
