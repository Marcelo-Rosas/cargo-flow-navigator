import { Landmark, Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface FinancialCostBreakdownProps {
  components?: { toll?: number; gris?: number; tso?: number } | null;
  totals?: { das?: number } | null;
  profitability?: { custosCarreteiro?: number; custosDescarga?: number } | null;
}

export function FinancialCostBreakdown({
  components,
  totals,
  profitability,
}: FinancialCostBreakdownProps) {
  if (!components && !profitability) return null;

  return (
    <div>
      <h4 className="font-semibold text-foreground text-sm mb-3">Custos detalhados</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {components?.toll != null && Number(components.toll) > 0 && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <Landmark className="w-3.5 h-3.5" />
              <span className="text-[10px]">Pedágio</span>
            </div>
            <p className="font-semibold text-sm">{formatCurrency(Number(components.toll))}</p>
          </div>
        )}
        {profitability?.custosCarreteiro != null && Number(profitability.custosCarreteiro) > 0 && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
              <Truck className="w-3.5 h-3.5" />
              <span className="text-[10px]">Carreteiro</span>
            </div>
            <p className="font-semibold text-sm">
              {formatCurrency(Number(profitability.custosCarreteiro))}
            </p>
          </div>
        )}
        {profitability?.custosDescarga != null && Number(profitability.custosDescarga) > 0 && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <span className="text-[10px] text-muted-foreground">Descarga</span>
            <p className="font-semibold text-sm">
              {formatCurrency(Number(profitability.custosDescarga))}
            </p>
          </div>
        )}
        {totals?.das != null && Number(totals.das) > 0 && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <span className="text-[10px] text-muted-foreground">DAS</span>
            <p className="font-semibold text-sm">{formatCurrency(Number(totals.das))}</p>
          </div>
        )}
        {components?.gris != null && Number(components.gris) > 0 && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <span className="text-[10px] text-muted-foreground">GRIS</span>
            <p className="font-semibold text-sm">{formatCurrency(Number(components.gris))}</p>
          </div>
        )}
        {components?.tso != null && Number(components.tso) > 0 && (
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
            <span className="text-[10px] text-muted-foreground">TSO</span>
            <p className="font-semibold text-sm">{formatCurrency(Number(components.tso))}</p>
          </div>
        )}
      </div>
    </div>
  );
}
