import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUnloadingCostRates } from '@/hooks/useUnloadingCostRates';
import type { UnloadingCostRate } from '@/hooks/useUnloadingCostRates';

export interface UnloadingCostItem {
  id: string;
  name: string;
  code: string;
  quantity: number;
  unitValue: number;
  total: number;
}

interface UnloadingCostSectionProps {
  value: number;
  onChange: (total: number, items: UnloadingCostItem[]) => void;
  initialItems?: UnloadingCostItem[];
  readOnly?: boolean;
}

export function UnloadingCostSection({
  value,
  onChange,
  initialItems = [],
  readOnly = false,
}: UnloadingCostSectionProps) {
  const { data: rates, isLoading } = useUnloadingCostRates(true);

  const [quantitiesByRate, setQuantitiesByRate] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (initialItems.length > 0) {
      const map = new Map<string, number>();
      for (const item of initialItems) {
        if (item.quantity > 0) map.set(item.id, item.quantity);
      }
      setQuantitiesByRate(map);
    }
  }, [initialItems]);

  const handleQuantityChange = (rate: UnloadingCostRate, qty: number) => {
    if (!rates) return;
    setQuantitiesByRate((prev) => {
      const next = new Map(prev);
      if (qty > 0) next.set(rate.id, qty);
      else next.delete(rate.id);

      const items: UnloadingCostItem[] = rates.map((r) => {
        const q = next.get(r.id) ?? 0;
        const total = q * r.value;
        return {
          id: r.id,
          name: r.name,
          code: r.code,
          quantity: q,
          unitValue: r.value,
          total,
        };
      });
      const total = items.reduce((s, i) => s + i.total, 0);
      onChange(total, items.filter((i) => i.quantity > 0));
      return next;
    });
  };

  const computedTotal = useMemo(() => {
    if (!rates) return 0;
    return rates.reduce((s, r) => {
      const q = quantitiesByRate.get(r.id) ?? 0;
      return s + q * r.value;
    }, 0);
  }, [rates, quantitiesByRate]);

  if (isLoading || !rates?.length) {
    return (
      <div className="space-y-2">
        <Label>Carga e Descarga</Label>
        <div className="text-sm text-muted-foreground">
          {isLoading ? 'Carregando...' : 'Nenhum item cadastrado na tabela.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Carga e Descarga</Label>
      <div className="rounded-md border divide-y">
        {rates.map((rate) => {
          const qty = quantitiesByRate.get(rate.id) ?? 0;
          const lineTotal = qty * rate.value;
          return (
            <div
              key={rate.id}
              className="flex items-center gap-3 px-3 py-2 bg-background hover:bg-muted/30"
            >
              <span className="flex-1 text-sm truncate">{rate.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                R$ {rate.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {rate.unit}
              </span>
              <div className="w-20">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={qty || ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    handleQuantityChange(rate, isNaN(v) ? 0 : Math.max(0, v));
                  }}
                  placeholder="0"
                  disabled={readOnly}
                  className="h-8 text-right"
                />
              </div>
              <span className="w-24 text-right text-sm tabular-nums">
                R$ {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end text-sm font-medium">
        Total: R$ {computedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}
