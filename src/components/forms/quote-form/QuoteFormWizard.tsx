import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { QuoteFormData } from './types';
import { IdentificationStep } from './steps/IdentificationStep';
import { CargoLogisticsStep } from './steps/CargoLogisticsStep';
import { PricingStep } from './steps/PricingStep';
import { ReviewStep } from './steps/ReviewStep';
import type { FreightCalculationOutput } from '@/lib/freightCalculator';
import type { AdditionalFeesSelection } from '@/components/quotes/AdditionalFeesSection';
import type { EquipmentRentalItem } from '@/components/quotes/EquipmentRentalSection';
import type { UnloadingCostItem } from '@/components/quotes/UnloadingCostSection';
import type { Database } from '@/integrations/supabase/types';

const STEPS = [
  { id: 'identification', label: 'Identificação' },
  { id: 'cargo', label: 'Carga e Logística' },
  { id: 'pricing', label: 'Composição Financeira' },
  { id: 'review', label: 'Revisão' },
] as const;

const STEP_FIELDS: (keyof QuoteFormData)[][] = [
  ['client_name', 'origin', 'destination', 'vehicle_type_id'],
  [
    'cargo_type',
    'weight',
    'volume',
    'freight_modality',
    'price_table_id',
    'payment_term_id',
    'km_distance',
  ],
  ['toll', 'cargo_value', 'notes'],
  [],
];

const STEP_FIELDS_LEGACY: (keyof QuoteFormData)[][] = [
  ['client_name', 'origin', 'destination'],
  ['cargo_type', 'weight', 'volume', 'km_distance', 'payment_term_id'],
  ['value', 'carreteiro_real', 'carrier_payment_term_id', 'advance_due_date', 'balance_due_date'],
  [],
];

interface QuoteFormWizardProps {
  form: UseFormReturn<QuoteFormData>;
  onSubmit: (data: QuoteFormData) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
  isEditing: boolean;
  isLoading: boolean;
  isLegacy?: boolean;
  // Identification step handlers
  clients: { id: string; name: string; email?: string | null; zip_code?: string | null }[];
  shippers: { id: string; name: string; email?: string | null; zip_code?: string | null }[];
  onClientSelect: (clientId: string) => void;
  onShipperSelect: (shipperId: string) => void;
  onOriginCepBlur: () => Promise<void>;
  onDestinationCepBlur: () => Promise<void>;
  onCalculateKm: () => Promise<void>;
  onOriginManualEdit?: () => void;
  onDestinationManualEdit?: () => void;
  isLoadingOriginCep: boolean;
  isLoadingDestinationCep: boolean;
  isCalculatingKm: boolean;
  // Cargo & Logistics step
  priceTablesFiltered: { id: string; name: string; modality: string | null }[];
  vehicleTypes: { id: string; name: string; code: string }[];
  paymentTerms: {
    id: string;
    name: string;
    adjustment_percent?: number | null;
    advance_percent?: number | null;
    days?: number;
  }[];
  weightUnit: 'kg' | 'ton';
  setWeightUnit: (unit: 'kg' | 'ton') => void;
  // Pricing step
  isCalculationStale: boolean;
  additionalFeesSelection: AdditionalFeesSelection;
  setAdditionalFeesSelection: (s: AdditionalFeesSelection) => void;
  equipmentRentalItems: EquipmentRentalItem[];
  onEquipmentRentalChange: (total: number, items: EquipmentRentalItem[]) => void;
  unloadingCostItems: UnloadingCostItem[];
  onUnloadingCostChange: (total: number, items: UnloadingCostItem[]) => void;
  // Review step
  calculationResult: FreightCalculationOutput | null;
  vehicleTypeName: string;
  clientName: string;
  shipperName: string;
  priceTableRow: Database['public']['Tables']['price_table_rows']['Row'] | null;
  isLoadingPriceRow: boolean;
  preserveOriginalPrice?: boolean;
  onPreserveOriginalPriceChange?: (value: boolean) => void;
}

export function QuoteFormWizard({
  form,
  onSubmit,
  onClose,
  onDelete,
  isEditing,
  isLoading,
  isLegacy = false,
  clients,
  shippers,
  onClientSelect,
  onShipperSelect,
  onOriginCepBlur,
  onDestinationCepBlur,
  onCalculateKm,
  onOriginManualEdit,
  onDestinationManualEdit,
  isLoadingOriginCep,
  isLoadingDestinationCep,
  isCalculatingKm,
  priceTablesFiltered,
  vehicleTypes,
  paymentTerms,
  weightUnit,
  setWeightUnit,
  isCalculationStale,
  additionalFeesSelection,
  setAdditionalFeesSelection,
  equipmentRentalItems,
  onEquipmentRentalChange,
  unloadingCostItems,
  onUnloadingCostChange,
  calculationResult,
  vehicleTypeName,
  clientName,
  shipperName,
  priceTableRow,
  isLoadingPriceRow,
  preserveOriginalPrice = false,
  onPreserveOriginalPriceChange,
}: QuoteFormWizardProps) {
  const [step, setStep] = useState(0);
  const canNext = step < STEPS.length - 1;
  const canPrev = step > 0;

  const stepFields = isLegacy ? STEP_FIELDS_LEGACY : STEP_FIELDS;

  const handleNext = async () => {
    const fields = stepFields[step];
    if (fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    setStep((s) => s + 1);
  };

  const handlePrev = () => {
    setStep((s) => s - 1);
  };

  const handleSubmitClick = () => {
    if (!canSubmit) return;
    form.handleSubmit(onSubmit)();
  };

  const status = calculationResult?.status ?? 'MISSING_DATA';
  const isStatusInvalid = status !== 'OK';
  const legacyValue = form.watch('value') ?? 0;
  const legacyCarreteiro = form.watch('carreteiro_real') ?? 0;
  const canSubmitLegacy = !isLoading && Number(legacyValue) > 0 && Number(legacyCarreteiro) >= 0;
  const canSubmitNormal =
    !isLoading &&
    !isLoadingPriceRow &&
    !isCalculationStale &&
    !isStatusInvalid &&
    !!priceTableRow &&
    !!calculationResult;
  const canSubmit = isLegacy ? canSubmitLegacy : canSubmitNormal;

  let blockedReason: string | null = null;
  if (isLegacy) {
    if (Number(legacyValue) <= 0) blockedReason = 'Informe o valor cliente (FAT).';
    else if (Number(legacyCarreteiro) < 0)
      blockedReason = 'O valor carreteiro (PAG) não pode ser negativo.';
  } else if (!calculationResult) {
    blockedReason = 'Aguardando o cálculo do frete...';
  } else if (isLoading) {
    blockedReason = 'Salvando...';
  } else if (status === 'OUT_OF_RANGE') {
    blockedReason = calculationResult?.error || 'Verifique a faixa de km da tabela selecionada.';
  } else if (status === 'MISSING_DATA') {
    blockedReason =
      calculationResult?.error || 'Selecione a tabela de preços e verifique suas faixas.';
  } else if (isCalculationStale) {
    blockedReason = 'Há alterações pendentes de cálculo. Execute novamente antes de salvar.';
  } else if (isLoadingPriceRow) {
    blockedReason = 'Aguardando carregamento da tabela de preços...';
  } else if (!priceTableRow) {
    blockedReason = 'Escolha a faixa correta de km para habilitar o envio.';
  }

  const shortLabels = ['Identificação', 'Carga', 'Financeiro', 'Revisão'];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Stepper */}
      <nav className="shrink-0 pb-4" aria-label="Etapas da cotação">
        <div className="flex items-center justify-between gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex flex-col sm:flex-row items-center gap-1 sm:gap-2 min-w-0 flex-1 last:flex-initial',
                i < step && 'cursor-pointer'
              )}
              disabled={i >= step}
              aria-current={i === step ? 'step' : undefined}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'border-2 border-primary bg-primary/5 text-primary'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs sm:text-sm truncate',
                  i === step ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {shortLabels[i]}
              </span>
            </button>
          ))}
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-0.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 0.5) / STEPS.length) * 100}%` }}
          />
        </div>
      </nav>

      {/* Step content - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
        {step === 0 && (
          <IdentificationStep
            form={form}
            clients={clients}
            shippers={shippers}
            vehicleTypes={vehicleTypes}
            isLegacy={isLegacy}
            onClientSelect={onClientSelect}
            onShipperSelect={onShipperSelect}
            onOriginCepBlur={onOriginCepBlur}
            onDestinationCepBlur={onDestinationCepBlur}
            onCalculateKm={onCalculateKm}
            onOriginManualEdit={onOriginManualEdit}
            onDestinationManualEdit={onDestinationManualEdit}
            isLoadingOriginCep={isLoadingOriginCep}
            isLoadingDestinationCep={isLoadingDestinationCep}
            isCalculatingKm={isCalculatingKm}
          />
        )}
        {step === 1 && (
          <CargoLogisticsStep
            form={form}
            priceTablesFiltered={priceTablesFiltered}
            paymentTerms={paymentTerms}
            weightUnit={weightUnit}
            setWeightUnit={setWeightUnit}
            isLegacy={isLegacy}
          />
        )}
        {step === 2 && (
          <PricingStep
            form={form}
            calculationResult={calculationResult}
            isCalculationStale={isCalculationStale}
            isLegacy={isLegacy}
            paymentTerms={paymentTerms}
            additionalFeesSelection={additionalFeesSelection}
            setAdditionalFeesSelection={setAdditionalFeesSelection}
            equipmentRentalItems={equipmentRentalItems}
            onEquipmentRentalChange={onEquipmentRentalChange}
            unloadingCostItems={unloadingCostItems}
            onUnloadingCostChange={onUnloadingCostChange}
          />
        )}
        {step === 3 && (
          <ReviewStep
            form={form}
            calculationResult={calculationResult}
            weightUnit={weightUnit}
            vehicleTypeName={vehicleTypeName}
            clientName={clientName}
            shipperName={shipperName}
            isLegacy={isLegacy}
          />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex justify-between items-center gap-4 pt-4 mt-4 border-t">
        {!canNext && blockedReason && (
          <p
            role="status"
            aria-live="polite"
            data-testid="wizard-blocked-reason"
            className="text-xs text-warning-foreground max-w-[360px] leading-tight"
          >
            {blockedReason}
          </p>
        )}
        <div>
          {isEditing && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isEditing && onPreserveOriginalPriceChange && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox
                checked={preserveOriginalPrice}
                onCheckedChange={(c) => onPreserveOriginalPriceChange(!!c)}
              />
              Manter valor original (não recalcular com regras atuais)
            </label>
          )}
          <div className="flex gap-3 ml-auto">
            {canPrev ? (
              <Button type="button" variant="outline" onClick={handlePrev}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            )}
            {canNext ? (
              <Button type="button" onClick={handleNext}>
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                data-testid="wizard-submit"
                onClick={handleSubmitClick}
                disabled={!canSubmit}
              >
                {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Cotação'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
