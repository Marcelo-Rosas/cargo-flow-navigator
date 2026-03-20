import { useState } from 'react';
import {
  Loader2,
  Percent,
  Receipt,
  Truck,
  Wallet,
  Calendar,
  Gauge,
  Building2,
  AlertCircle,
  Package,
  Wrench,
  Plus,
  Trash2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePricingRulesConfig, useVehicleTypes } from '@/hooks/usePricingRules';
import type { PricingRuleConfig } from '@/hooks/usePricingRules';
import {
  useCreatePricingRuleConfig,
  useDeletePricingRuleConfig,
  useUpdatePricingRuleConfig,
} from '@/hooks/usePricingRulesMutations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'imposto', label: 'Impostos', icon: Percent },
  { id: 'markup', label: 'Markup & Overhead', icon: Wallet },
  { id: 'risco', label: 'Risco / Seguros', icon: AlertCircle },
  { id: 'taxa', label: 'Taxas Condicionais', icon: Receipt },
  { id: 'carga_descarga', label: 'Carga e Descarga', icon: Package },
  { id: 'aluguel', label: 'Aluguel', icon: Wrench },
  { id: 'veiculo', label: 'Por Veículo', icon: Truck },
  { id: 'estadia', label: 'Estadia', icon: Gauge },
  { id: 'prazo', label: 'Prazo', icon: Calendar },
] as const;

const PROTECTED_RULE_KEYS = new Set([
  'das_percent',
  'markup_percent',
  'overhead_percent',
  'profit_margin_percent',
  'regime_simples_nacional',
  'excesso_sublimite',
]);

const DEFAULT_VALUE_TYPE = 'percentage';

function formatValue(rule: PricingRuleConfig): string {
  const v = Number(rule.value);
  if (rule.value_type === 'percentage') return `${v.toFixed(2)}%`;
  if (rule.value_type === 'per_km')
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`;
  if (rule.value_type === 'per_ton')
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ton`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PricingRulesManager() {
  const { data: rules, isLoading } = usePricingRulesConfig(false);
  const { data: vehicleTypes } = useVehicleTypes(false);
  const createMutation = useCreatePricingRuleConfig();
  const updateMutation = useUpdatePricingRuleConfig();
  const deleteMutation = useDeletePricingRuleConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [createCategory, setCreateCategory] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newValueType, setNewValueType] = useState<string>(DEFAULT_VALUE_TYPE);
  const [newValue, setNewValue] = useState('');
  const [newVehicleTypeId, setNewVehicleTypeId] = useState<string | ''>('');

  // Filtra regras legadas de ICMS por UF e TDE/TEAR NTC:
  // - ICMS por UF é gerido na tela de Alíquotas de ICMS.
  // - TDE/TEAR NTC agora são tratados como Taxas Condicionais em conditional_fees.
  const visibleRules =
    rules?.filter(
      (r) => !r.key.startsWith('icms_uf_') && r.key !== 'tde_percent' && r.key !== 'tear_percent'
    ) ?? [];

  const rulesByCategory = (category: string) => visibleRules.filter((r) => r.category === category);

  const getVehicleName = (vehicleTypeId: string | null) => {
    if (!vehicleTypeId) return 'Global';
    return vehicleTypes?.find((v) => v.id === vehicleTypeId)?.name ?? vehicleTypeId.slice(0, 8);
  };

  const resetCreateForm = () => {
    setNewKey('');
    setNewLabel('');
    setNewValueType(DEFAULT_VALUE_TYPE);
    setNewValue('');
    setNewVehicleTypeId('');
  };

  const handleStartEdit = (rule: PricingRuleConfig) => {
    setEditingId(rule.id);
    setEditValue(String(rule.value));
  };

  const handleSave = async () => {
    if (!editingId) return;
    const num = parseFloat(editValue);
    if (Number.isNaN(num)) {
      toast.error('Valor inválido');
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: editingId, value: num });
      toast.success('Regra atualizada');
      setEditingId(null);
    } catch {
      toast.error('Erro ao atualizar regra');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleCreateRule = async () => {
    if (!createCategory) return;
    if (!newKey.trim() || !newLabel.trim()) {
      toast.error('Preencha chave e rótulo da regra');
      return;
    }
    const numericValue = parseFloat(newValue);
    if (Number.isNaN(numericValue)) {
      toast.error('Valor inválido');
      return;
    }
    try {
      await createMutation.mutateAsync({
        key: newKey.trim(),
        label: newLabel.trim(),
        category: createCategory,
        value_type: newValueType,
        value: numericValue,
        vehicle_type_id: newVehicleTypeId || null,
      });
      toast.success('Regra criada com sucesso');
      resetCreateForm();
      setCreateCategory(null);
    } catch {
      toast.error('Erro ao criar regra');
    }
  };

  const isProtectedRule = (rule: PricingRuleConfig) => PROTECTED_RULE_KEYS.has(rule.key);

  // Configurações Fiscais (Motor Híbrido Simples vs Sublimite)
  const regimeSimplesRule = rules?.find(
    (r) => r.key === 'regime_simples_nacional' && r.vehicle_type_id == null
  );
  const excessoSublimiteRule = rules?.find(
    (r) => r.key === 'excesso_sublimite' && r.vehicle_type_id == null
  );
  const regimeSimplesNacional = Number(regimeSimplesRule?.value ?? 1) === 1;
  const excessoSublimite = Number(excessoSublimiteRule?.value ?? 0) === 1;

  const handleToggleRegimeSimples = async (checked: boolean) => {
    if (!regimeSimplesRule) return;
    try {
      await updateMutation.mutateAsync({ id: regimeSimplesRule.id, value: checked ? 1 : 0 });
      toast.success(checked ? 'Simples Nacional ativado' : 'Simples Nacional desativado');
      if (!checked && excessoSublimiteRule) {
        await updateMutation.mutateAsync({ id: excessoSublimiteRule.id, value: 0 });
      }
    } catch {
      toast.error('Erro ao atualizar regime');
    }
  };

  const handleToggleExcessoSublimite = async (checked: boolean) => {
    if (!excessoSublimiteRule) return;
    try {
      await updateMutation.mutateAsync({ id: excessoSublimiteRule.id, value: checked ? 1 : 0 });
      toast.success(checked ? 'Excesso de Sublimite ativado' : 'Excesso de Sublimite desativado');
    } catch {
      toast.error('Erro ao atualizar excesso de sublimite');
    }
  };

  const financeiroKeys = ['overhead_percent', 'das_percent', 'profit_margin_percent'] as const;
  const financeiroRules = financeiroKeys
    .map((key) => rules?.find((r) => r.key === key && r.vehicle_type_id == null))
    .filter((r): r is PricingRuleConfig => r != null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seção Configurações Fiscais (Motor Híbrido) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Configurações Fiscais
          </CardTitle>
          <CardDescription>
            Defina o regime tributário e parâmetros financeiros da operação. Estas configurações
            afetam o cálculo do Gross-up (Asset-Light).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div>
              <Label className="text-base font-semibold">Regime Simples Nacional</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                ICMS incluído na guia DAS (não soma ao divisor Gross-up)
              </p>
            </div>
            <Switch
              checked={regimeSimplesNacional}
              onCheckedChange={handleToggleRegimeSimples}
              disabled={updateMutation.isPending}
            />
          </div>

          {regimeSimplesNacional && (
            <div className="flex items-center justify-between rounded-lg border bg-warning/10 border-warning/20 p-4">
              <div>
                <Label className="text-base font-semibold">Excesso de Sublimite (R$ 3,6mi)</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  ICMS sai da DAS e vira imposto estadual separado (Cálculo por Dentro)
                </p>
              </div>
              <Switch
                checked={excessoSublimite}
                onCheckedChange={handleToggleExcessoSublimite}
                disabled={updateMutation.isPending}
              />
            </div>
          )}

          <Alert
            className={cn(
              excessoSublimite
                ? 'bg-warning/10 border-warning/20'
                : 'bg-primary/10 border-primary/20'
            )}
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Regime Ativo</AlertTitle>
            <AlertDescription>
              {excessoSublimite
                ? 'Excesso de Sublimite: ICMS será calculado separadamente (DAS Federal + ICMS Estadual).'
                : regimeSimplesNacional
                  ? 'Simples Nacional: ICMS incluído na DAS (divisor Gross-up não soma ICMS).'
                  : 'Regime Normal: ICMS calculado separadamente.'}
            </AlertDescription>
          </Alert>

          <div className="pt-4">
            <h4 className="mb-3 text-sm font-semibold">Parâmetros Financeiros (Gross-up)</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parâmetro</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financeiroRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-semibold">{rule.label}</TableCell>
                    <TableCell>
                      {editingId === rule.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8 w-24"
                        />
                      ) : (
                        <Badge variant="outline" className="text-base">
                          {Number(rule.value).toFixed(2)}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(rule.metadata as { description?: string })?.description ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === rule.id ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={handleCancel}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Salvar'
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleStartEdit(rule)}>
                          Editar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Central de Regras por Categoria */}
      <div>
        <p className="mb-4 text-sm text-muted-foreground">
          Edite Markup, DAS, TDE/TEAR e outras regras sem alterar código. Regras por veículo têm
          precedência sobre regras globais. As alíquotas de ICMS por UF são geridas na tela
          específica de Alíquotas de ICMS.
        </p>
        <Tabs defaultValue="imposto" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 overflow-x-auto">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="flex items-center gap-2 text-xs">
                <Icon className="h-4 w-4" />
                {label}
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {rulesByCategory(id).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {CATEGORIES.map(({ id, label }) => (
            <TabsContent key={id} value={id} className="mt-4">
              <div className="rounded-lg border">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
                  <p className="text-xs text-muted-foreground">
                    Regras da categoria <span className="font-medium">{label}</span>
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      resetCreateForm();
                      setCreateCategory(id);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Nova regra
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Regra</TableHead>
                      <TableHead>Escopo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-32 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rulesByCategory(id).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma regra na categoria {label}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rulesByCategory(id).map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <span className="font-medium">{rule.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground">({rule.key})</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.vehicle_type_id ? 'outline' : 'secondary'}>
                              {getVehicleName(rule.vehicle_type_id)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {editingId === rule.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-24">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-8 text-right"
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {rule.value_type === 'percentage' ? '%' : 'R$'}
                                </span>
                              </div>
                            ) : (
                              formatValue(rule)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingId === rule.id ? (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={handleCancel}>
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleSave}
                                  disabled={updateMutation.isPending}
                                >
                                  {updateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Salvar'
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartEdit(rule)}
                                >
                                  Editar
                                </Button>
                                {!isProtectedRule(rule) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive"
                                        disabled={deleteMutation.isPending}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          A regra <strong>{rule.label}</strong> (
                                          <code>{rule.key}</code>) será removida da Central de
                                          Regras. Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={async () => {
                                            try {
                                              await deleteMutation.mutateAsync(rule.id);
                                              toast.success('Regra excluída com sucesso');
                                            } catch {
                                              toast.error('Erro ao excluir regra');
                                            }
                                          }}
                                        >
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog
        open={createCategory !== null}
        onOpenChange={(open) => !open && setCreateCategory(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova regra da Central de Regras</DialogTitle>
            <DialogDescription className="text-xs">
              Crie uma nova regra para a categoria{' '}
              <span className="font-semibold">
                {CATEGORIES.find((c) => c.id === createCategory)?.label ?? ''}
              </span>
              . Regras por veículo têm precedência sobre regras globais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-key">Chave</Label>
                <Input
                  id="new-key"
                  placeholder="ex: gris_percent"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-label">Rótulo</Label>
                <Input
                  id="new-label"
                  placeholder="Ex: GRIS (%)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Tipo de valor</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={newValueType}
                  onChange={(e) => setNewValueType(e.target.value)}
                >
                  <option value="percentage">Percentual (%)</option>
                  <option value="fixed">Fixo (R$)</option>
                  <option value="per_km">Por km (R$/km)</option>
                  <option value="per_ton">Por tonelada (R$/ton)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-value">Valor</Label>
                <Input
                  id="new-value"
                  type="number"
                  step="0.01"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Escopo</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={newVehicleTypeId}
                  onChange={(e) => setNewVehicleTypeId(e.target.value)}
                >
                  <option value="">Global</option>
                  {vehicleTypes?.map((vt) => (
                    <option key={vt.id} value={vt.id}>
                      {vt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="space-x-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetCreateForm();
                setCreateCategory(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateRule} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                'Criar regra'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
