import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { QuoteFormData } from '../types';

const kgToUnit = (kg: number, unit: 'kg' | 'ton') => (unit === 'ton' ? kg / 1000 : kg);
const unitToKg = (value: number, unit: 'kg' | 'ton') => (unit === 'ton' ? value * 1000 : value);

const CUBAGE_FACTOR_KG_M3 = 300;

function computePesoFaturavel(
  weightKg: number,
  volumeM3: number
): { cubageWeightKg: number; billableWeightKg: number } | null {
  if (weightKg <= 0 && volumeM3 <= 0) return null;
  const cubageWeightKg = Math.round((volumeM3 * CUBAGE_FACTOR_KG_M3 + Number.EPSILON) * 100) / 100;
  const billableWeightKg = Math.max(weightKg, cubageWeightKg);
  return { cubageWeightKg, billableWeightKg };
}

interface PriceTable {
  id: string;
  name: string;
  modality: string | null;
}

interface VehicleType {
  id: string;
  name: string;
  code: string;
}

interface PaymentTerm {
  id: string;
  name: string;
  adjustment_percent?: number | null;
}

interface CargoLogisticsStepProps {
  form: UseFormReturn<QuoteFormData>;
  priceTablesFiltered: PriceTable[];
  vehicleTypes: VehicleType[];
  paymentTerms: PaymentTerm[];
  weightUnit: 'kg' | 'ton';
  setWeightUnit: (unit: 'kg' | 'ton') => void;
}

export function CargoLogisticsStep({
  form,
  priceTablesFiltered,
  vehicleTypes,
  paymentTerms,
  weightUnit,
  setWeightUnit,
}: CargoLogisticsStepProps) {
  const watchedWeight = form.watch('weight');
  const watchedVolume = form.watch('volume');
  const weightKg = unitToKg(Number(watchedWeight || 0), weightUnit);
  const volumeM3 = Number(watchedVolume || 0);
  const pesoFaturavelInfo = computePesoFaturavel(weightKg, volumeM3);
  const showPesoFaturavel = pesoFaturavelInfo && (weightKg > 0 || volumeM3 > 0);

  return (
    <div className="space-y-6">
      {/* Dados da Carga */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground border-b pb-2">Detalhes da Carga</h3>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="cargo_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Carga</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Eletrônicos, Grãos..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Peso</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <NumericInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value ?? 0}
                      placeholder={weightUnit === 'ton' ? '0,000' : '0'}
                      min={0}
                      max={weightUnit === 'ton' ? 99_999 : 99_999_999}
                      step={weightUnit === 'ton' ? 0.001 : 1}
                      suffix={weightUnit}
                      onValueChange={(val) => field.onChange(val ?? 0)}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <ToggleGroup
                    type="single"
                    value={weightUnit}
                    onValueChange={(v) => {
                      if (!v) return;
                      const nextUnit = v as 'kg' | 'ton';
                      const currentUnit = weightUnit;
                      const currentValue = Number(form.getValues('weight') || 0);
                      const kg = unitToKg(currentValue, currentUnit);
                      const nextValue = kgToUnit(kg, nextUnit);
                      setWeightUnit(nextUnit);
                      form.setValue('weight', Number.isFinite(nextValue) ? nextValue : 0, {
                        shouldDirty: true,
                      });
                    }}
                    size="sm"
                    className="shrink-0"
                  >
                    <ToggleGroupItem value="kg" className="text-xs px-2">
                      kg
                    </ToggleGroupItem>
                    <ToggleGroupItem value="ton" className="text-xs px-2">
                      ton
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="volume"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Volume (m³)</FormLabel>
                <FormControl>
                  <NumericInput
                    ref={field.ref}
                    name={field.name}
                    value={field.value ?? 0}
                    placeholder="0,00"
                    step={0.01}
                    suffix="m³"
                    onValueChange={(val) => field.onChange(val ?? 0)}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {showPesoFaturavel && pesoFaturavelInfo && (
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso Cubado (× 300 kg/m³)</span>
              <span>{pesoFaturavelInfo.cubageWeightKg.toLocaleString('pt-BR')} kg</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Peso Faturável</span>
              <span>{pesoFaturavelInfo.billableWeightKg.toLocaleString('pt-BR')} kg</span>
            </div>
          </div>
        )}
      </div>

      {/* Configuração Logística */}
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground border-b pb-2">Configuração Logística</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="freight_modality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modalidade de Frete</FormLabel>
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue('price_table_id', '');
                  }}
                  value={field.value || ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar modalidade..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="lotacao">Lotação</SelectItem>
                    <SelectItem value="fracionado">Fracionado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price_table_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tabela de Preços</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar tabela..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priceTablesFiltered.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name} ({table.modality === 'lotacao' ? 'Lotação' : 'Fracionado'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="vehicle_type_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Veículo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar veículo..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vehicleTypes.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="payment_term_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prazo de Pagamento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar prazo..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {paymentTerms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}{' '}
                        {term.adjustment_percent != null &&
                          term.adjustment_percent !== 0 &&
                          `(${term.adjustment_percent > 0 ? '+' : ''}${term.adjustment_percent}%)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="km_distance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distância (km)</FormLabel>
                <FormControl>
                  <NumericInput
                    ref={field.ref}
                    name={field.name}
                    value={field.value ?? ''}
                    placeholder="0"
                    suffix="km"
                    onValueChange={(val) => field.onChange(val ?? undefined)}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
