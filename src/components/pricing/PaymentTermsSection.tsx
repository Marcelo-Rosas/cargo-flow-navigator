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
import { type PaymentTerm, ADVANCE_PRESETS, DAYS_PRESETS } from '@/types/pricing';

/** Retorna label legível para a coluna "Condição" na tabela */
function formatConditionLabel(advancePercent: number | null | undefined, days: number): string {
  const adv = advancePercent ?? 0;
  if (adv > 0) return `${adv}/${100 - adv}`;
  if (days === 0) return 'À vista';
  return 'Prazo normal';
}

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
                {formatConditionLabel(term.advance_percent, term.days)}
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

/* ────────────────────────────────────────────────────────────── */
/*  Preset chip buttons                                          */
/* ────────────────────────────────────────────────────────────── */

function PresetChips({
  presets,
  current,
  onSelect,
  suffix,
}: {
  presets: readonly number[];
  current: number;
  onSelect: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
            current === p
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          {p === 0 ? 'À vista' : `${p}${suffix ?? ''}`}
        </button>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Form (criação + edição 100% livre)                           */
/* ────────────────────────────────────────────────────────────── */

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
  const [advancePercent, setAdvancePercent] = useState<number>(term?.advance_percent ?? 0);
  const [balanceDays, setBalanceDays] = useState(term?.days?.toString() || '30');
  const [adjustmentPercent, setAdjustmentPercent] = useState(
    term?.adjustment_percent?.toString() || '0'
  );
  const [active, setActive] = useState(term?.active ?? true);

  const isAdvanceStructure = advancePercent > 0;
  const parsedDays = parseInt(balanceDays) || 0;

  const deriveCodeAndName = () => {
    if (advancePercent === 0 && parsedDays === 0) return { code: 'AVISTA', name: 'À Vista' };
    if (advancePercent === 0) return { code: `D${parsedDays}`, name: `${parsedDays} dias` };
    return {
      code: `${advancePercent}_${100 - advancePercent}_D${parsedDays}`,
      name: `${advancePercent}/${100 - advancePercent} em ${parsedDays} dias`,
    };
  };

  // Sempre recalcula code/name baseado nos valores atuais (tanto criação quanto edição)
  const { code, name } = deriveCodeAndName();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      code,
      name,
      days: parsedDays,
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
          Configure livremente a condição e os dias. Use os atalhos ou digite valores customizados.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {/* % Adiantamento — input livre + presets */}
        <div className="space-y-2">
          <Label>% Adiantamento</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={advancePercent}
            onChange={(e) => setAdvancePercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
            placeholder="0 = à vista / prazo normal"
          />
          <PresetChips
            presets={ADVANCE_PRESETS}
            current={advancePercent}
            onSelect={setAdvancePercent}
            suffix="%"
          />
          {isAdvanceStructure && (
            <p className="text-xs text-muted-foreground">
              {advancePercent}% adiantamento + {100 - advancePercent}% saldo
            </p>
          )}
        </div>

        {/* Dias — input livre + presets */}
        <div className="space-y-2">
          <Label>{isAdvanceStructure ? 'Dias para Saldo' : 'Dias para Pagamento'}</Label>
          <Input
            type="number"
            min="0"
            value={balanceDays}
            onChange={(e) => setBalanceDays(e.target.value)}
            placeholder="0 = à vista"
          />
          <PresetChips
            presets={DAYS_PRESETS}
            current={parsedDays}
            onSelect={(v) => setBalanceDays(v.toString())}
            suffix="d"
          />
        </div>

        {/* Preview do código e nome */}
        <div className="rounded-md border border-dashed p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Preview</p>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs font-mono text-muted-foreground">{code}</p>
        </div>

        {/* Ajuste % */}
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

        {/* Ativo toggle */}
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
