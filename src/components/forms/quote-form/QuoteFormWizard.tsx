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

const STEPS = [
  { id: 'identification', label: 'Identificação' },
  { id: 'cargo', label: 'Carga e Logística' },
  { id: 'pricing', label: 'Composição Financeira' },
  { id: 'review', label: 'Revisão' },
] as const;

const STEP_FIELDS: (keyof QuoteFormData)[][] = [
  ['client_name', 'origin', 'destination'],
  [
    'cargo_type',
    'weight',
    'volume',
    'freight_modality',
    'price_table_id',
    'vehicle_type_id',
    'payment_term_id',
    'km_distance',
  ],
  ['toll', 'cargo_value', 'notes'],
  [],
];

interface QuoteFormWizardProps {
  form: UseFormReturn<QuoteFormData>;
  onSubmit: (data: QuoteFormData) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
  isEditing: boolean;
  isLoading: boolean;
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
  paymentTerms: { id: string; name: string; adjustment_percent?: number | null }[];
  weightUnit: 'kg' | 'ton';
  setWeightUnit: (unit: 'kg' | 'ton') => void;
  // Pricing step
  isCalculationStale: boolean;
  formatCurrency: (v: number) => string;
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
}

export function QuoteFormWizard({
  form,
  onSubmit,
  onClose,
  onDelete,
  isEditing,
  isLoading,
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
  formatCurrency,
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
}: QuoteFormWizardProps) {
  const [step, setStep] = useState(0);
  const canNext = step < STEPS.length - 1;
  const canPrev = step > 0;

  const handleNext = async () => {
    const fields = STEP_FIELDS[step];
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
    form.handleSubmit(onSubmit)();
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium',
                i < step
                  ? 'bg-primary text-primary-foreground'
                  : i === step
                    ? 'border-2 border-primary text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'text-sm hidden sm:inline',
                i === step ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <IdentificationStep
          form={form}
          clients={clients}
          shippers={shippers}
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
          vehicleTypes={vehicleTypes}
          paymentTerms={paymentTerms}
          weightUnit={weightUnit}
          setWeightUnit={setWeightUnit}
        />
      )}
      {step === 2 && (
        <PricingStep
          form={form}
          calculationResult={calculationResult}
          isCalculationStale={isCalculationStale}
          formatCurrency={formatCurrency}
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
        />
      )}

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t">
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
            <Button type="button" onClick={handleSubmitClick} disabled={isLoading}>
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Cotação'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
