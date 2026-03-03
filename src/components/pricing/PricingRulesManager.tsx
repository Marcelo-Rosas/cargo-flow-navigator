import { useState } from 'react';
import { Loader2, Percent, Receipt, Truck, Wallet, Calendar, Gauge } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePricingRulesConfig, useVehicleTypes } from '@/hooks/usePricingRules';
import type { PricingRuleConfig } from '@/hooks/usePricingRules';
import { useUpdatePricingRuleConfig } from '@/hooks/usePricingRulesMutations';
import { toast } from 'sonner';

const CATEGORIES = [
  { id: 'imposto', label: 'Impostos', icon: Percent },
  { id: 'markup', label: 'Markup & Overhead', icon: Wallet },
  { id: 'taxa', label: 'Taxas (TDE/TEAR)', icon: Receipt },
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Edite Markup, DAS, ICMS por UF, TDE/TEAR e outras regras sem alterar código. Regras por
        veículo têm precedência sobre regras globais.
      </p>
      <Tabs defaultValue="imposto" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
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
  );
}
