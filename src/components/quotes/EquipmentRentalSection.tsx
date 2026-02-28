import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEquipmentRentalRates } from '@/hooks/useEquipmentRentalRates';
import type { EquipmentRentalRate } from '@/hooks/useEquipmentRentalRates';

export interface EquipmentRentalItem {
  id: string;
  name: string;
  code: string;
  selected: boolean;
  quantity: number;
  unitValue: number;
  total: number;
}

interface EquipmentRentalSectionProps {
  value: number;
  onChange: (total: number, items: EquipmentRentalItem[]) => void;
  initialItems?: EquipmentRentalItem[];
  readOnly?: boolean;
}

export function EquipmentRentalSection({
  value,
  onChange,
  initialItems = [],
  readOnly = false,
}: EquipmentRentalSectionProps) {
  const { data: rates, isLoading } = useEquipmentRentalRates(true);

  const [selectionByRate, setSelectionByRate] = useState<
    Map<string, { selected: boolean; quantity: number }>
  >(new Map());

  useEffect(() => {
    if (initialItems.length > 0) {
      const map = new Map<string, { selected: boolean; quantity: number }>();
      for (const item of initialItems) {
        if (item.selected && item.quantity > 0) {
          map.set(item.id, { selected: true, quantity: item.quantity });
        }
      }
      setSelectionByRate(map);
    }
  }, [initialItems]);

  const handleChange = (rate: EquipmentRentalRate, selected: boolean, quantity: number) => {
    if (!rates) return;
    setSelectionByRate((prev) => {
      const next = new Map(prev);
      if (selected && quantity > 0) {
        next.set(rate.id, { selected: true, quantity });
      } else {
        next.delete(rate.id);
      }

      const items: EquipmentRentalItem[] = rates.map((r) => {
        const sel = next.get(r.id) ?? { selected: false, quantity: 0 };
        const q = sel.selected ? sel.quantity : 0;
        const total = q * r.value;
        return {
          id: r.id,
          name: r.name,
          code: r.code,
          selected: sel.selected,
          quantity: q,
          unitValue: r.value,
          total,
        };
      });
      const total = items.reduce((s, i) => s + i.total, 0);
      onChange(total, items.filter((i) => i.selected && i.quantity > 0));
      return next;
    });
  };

  const computedTotal = useMemo(() => {
    if (!rates) return 0;
    return rates.reduce((s, r) => {
      const sel = selectionByRate.get(r.id);
      if (!sel?.selected || sel.quantity <= 0) return s;
      return s + sel.quantity * r.value;
    }, 0);
  }, [rates, selectionByRate]);

  if (isLoading || !rates?.length) {
    return (
      <div className="space-y-2">
        <Label>Aluguel de Máquinas</Label>
        <div className="text-sm text-muted-foreground">
          {isLoading ? 'Carregando...' : 'Nenhum item cadastrado na tabela.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Aluguel de Máquinas</Label>
      <div className="rounded-md border divide-y">
        {rates.map((rate) => {
          const sel = selectionByRate.get(rate.id) ?? { selected: false, quantity: 0 };
          const lineTotal = sel.selected && sel.quantity > 0 ? sel.quantity * rate.value : 0;
          return (
            <div
              key={rate.id}
              className="flex items-center gap-3 px-3 py-2 bg-background hover:bg-muted/30"
            >
              <Checkbox
                checked={sel.selected}
                onCheckedChange={(checked) =>
                  handleChange(rate, !!checked, checked ? Math.max(1, sel.quantity) : 0)
                }
                disabled={readOnly}
              />
              <span className="flex-1 text-sm truncate">{rate.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                R$ {rate.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {rate.unit}
              </span>
              <div className="w-20">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={sel.selected ? sel.quantity : ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const q = isNaN(v) ? 0 : Math.max(0, v);
                    handleChange(rate, q > 0, q);
                  }}
                  placeholder="0"
                  disabled={readOnly || !sel.selected}
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
