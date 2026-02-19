import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { usePaymentTerms } from '@/hooks/usePricingRules';
import {
  useCreatePaymentTerm,
  useUpdatePaymentTerm,
  useDeletePaymentTerm,
} from '@/hooks/usePricingMutations';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type PaymentTerm, PAYMENT_STRUCTURE_OPTIONS, BALANCE_DAYS_OPTIONS } from '@/types/pricing';

export function PaymentTermsSection() {
  const { data: terms, isLoading } = usePaymentTerms(false);
  const createMutation = useCreatePaymentTerm();
  const updateMutation = useUpdatePaymentTerm();
  const deleteMutation = useDeletePaymentTerm();

  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (data: {
    code: string;
    name: string;
    days: number;
    adjustment_percent: number;
    advance_percent?: number | null;
  }) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Prazo de pagamento criado');
      setIsCreateOpen(false);
    } catch (error) {
      toast.error('Erro ao criar prazo');
    }
  };

  const handleUpdate = async (id: string, data: Partial<PaymentTerm>) => {
    try {
      await updateMutation.mutateAsync({ id, updates: data });
      toast.success('Prazo atualizado');
      setEditingTerm(null);
    } catch (error) {
      toast.error('Erro ao atualizar prazo');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Prazo excluído');
    } catch (error) {
      toast.error('Erro ao excluir prazo');
    }
  };

  const handleToggleActive = async (term: PaymentTerm) => {
    await handleUpdate(term.id, { active: !term.active });
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
          Novo Prazo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Condição</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Ajuste (%)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {terms?.map((term) => (
            <TableRow key={term.id}>
              <TableCell className="font-mono text-sm">{term.code}</TableCell>
              <TableCell className="font-medium">{term.name}</TableCell>
              <TableCell>
                {term.advance_percent === 50
                  ? '50/50'
                  : term.advance_percent === 70
                    ? '70/30'
                    : term.days === 0
                      ? 'À vista'
                      : 'Prazo normal'}
              </TableCell>
              <TableCell>{term.days === 0 ? '—' : `${term.days} dias`}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    term.adjustment_percent > 0
                      ? 'destructive'
                      : term.adjustment_percent < 0
                        ? 'default'
                        : 'secondary'
                  }
                >
                  {term.adjustment_percent > 0 ? '+' : ''}
                  {term.adjustment_percent.toFixed(2)}%
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={term.active ? 'default' : 'outline'}>
                  {term.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Switch
                    checked={term.active}
                    onCheckedChange={() => handleToggleActive(term)}
                    disabled={updateMutation.isPending}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setEditingTerm(term)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(term.id)}
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
      <Dialog open={!!editingTerm} onOpenChange={(open) => !open && setEditingTerm(null)}>
        <DialogContent>
          {editingTerm && (
            <PaymentTermForm
              term={editingTerm}
              onSubmit={(data) => handleUpdate(editingTerm.id, data)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <PaymentTermForm onSubmit={handleCreate} isLoading={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentTermForm({
  term,
  onSubmit,
  isLoading,
}: {
  term?: PaymentTerm;
  onSubmit: (
    data:
      | {
          code: string;
          name: string;
          days: number;
          adjustment_percent: number;
          advance_percent?: number | null;
          active?: boolean;
        }
      | Partial<PaymentTerm>
  ) => void;
  isLoading: boolean;
}) {
  const advance = term?.advance_percent ?? 0;
  const [advancePercent, setAdvancePercent] = useState<number>(advance);
  const [balanceDays, setBalanceDays] = useState(term?.days?.toString() || '30');
  const [adjustmentPercent, setAdjustmentPercent] = useState(
    term?.adjustment_percent?.toString() || '0'
  );
  const [active, setActive] = useState(term?.active ?? true);

  const isAdvanceStructure = advancePercent === 50 || advancePercent === 70;
  const parsedBalance = parseInt(balanceDays) || 30;
  const days = isAdvanceStructure ? parsedBalance : term ? term.days : parsedBalance;

  const deriveCodeAndName = () => {
    if (advancePercent === 0 && days === 0) return { code: 'AVISTA', name: 'À Vista' };
    if (advancePercent === 0) return { code: `D${days}`, name: `${days} dias` };
    return {
      code: `${advancePercent}_${100 - advancePercent}_D${days}`,
      name: `${advancePercent}/${100 - advancePercent} em ${days} dias`,
    };
  };

  const { code, name } = term ? { code: term.code, name: term.name } : deriveCodeAndName();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalDays = advancePercent === 0 && !term ? days : days;
    onSubmit({
      code,
      name,
      days: finalDays,
      adjustment_percent: parseFloat(adjustmentPercent) || 0,
      advance_percent: advancePercent === 0 ? 0 : advancePercent,
      active,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{term ? 'Editar Prazo de Pagamento' : 'Novo Prazo de Pagamento'}</DialogTitle>
        <DialogDescription>
          Configure condição (à vista, 50/50, 70/30) e dias para saldo (15, 25, 30)
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Condição de Pagamento</Label>
          <Select
            value={advancePercent.toString()}
            onValueChange={(v) => setAdvancePercent(parseInt(v))}
            disabled={!!term}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STRUCTURE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!term && (
          <div className="space-y-2">
            <Label>{isAdvanceStructure ? 'Dias para Saldo' : 'Dias para Pagamento'}</Label>
            {advancePercent === 0 ? (
              <Input
                type="number"
                min="0"
                value={balanceDays}
                onChange={(e) => setBalanceDays(e.target.value)}
                placeholder="0 = à vista"
              />
            ) : (
              <Select value={balanceDays} onValueChange={setBalanceDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BALANCE_DAYS_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      {d} dias
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {term && (
          <div className="text-sm text-muted-foreground">
            {advancePercent === 50 || advancePercent === 70
              ? `${advancePercent}/${100 - advancePercent} em ${term.days} dias`
              : term.days === 0
                ? 'À vista'
                : `${term.days} dias`}
          </div>
        )}

        <div className="space-y-2">
          <Label>Ajuste (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={adjustmentPercent}
            onChange={(e) => setAdjustmentPercent(e.target.value)}
            placeholder="Negativo = desconto"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Ativo</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {term ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
