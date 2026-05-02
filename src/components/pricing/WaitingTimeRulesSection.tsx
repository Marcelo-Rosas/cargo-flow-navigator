import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useWaitingTimeRules } from '@/hooks/usePricingRules';
import { useVehicleTypesOperational } from '@/hooks/useVehicleTypes';
import type { WaitingTimeRule } from '@/types/pricing';
import {
  useCreateWaitingTimeRule,
  useUpdateWaitingTimeRule,
  useDeleteWaitingTimeRule,
} from '@/hooks/usePricingMutations';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type WaitingTimeRuleWithVehicle = {
  id: string;
  vehicle_type_id: string | null;
  context: string;
  free_hours: number;
  rate_per_hour: number | null;
  rate_per_day: number | null;
  min_charge: number | null;
  vehicle_types: { code: string; name: string } | null;
};

const CONTEXT_LABELS: Record<string, string> = {
  loading: 'Carregamento',
  unloading: 'Descarregamento',
  both: 'Ambos',
};

export function WaitingTimeRulesSection() {
  const { data: rules, isLoading } = useWaitingTimeRules();
  const { data: vehicleTypes } = useVehicleTypesOperational();
  const createMutation = useCreateWaitingTimeRule();
  const updateMutation = useUpdateWaitingTimeRule();
  const deleteMutation = useDeleteWaitingTimeRule();

  const [editingRule, setEditingRule] = useState<WaitingTimeRuleWithVehicle | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (
    data: Omit<WaitingTimeRule, 'id' | 'created_at' | 'updated_at' | 'created_by'>
  ) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Regra de estadia criada');
      setIsCreateOpen(false);
    } catch (error) {
      toast.error('Erro ao criar regra');
    }
  };

  const handleUpdate = async (id: string, data: Partial<WaitingTimeRule>) => {
    try {
      await updateMutation.mutateAsync({ id, updates: data });
      toast.success('Regra atualizada');
      setEditingRule(null);
    } catch (error) {
      toast.error('Erro ao atualizar regra');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Regra excluída');
    } catch (error) {
      toast.error('Erro ao excluir regra');
    }
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
          Nova Regra
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Veículo</TableHead>
            <TableHead>Contexto</TableHead>
            <TableHead>Franquia (h)</TableHead>
            <TableHead>R$/Hora</TableHead>
            <TableHead>R$/Diária</TableHead>
            <TableHead>Mínimo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rules as WaitingTimeRuleWithVehicle[] | undefined)?.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                {rule.vehicle_types ? (
                  <Badge variant="outline">{rule.vehicle_types.code}</Badge>
                ) : (
                  <Badge variant="secondary">Padrão</Badge>
                )}
              </TableCell>
              <TableCell>{CONTEXT_LABELS[rule.context] || rule.context}</TableCell>
              <TableCell>{rule.free_hours}h</TableCell>
              <TableCell>
                {rule.rate_per_hour
                  ? `R$ ${rule.rate_per_hour.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '-'}
              </TableCell>
              <TableCell>
                {rule.rate_per_day
                  ? `R$ ${rule.rate_per_day.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '-'}
              </TableCell>
              <TableCell>
                {rule.min_charge
                  ? `R$ ${rule.min_charge.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '-'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setEditingRule(rule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(rule.id)}
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
      <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent>
          {editingRule && (
            <WaitingTimeForm
              rule={editingRule}
              vehicleTypes={vehicleTypes}
              onSubmit={(data) => handleUpdate(editingRule.id, data)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <WaitingTimeForm
            vehicleTypes={vehicleTypes}
            onSubmit={handleCreate}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WaitingTimeForm({
  rule,
  vehicleTypes,
  onSubmit,
  isLoading,
}: {
  rule?: WaitingTimeRuleWithVehicle;
  vehicleTypes?: { id: string; code: string; name: string }[];
  onSubmit: (
    data:
      | Omit<WaitingTimeRule, 'id' | 'created_at' | 'updated_at' | 'created_by'>
      | Partial<WaitingTimeRule>
  ) => void;
  isLoading: boolean;
}) {
  const [vehicleTypeId, setVehicleTypeId] = useState<string>(rule?.vehicle_type_id || '');
  const [context, setContext] = useState(rule?.context || 'both');
  const [freeHours, setFreeHours] = useState(rule?.free_hours?.toString() || '6');
  const [ratePerHour, setRatePerHour] = useState(rule?.rate_per_hour?.toString() || '');
  const [ratePerDay, setRatePerDay] = useState(rule?.rate_per_day?.toString() || '');
  const [minCharge, setMinCharge] = useState(rule?.min_charge?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      vehicle_type_id: vehicleTypeId || null,
      context: context as 'loading' | 'unloading' | 'both',
      free_hours: parseFloat(freeHours) || 6,
      rate_per_hour: ratePerHour ? parseFloat(ratePerHour) : null,
      rate_per_day: ratePerDay ? parseFloat(ratePerDay) : null,
      min_charge: minCharge ? parseFloat(minCharge) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{rule ? 'Editar Regra de Estadia' : 'Nova Regra de Estadia'}</DialogTitle>
        <DialogDescription>Configure a franquia e valores de hora parada</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Veículo</Label>
            <Select
              value={vehicleTypeId || '__none__'}
              onValueChange={(v) => setVehicleTypeId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Padrão (todos)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Padrão (todos)</SelectItem>
                {vehicleTypes?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.code} - {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Contexto</Label>
            <Select value={context} onValueChange={setContext}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loading">Carregamento</SelectItem>
                <SelectItem value="unloading">Descarregamento</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Franquia (horas)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={freeHours}
              onChange={(e) => setFreeHours(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cobrança Mínima (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={minCharge}
              onChange={(e) => setMinCharge(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Valor por Hora (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={ratePerHour}
              onChange={(e) => setRatePerHour(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Valor Diária (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={ratePerDay}
              onChange={(e) => setRatePerDay(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {rule ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
