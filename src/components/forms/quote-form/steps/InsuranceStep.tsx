import type { UseFormReturn } from 'react-hook-form';
import { useCallback, useEffect, useMemo } from 'react';
import { AlertCircle, Shield } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { SectionBlock } from '@/components/ui/section-block';
import { useInsuranceOptions } from '@/hooks/useInsuranceOptionsRefactored';
import { InsuranceSelectorLazy } from '@/components/insurance/InsuranceSelectorLazy';
import { InsuranceSummary } from '@/components/insurance/InsuranceSummary';
import type { QuoteFormData } from '../types';

interface InsuranceStepProps {
  form: UseFormReturn<QuoteFormData>;
}

/**
 * Extrai UF de uma string "CITY, UF" ou "UF"
 */
function extractUf(location: string): string {
  if (!location) return '';
  const ufMatch = location.match(/([A-Z]{2})$/);
  return ufMatch ? ufMatch[1] : '';
}

export function InsuranceStep({ form }: InsuranceStepProps) {
  const originUf = useMemo(() => extractUf(form.watch('origin') || ''), [form]);
  const destinationUf = useMemo(() => extractUf(form.watch('destination') || ''), [form]);
  const weight = form.watch('weight') || 0;
  const cargoType = form.watch('cargo_type') || 'general';

  // Fetch insurance options from Buonny via useInsuranceOptions hook
  const {
    data: insuranceOptions = [],
    isLoading: isLoadingOptions,
    error: optionsError,
    selectedOption,
    setSelectedOption,
  } = useInsuranceOptions({
    origin_uf: originUf,
    destination_uf: destinationUf,
    weight,
    product_type: cargoType,
  });

  // Watch form field for insurance_coverage_type
  const insuranceCoverageType = form.watch('insurance_coverage_type');

  // Sync form value with selectedOption when coverage changes
  useEffect(() => {
    if (insuranceCoverageType) {
      const matching = insuranceOptions.find((opt) => opt.coverage_type === insuranceCoverageType);
      if (matching) {
        setSelectedOption(matching);
      }
    }
  }, [insuranceCoverageType, insuranceOptions, setSelectedOption]);

  // Update form when selectedOption changes
  useEffect(() => {
    if (selectedOption) {
      form.setValue('insurance_coverage_type', selectedOption.coverage_type);
      form.setValue('insurance_estimated_premium', selectedOption.estimated_premium);
      form.setValue('insurance_eligible', true);
      form.setValue('insurance_status', 'pending');
    }
  }, [selectedOption, form]);

  // Check eligibility based on origin/destination
  const isEligible = originUf && destinationUf && insuranceOptions.length > 0;
  const insuranceEligible = form.watch('insurance_eligible') ?? false;

  /**
   * Memoized callback for handling coverage selection
   * Phase D Optimization: Prevents creating new function on every render
   */
  const handleSelectCoverage = useCallback(
    (coverageType: string) => {
      const option = insuranceOptions.find((opt) => opt.coverage_type === coverageType);
      if (option) {
        setSelectedOption(option);
      }
    },
    [insuranceOptions, setSelectedOption]
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Shield className="w-4 h-4" /> Seguro de Carga
        </p>
      </div>

      {/* Elegibilidade de Seguro */}
      {!isEligible && (originUf || destinationUf) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Seguro indisponível para esta rota ({originUf || '?'} → {destinationUf || '?'}).
            Verifique origem e destino.
          </AlertDescription>
        </Alert>
      )}

      {isEligible && (
        <>
          {/* Checkbox: Incluir Seguro */}
          <SectionBlock label="Proteção de Carga">
            <div className="flex items-center space-x-2">
              <FormField
                control={form.control}
                name="insurance_eligible"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-medium cursor-pointer mb-0">
                      Incluir seguro de carga na cotação
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Proteção contra danos, roubo e avarias durante o transporte.
            </p>
          </SectionBlock>

          {/* Insurance Selector (visible if checked) */}
          {insuranceEligible && (
            <SectionBlock label="Nível de Cobertura" className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-4">Selecione o nível de cobertura</h3>

                {isLoadingOptions && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                )}

                {optionsError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Erro ao carregar opções de seguro. Tente novamente.
                    </AlertDescription>
                  </Alert>
                )}

                {!isLoadingOptions && insuranceOptions.length > 0 && (
                  <FormField
                    control={form.control}
                    name="insurance_coverage_type"
                    render={() => (
                      <FormItem>
                        <FormControl>
                          <InsuranceSelectorLazy
                            options={insuranceOptions}
                            selectedCoverage={selectedOption?.coverage_type}
                            onSelectCoverage={handleSelectCoverage}
                            loading={isLoadingOptions}
                            error={optionsError ? 'Erro ao carregar opções' : undefined}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Insurance Summary (inline mode) */}
              {selectedOption && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold text-sm mb-4">Resumo da Cobertura</h3>
                  <InsuranceSummary
                    coverage={selectedOption.coverage_type}
                    premium={selectedOption.estimated_premium}
                    features={selectedOption.features || []}
                    restrictions={selectedOption.restrictions || []}
                    status="pending"
                    compact={false}
                  />
                </div>
              )}
            </SectionBlock>
          )}

          {/* Info: Premium is estimated */}
          {insuranceEligible && selectedOption && (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-600 dark:text-blue-400 text-xs">
                O valor do prêmio é uma estimativa. A cotação final será confirmada pela Buonny após
                análise da documentação.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Hidden form fields for insurance data (synced from selectedOption) */}
      <FormField
        control={form.control}
        name="insurance_coverage_type"
        render={({ field }) => <input type="hidden" {...field} />}
      />
      <FormField
        control={form.control}
        name="insurance_estimated_premium"
        render={({ field }) => <input type="hidden" {...field} value={field.value || ''} />}
      />
    </div>
  );
}
