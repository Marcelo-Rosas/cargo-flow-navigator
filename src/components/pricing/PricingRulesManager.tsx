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
import { usePricingRulesConfig, useVehicleTypes } from '@/hooks/usePricingRules';
import type { PricingRuleConfig } from '@/hooks/usePricingRules';
import { useUpdatePricingRuleConfig } from '@/hooks/usePricingRulesMutations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'imposto', label: 'Impostos', icon: Percent },
  { id: 'markup', label: 'Markup & Overhead', icon: Wallet },
  { id: 'taxa', label: 'Taxas (TDE/TEAR)', icon: Receipt },
  { id: 'carga_descarga', label: 'Carga e Descarga', icon: Package },
  { id: 'aluguel', label: 'Aluguel', icon: Wrench },
  { id: 'veiculo', label: 'Por Veículo', icon: Truck },
  { id: 'estadia', label: 'Estadia', icon: Gauge },
  { id: 'prazo', label: 'Prazo', icon: Calendar },
] as const;

function formatValue(rule: PricingRuleConfig): string {
  const v = Number(rule.value);
  if (rule.value_type === 'percentage') return `${v.toFixed(2)}%`;
  if (rule.value_type === 'per_km') return `R$ ${v.toFixed(2)}/km`;
  if (rule.value_type === 'per_ton') return `R$ ${v.toFixed(2)}/ton`;
  return `R$ ${v.toFixed(2)}`;
}

export function PricingRulesManager() {
  const { data: rules, isLoading } = usePricingRulesConfig(false);
  const { data: vehicleTypes } = useVehicleTypes(false);
  const updateMutation = useUpdatePricingRuleConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const rulesByCategory = (category: string) => rules?.filter((r) => r.category === category) ?? [];

  const getVehicleName = (vehicleTypeId: string | null) => {
    if (!vehicleTypeId) return 'Global';
    return vehicleTypes?.find((v) => v.id === vehicleTypeId)?.name ?? vehicleTypeId.slice(0, 8);
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
          Edite Markup, DAS, ICMS por UF, TDE/TEAR e outras regras sem alterar código. Regras por
          veículo têm precedência sobre regras globais.
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartEdit(rule)}
                              >
                                Editar
                              </Button>
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
    </div>
  );
}
