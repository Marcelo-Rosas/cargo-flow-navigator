import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useConditionalFees } from '@/hooks/usePricingRules';
import { useCreateConditionalFee, useUpdateConditionalFee, useDeleteConditionalFee } from '@/hooks/usePricingMutations';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ConditionalFee } from '@/types/pricing';

const FEE_TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentual',
  fixed: 'Fixo',
  per_kg: 'Por kg',
};

const APPLIES_TO_LABELS: Record<string, string> = {
  freight: 'Frete',
  cargo_value: 'Valor Mercadoria',
  total: 'Total',
};

export function ConditionalFeesSection() {
  const { data: fees, isLoading } = useConditionalFees(false);
  const createMutation = useCreateConditionalFee();
  const updateMutation = useUpdateConditionalFee();
  const deleteMutation = useDeleteConditionalFee();
  
  const [editingFee, setEditingFee] = useState<ConditionalFee | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Taxa condicional criada');
      setIsCreateOpen(false);
    } catch (error) {
      toast.error('Erro ao criar taxa');
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    try {
      await updateMutation.mutateAsync({ id, updates: data });
      toast.success('Taxa atualizada');
      setEditingFee(null);
    } catch (error) {
      toast.error('Erro ao atualizar taxa');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Taxa excluída');
    } catch (error) {
      toast.error('Erro ao excluir taxa');
    }
  };

  const handleToggleActive = async (fee: ConditionalFee) => {
    await handleUpdate(fee.id, { active: !fee.active });
  };

  const formatFeeValue = (fee: ConditionalFee) => {
    if (fee.fee_type === 'percentage') return `${fee.fee_value}%`;
    if (fee.fee_type === 'fixed') return `R$ ${fee.fee_value.toFixed(2)}`;
    return `R$ ${fee.fee_value.toFixed(2)}/kg`;
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
          Nova Taxa
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Aplica-se a</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fees?.map((fee) => (
            <TableRow key={fee.id}>
              <TableCell className="font-mono text-sm">{fee.code}</TableCell>
              <TableCell className="font-medium">{fee.name}</TableCell>
              <TableCell>{FEE_TYPE_LABELS[fee.fee_type]}</TableCell>
              <TableCell>{formatFeeValue(fee)}</TableCell>
              <TableCell>{APPLIES_TO_LABELS[fee.applies_to]}</TableCell>
              <TableCell>
                <Badge variant={fee.active ? 'default' : 'outline'}>
                  {fee.active ? 'Ativa' : 'Inativa'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Switch
                    checked={fee.active}
                    onCheckedChange={() => handleToggleActive(fee)}
                    disabled={updateMutation.isPending}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingFee(fee)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(fee.id)}
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
      <Dialog open={!!editingFee} onOpenChange={(open) => !open && setEditingFee(null)}>
        <DialogContent>
          {editingFee && (
            <ConditionalFeeForm
              fee={editingFee}
              onSubmit={(data) => handleUpdate(editingFee.id, data)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <ConditionalFeeForm
            onSubmit={handleCreate}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConditionalFeeForm({
  fee,
  onSubmit,
  isLoading,
}: {
  fee?: ConditionalFee;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [code, setCode] = useState(fee?.code || '');
  const [name, setName] = useState(fee?.name || '');
  const [description, setDescription] = useState(fee?.description || '');
  const [feeType, setFeeType] = useState<string>(fee?.fee_type || 'percentage');
  const [feeValue, setFeeValue] = useState(fee?.fee_value?.toString() || '');
  const [minValue, setMinValue] = useState(fee?.min_value?.toString() || '');
  const [maxValue, setMaxValue] = useState(fee?.max_value?.toString() || '');
  const [appliesTo, setAppliesTo] = useState<string>(fee?.applies_to || 'freight');
  const [active, setActive] = useState(fee?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error('Código e nome são obrigatórios');
      return;
    }
    if (!feeValue || parseFloat(feeValue) <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }
    onSubmit({
      code,
      name,
      description: description || null,
      fee_type: feeType,
      fee_value: parseFloat(feeValue),
      min_value: minValue ? parseFloat(minValue) : null,
      max_value: maxValue ? parseFloat(maxValue) : null,
      applies_to: appliesTo,
      active,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{fee ? 'Editar Taxa Condicional' : 'Nova Taxa Condicional'}</DialogTitle>
        <DialogDescription>
          Configure taxas que são aplicadas condicionalmente ao frete
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Código</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TDE"
              disabled={!!fee}
            />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Taxa Dificuldade Entrega"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição da taxa"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={feeType} onValueChange={setFeeType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentual</SelectItem>
                <SelectItem value="fixed">Fixo</SelectItem>
                <SelectItem value="per_kg">Por kg</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={feeValue}
              onChange={(e) => setFeeValue(e.target.value)}
              placeholder={feeType === 'percentage' ? '10' : '50.00'}
            />
          </div>
          <div className="space-y-2">
            <Label>Aplica-se a</Label>
            <Select value={appliesTo} onValueChange={setAppliesTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="freight">Frete</SelectItem>
                <SelectItem value="cargo_value">Valor Mercadoria</SelectItem>
                <SelectItem value="total">Total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Valor Mínimo (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-2">
            <Label>Valor Máximo (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Ativa</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {fee ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
