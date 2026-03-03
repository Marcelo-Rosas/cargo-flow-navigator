import { Wrench, Package } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

type EquipmentItem = {
  id: string;
  name: string;
  code: string;
  selected?: boolean;
  quantity: number;
  unitValue: number;
  total: number;
  description?: string;
};
type UnloadingItem = {
  id: string;
  name: string;
  code: string;
  quantity: number;
  unitValue: number;
  total: number;
};

interface QuoteModalEquipmentItemsTabProps {
  breakdown: StoredPricingBreakdown | null;
}

export function QuoteModalEquipmentItemsTab({ breakdown }: QuoteModalEquipmentItemsTabProps) {
  const meta = breakdown?.meta as
    | { equipmentRental?: EquipmentItem[]; unloadingCost?: UnloadingItem[] }
    | undefined;
  const equipmentRental = meta?.equipmentRental ?? [];
  const unloadingCost = meta?.unloadingCost ?? [];

  const equipmentItems = Array.isArray(equipmentRental)
    ? equipmentRental.filter((i) => i.selected !== false && (i.quantity ?? 0) > 0)
    : [];
  const unloadingItems = Array.isArray(unloadingCost)
    ? unloadingCost.filter((i) => (i.quantity ?? 0) > 0)
    : [];

  const hasEquipment = equipmentItems.length > 0;
  const hasUnloading = unloadingItems.length > 0;

  if (!hasEquipment && !hasUnloading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhum item de equipamento ou carga/descarga.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasEquipment && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Aluguel de Equipamentos
          </h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center w-20">Qtd</TableHead>
                  <TableHead className="text-right">Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipmentItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatCurrency(item.unitValue)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(item.total)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.description || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {hasUnloading && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Carga e Descarga
          </h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center w-20">Qtd</TableHead>
                  <TableHead className="text-right">Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unloadingItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatCurrency(item.unitValue)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(item.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
