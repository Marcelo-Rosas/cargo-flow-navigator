import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerString } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTacRates } from '@/hooks/usePricingRules';
import { useCreateTacRate, useUpdateTacRate, useDeleteTacRate } from '@/hooks/usePricingMutations';
import { Pencil, Plus, Trash2, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TacRate } from '@/types/pricing';

export function TacRatesSection() {
  const { data: rates, isLoading } = useTacRates();
  const createMutation = useCreateTacRate();
  const updateMutation = useUpdateTacRate();
  const deleteMutation = useDeleteTacRate();

  const [editingRate, setEditingRate] = useState<TacRate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (
    data: Omit<TacRate, 'id' | 'created_at' | 'updated_at' | 'created_by'>
  ) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('TAC criado');
      setIsCreateOpen(false);
    } catch (error) {
      toast.error('Erro ao criar TAC');
    }
  };

  const handleUpdate = async (id: string, data: Partial<TacRate>) => {
    try {
      await updateMutation.mutateAsync({ id, updates: data });
      toast.success('TAC atualizado');
      setEditingRate(null);
    } catch (error) {
      toast.error('Erro ao atualizar TAC');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('TAC excluído');
    } catch (error) {
      toast.error('Erro ao excluir TAC');
    }
  };

  const getVariationIcon = (variation: number) => {
    if (variation > 0) return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (variation < 0) return <TrendingDown className="h-4 w-4 text-primary" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo TAC
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data Referência</TableHead>
            <TableHead>Diesel Base</TableHead>
            <TableHead>Diesel Atual</TableHead>
            <TableHead>Variação</TableHead>
            <TableHead>Ajuste</TableHead>
            <TableHead>Fonte</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates?.map((rate, index) => (
            <TableRow key={rate.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {format(new Date(rate.reference_date), 'dd/MM/yyyy', { locale: ptBR })}
                  {index === 0 && <Badge variant="default">Vigente</Badge>}
                </div>
              </TableCell>
              <TableCell>
                R${' '}
                {rate.diesel_price_base.toLocaleString('pt-BR', {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}
              </TableCell>
              <TableCell>
                R${' '}
                {rate.diesel_price_current.toLocaleString('pt-BR', {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {getVariationIcon(rate.variation_percent)}
                  <span
                    className={
                      rate.variation_percent > 0
                        ? 'text-destructive'
                        : rate.variation_percent < 0
                          ? 'text-primary'
                          : ''
                    }
                  >
                    {rate.variation_percent?.toFixed(2)}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={rate.adjustment_percent > 0 ? 'destructive' : 'secondary'}>
                  {rate.adjustment_percent > 0 ? '+' : ''}
                  {rate.adjustment_percent.toFixed(2)}%
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {rate.source_description || '-'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setEditingRate(rate)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(rate.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <Dialog open={!!editingRate} onOpenChange={(open) => !open && setEditingRate(null)}>
        <DialogContent>
          {editingRate && (
            <TacRateForm
              rate={editingRate}
              onSubmit={(data) => handleUpdate(editingRate.id, data)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <TacRateForm onSubmit={handleCreate} isLoading={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TacRateForm({
  rate,
  onSubmit,
  isLoading,
}: {
  rate?: TacRate;
  onSubmit: (
    data: Omit<TacRate, 'id' | 'created_at' | 'updated_at' | 'created_by'> | Partial<TacRate>
  ) => void;
  isLoading: boolean;
}) {
  const [referenceDate, setReferenceDate] = useState(
    rate?.reference_date || new Date().toISOString().split('T')[0]
  );
  const [dieselPriceBase, setDieselPriceBase] = useState(rate?.diesel_price_base?.toString() || '');
  const [dieselPriceCurrent, setDieselPriceCurrent] = useState(
    rate?.diesel_price_current?.toString() || ''
  );
  const [adjustmentPercent, setAdjustmentPercent] = useState(
    rate?.adjustment_percent?.toString() || ''
  );
  const [sourceDescription, setSourceDescription] = useState(rate?.source_description || '');

  const calculatedVariation =
    dieselPriceBase && dieselPriceCurrent
      ? ((parseFloat(dieselPriceCurrent) - parseFloat(dieselPriceBase)) /
          parseFloat(dieselPriceBase)) *
        100
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dieselPriceBase || !dieselPriceCurrent || !adjustmentPercent) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    onSubmit({
      reference_date: referenceDate,
      diesel_price_base: parseFloat(dieselPriceBase),
      diesel_price_current: parseFloat(dieselPriceCurrent),
      adjustment_percent: parseFloat(adjustmentPercent),
      source_description: sourceDescription || null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{rate ? 'Editar TAC' : 'Novo TAC'}</DialogTitle>
        <DialogDescription>
          Taxa de Ajuste do Combustível baseada na variação do diesel
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Data de Referência</Label>
          <DatePickerString value={referenceDate} onChange={(val) => setReferenceDate(val)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Diesel Base (R$/L)</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={dieselPriceBase}
              onChange={(e) => setDieselPriceBase(e.target.value)}
              placeholder="5.500"
            />
          </div>
          <div className="space-y-2">
            <Label>Diesel Atual (R$/L)</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={dieselPriceCurrent}
              onChange={(e) => setDieselPriceCurrent(e.target.value)}
              placeholder="5.800"
            />
          </div>
        </div>
        {dieselPriceBase && dieselPriceCurrent && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Variação calculada:{' '}
              <span
                className={
                  calculatedVariation > 0
                    ? 'text-destructive font-medium'
                    : 'text-primary font-medium'
                }
              >
                {calculatedVariation > 0 ? '+' : ''}
                {calculatedVariation.toFixed(2)}%
              </span>
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label>Ajuste a Aplicar (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={adjustmentPercent}
            onChange={(e) => setAdjustmentPercent(e.target.value)}
            placeholder="2.50"
          />
        </div>
        <div className="space-y-2">
          <Label>Fonte</Label>
          <Input
            value={sourceDescription}
            onChange={(e) => setSourceDescription(e.target.value)}
            placeholder="ANP Semanal, NTC, etc."
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {rate ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
