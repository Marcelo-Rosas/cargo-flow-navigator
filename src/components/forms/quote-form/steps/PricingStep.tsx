import type { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { NumericInput } from '@/components/ui/numeric-input';
import { Loader2, Calculator, CalendarDays, TrendingUp, ReceiptText, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

import { UnloadingCostSection } from '@/components/quotes/UnloadingCostSection';
import { EquipmentRentalSection } from '@/components/quotes/EquipmentRentalSection';
import { AdditionalFeesSection } from '@/components/quotes/AdditionalFeesSection';
import type { AdditionalFeesSelection } from '@/components/quotes/AdditionalFeesSection';
import type { EquipmentRentalItem } from '@/components/quotes/EquipmentRentalSection';
import type { UnloadingCostItem } from '@/components/quotes/UnloadingCostSection';
import type { QuoteFormData } from '../types';
import type { FreightCalculationOutput } from '@/lib/freightCalculator';

interface PricingStepProps {
  form: UseFormReturn<QuoteFormData>;
  calculationResult: FreightCalculationOutput | null;
  isCalculationStale: boolean;
  formatCurrency: (v: number) => string;
  additionalFeesSelection: AdditionalFeesSelection;
  setAdditionalFeesSelection: (s: AdditionalFeesSelection) => void;
  equipmentRentalItems: EquipmentRentalItem[];
  onEquipmentRentalChange: (total: number, items: EquipmentRentalItem[]) => void;
  unloadingCostItems: UnloadingCostItem[];
  onUnloadingCostChange: (total: number, items: UnloadingCostItem[]) => void;
}

export function PricingStep({
  form,
  calculationResult,
  isCalculationStale,
  formatCurrency,
  additionalFeesSelection,
  setAdditionalFeesSelection,
  equipmentRentalItems,
  onEquipmentRentalChange,
  unloadingCostItems,
  onUnloadingCostChange,
}: PricingStepProps) {
  const c = calculationResult?.components;
  const t = calculationResult?.totals;
  const p = calculationResult?.profitability;
  const m = calculationResult?.meta;
  const icmsByUf = (m as { icmsBreakdownByUf?: Record<string, number> } | undefined)
    ?.icmsBreakdownByUf;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-xs uppercase tracking-widest">Pricing & Composição</h3>
        </div>
        <div className="flex items-center gap-2">
          {calculationResult?.status === 'OUT_OF_RANGE' && (
            <Badge variant="destructive" className="text-[10px]">
              Distância fora da faixa
            </Badge>
          )}
          {calculationResult?.status === 'MISSING_DATA' && (
            <Badge variant="secondary" className="text-[10px]">
              Tabela não selecionada
            </Badge>
          )}
          {isCalculationStale && (
            <Badge
              variant="outline"
              className="animate-pulse bg-amber-50 text-amber-600 border-amber-200 py-0.5 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
            >
              <Loader2 className="w-3 h-3 animate-spin mr-1" /> Calculando...
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* COLUNA A: ENTRADAS */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cargo_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Valor da Carga</FormLabel>
                  <FormControl>
                    <NumericInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      prefix="R$ "
                      onValueChange={(v) => field.onChange(v ?? 0)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="toll"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Pedágio</FormLabel>
                  <FormControl>
                    <NumericInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      prefix="R$ "
                      onValueChange={(v) => field.onChange(v ?? 0)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-6">
            <EquipmentRentalSection
              value={form.watch('aluguel_maquinas') || 0}
              onChange={onEquipmentRentalChange}
              initialItems={equipmentRentalItems}
            />
            <UnloadingCostSection
              value={form.watch('descarga') || 0}
              onChange={onUnloadingCostChange}
              initialItems={unloadingCostItems}
            />
            <div className="flex gap-8 p-4 border rounded-lg bg-muted/10">
              <FormField
                control={form.control}
                name="tde_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="text-xs font-bold uppercase">TDE</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tear_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="text-xs font-bold uppercase">TEAR</FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <AdditionalFeesSection
              selection={additionalFeesSelection}
              onChange={setAdditionalFeesSelection}
              baseFreight={c?.baseFreight || 0}
              cargoValue={form.watch('cargo_value') || 0}
              vehicleTypeId={form.watch('vehicle_type_id')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <FormField
              control={form.control}
              name="advance_due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold flex gap-2">
                    <CalendarDays className="w-3 h-3" /> Adiantamento
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="balance_due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold flex gap-2">
                    <CalendarDays className="w-3 h-3" /> Saldo
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Notas</FormLabel>
                <FormControl>
                  <Textarea {...field} className="h-20" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* COLUNA B: RESULTADOS */}
        <div
          className={cn(
            'transition-all duration-300',
            isCalculationStale && 'opacity-50 grayscale pointer-events-none'
          )}
        >
          <Tabs
            defaultValue="memoria"
            className="w-full border rounded-xl overflow-hidden bg-card shadow-sm"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-none h-12">
              <TabsTrigger value="memoria" className="gap-2 font-bold text-xs uppercase">
                <ReceiptText className="w-4 h-4" /> Memória
              </TabsTrigger>
              <TabsTrigger value="rentabilidade" className="gap-2 font-bold text-xs uppercase">
                <TrendingUp className="w-4 h-4" /> Rentabilidade
              </TabsTrigger>
            </TabsList>

            <TabsContent value="memoria" className="p-5 space-y-3 text-sm mt-0">
              <ResultRow label="Frete Peso (Base)" value={formatCurrency(c?.baseFreight ?? 0)} />
              {c?.toll != null && c.toll > 0 && (
                <ResultRow label="Pedágio" value={formatCurrency(c.toll)} />
              )}
              {c?.aluguelMaquinas != null && c.aluguelMaquinas > 0 && (
                <ResultRow label="Aluguel de Máquinas" value={formatCurrency(c.aluguelMaquinas)} />
              )}
              {c?.gris != null && c.gris > 0 && (
                <ResultRow label="GRIS" value={formatCurrency(c.gris)} />
              )}
              {c?.tso != null && c.tso > 0 && (
                <ResultRow label="TSO" value={formatCurrency(c.tso)} />
              )}
              {c?.rctrc != null && c.rctrc > 0 && (
                <ResultRow label="RCTR-C" value={formatCurrency(c.rctrc)} />
              )}
              {((c?.tde ?? 0) > 0 || (c?.tear ?? 0) > 0) && (
                <ResultRow
                  label="TDE / TEAR"
                  value={formatCurrency((c?.tde ?? 0) + (c?.tear ?? 0))}
                />
              )}
              {c?.dispatchFee != null && c.dispatchFee > 0 && (
                <ResultRow label="Taxa de expedição" value={formatCurrency(c.dispatchFee)} />
              )}
              {c?.conditionalFeesTotal != null && c.conditionalFeesTotal > 0 && (
                <ResultRow
                  label="Taxas Condicionais"
                  value={formatCurrency(c.conditionalFeesTotal)}
                />
              )}
              {/* Correção: Apenas custo de Estadia, sem Descarga */}
              {c?.waitingTimeCost != null && c.waitingTimeCost > 0 && (
                <ResultRow
                  label="Estadia / Hora Parada"
                  value={formatCurrency(c.waitingTimeCost)}
                />
              )}

              <Separator className="my-2" />
              <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg border border-primary/20">
                <span className="font-bold text-primary text-xs uppercase">Total Cliente</span>
                <span className="font-black text-xl text-primary">
                  {formatCurrency(t?.totalCliente ?? 0)}
                </span>
              </div>
            </TabsContent>

            <TabsContent value="rentabilidade" className="p-5 space-y-3 text-sm mt-0">
              <ResultRow label="Receita Bruta" value={formatCurrency(t?.receitaBruta ?? 0)} />
              {t?.das != null && t.das > 0 && (
                <ResultRow label="DAS (Simples)" value={formatCurrency(t.das)} />
              )}
              {t?.icms != null && t.icms > 0 && (
                <ResultRow label="ICMS" value={formatCurrency(t.icms)} />
              )}

              {icmsByUf && Object.keys(icmsByUf).length > 0 && (
                <IcmsByUfSection breakdown={icmsByUf} formatCurrency={formatCurrency} />
              )}

              <Separator className="my-2" />
              <ResultRow label="Margem Bruta" value={formatCurrency(p?.margemBruta ?? 0)} />
              <ResultRow label="Overhead (Fixo)" value={formatCurrency(p?.overhead ?? 0)} />

              <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900 mt-4">
                <div className="flex flex-col">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs uppercase">
                    Resultado Líquido
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">
                    Margem: {(p?.margemPercent ?? 0).toFixed(2)}%
                  </span>
                </div>
                <span className="font-black text-xl text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(p?.resultadoLiquido ?? 0)}
                </span>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs sm:text-sm animate-in fade-in duration-300">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function IcmsByUfSection({
  breakdown,
  formatCurrency,
}: {
  breakdown: Record<string, number>;
  formatCurrency: (v: number) => string;
}) {
  const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <MapPin className="w-3.5 h-3.5" /> ICMS por Estado
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        {entries.map(([uf, value]) => (
          <div key={uf} className="flex justify-between">
            <span>{uf}</span>
            <span className="font-medium tabular-nums">{formatCurrency(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
