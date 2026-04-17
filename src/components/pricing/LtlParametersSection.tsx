import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';

type LtlRow = {
  id: string;
  reference_month: string;
  min_freight: number;
  min_freight_cargo_limit: number;
  min_tso: number;
  gris_percent: number;
  gris_min: number;
  gris_min_cargo_limit: number;
  gris_high_risk_percent: number;
  dispatch_fee: number;
  correction_factor: number;
  cubage_factor: number;
};

type EditableFields = Omit<LtlRow, 'id' | 'reference_month'>;

const FIELD_META: { key: keyof EditableFields; label: string; unit: 'R$' | '%' | 'kg/m³' | '' }[] =
  [
    { key: 'min_freight', label: 'Frete mínimo por CTe', unit: 'R$' },
    { key: 'min_freight_cargo_limit', label: 'Limite de carga p/ frete mínimo', unit: 'R$' },
    { key: 'min_tso', label: 'TSO mínimo por CTe', unit: 'R$' },
    { key: 'gris_percent', label: 'GRIS (%)', unit: '%' },
    { key: 'gris_min', label: 'GRIS mínimo por CTe', unit: 'R$' },
    { key: 'gris_min_cargo_limit', label: 'Limite de carga p/ GRIS mínimo', unit: 'R$' },
    { key: 'gris_high_risk_percent', label: 'GRIS Alto Risco (%)', unit: '%' },
    { key: 'dispatch_fee', label: 'Taxa de Despacho', unit: 'R$' },
    { key: 'correction_factor', label: 'Fator de Correção NTC', unit: '' },
    { key: 'cubage_factor', label: 'Fator de Cubagem', unit: 'kg/m³' },
  ];

function formatValue(value: number, unit: 'R$' | '%' | 'kg/m³' | ''): string {
  if (unit === 'R$')
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (unit === '%')
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  if (unit === 'kg/m³') return `${value} kg/m³`;
  return String(value);
}

export function LtlParametersSection() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<EditableFields>>({});

  const { data: row, isLoading } = useQuery({
    queryKey: ['ltl-parameters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ltl_parameters')
        .select('*')
        .order('reference_month', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as LtlRow | null;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EditableFields> }) => {
      const { error } = await supabase.from('ltl_parameters').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ltl-parameters'] });
      toast.success('Parâmetros NTC atualizados');
      setEditing(false);
      setDraft({});
    },
    onError: () => toast.error('Erro ao salvar parâmetros'),
  });

  function handleEdit() {
    if (!row) return;
    const initial: Partial<EditableFields> = {};
    FIELD_META.forEach(({ key }) => {
      initial[key] = row[key] as number;
    });
    setDraft(initial);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setDraft({});
  }

  function handleSave() {
    if (!row) return;
    for (const { key } of FIELD_META) {
      const val = draft[key];
      if (val === undefined || val === null || isNaN(Number(val)) || Number(val) < 0) {
        toast.error(`Valor inválido para "${FIELD_META.find((f) => f.key === key)?.label}"`);
        return;
      }
    }
    const updates: Partial<EditableFields> = {};
    FIELD_META.forEach(({ key }) => {
      updates[key] = Number(draft[key]);
    });
    mutation.mutate({ id: row.id, updates });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
        Nenhum registro encontrado em <code>ltl_parameters</code>.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-base">Parâmetros NTC — Fracionado (LTL)</CardTitle>
          <CardDescription>
            Referência: <span className="font-medium">{row.reference_month}</span> · Tabela NTC
            Dez/2025
          </CardDescription>
        </div>
        <div className="flex gap-2 shrink-0">
          {editing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={mutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FIELD_META.map(({ key, label, unit }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              {editing ? (
                <Input
                  type="number"
                  step="any"
                  min={0}
                  value={draft[key] ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="h-8 text-sm"
                />
              ) : (
                <p className="text-sm font-medium tabular-nums">
                  {formatValue(row[key] as number, unit)}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
