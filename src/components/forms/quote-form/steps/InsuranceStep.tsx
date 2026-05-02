import type { UseFormReturn } from 'react-hook-form';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { SectionBlock } from '@/components/ui/section-block';
import {
  calculatePremium,
  validateCoverage,
  validateValidity,
  type RiskPolicy,
} from '@/hooks/useRiskPolicies';
import type { InsuranceOption } from '@/hooks/useInsuranceOptionsRefactored';
import type { BuonnyError } from '@/lib/errors/BuonnyError';
import { InsuranceSelectorLazy } from '@/components/insurance/InsuranceSelectorLazy';
import { InsuranceSummary } from '@/components/insurance/InsuranceSummary';
import { formatCurrency } from '@/lib/formatters';
import type { QuoteFormData } from '../types';

interface InsuranceStepProps {
  form: UseFormReturn<QuoteFormData>;
  activePolicies: RiskPolicy[];
  loadingPolicies: boolean;
  insuranceOptions: InsuranceOption[];
  isLoadingOptions: boolean;
  optionsError: BuonnyError | null;
  selectedOption: InsuranceOption | null;
  setSelectedOption: (option: InsuranceOption | null) => void;
  originUf: string;
  destinationUf: string;
}

/**
 * Formata taxa de prêmio para exibição (ex: "0,015% ad valorem")
 */
function formatPremiumRate(policy: RiskPolicy): string {
  const rate =
    (policy.metadata?.premium_rate_percent as number) ??
    (policy.metadata?.ad_valorem_rate_percent as number) ??
    0.015;
  return `${rate.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 })}% ad valorem`;
}

/**
 * Formata data ISO para dd/mm/aaaa
 */
function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// MandatoryPolicyCard — card read-only para cada apólice obrigatória
// ---------------------------------------------------------------------------

interface MandatoryPolicyCardProps {
  policy: RiskPolicy;
  cargoValue: number;
}

function MandatoryPolicyCard({ policy, cargoValue }: MandatoryPolicyCardProps) {
  const premium = calculatePremium(policy, cargoValue);
  const coverage = validateCoverage(policy, cargoValue);
  const validity = validateValidity(policy);
  const hasIssue = !coverage.ok || !validity.ok;

  return (
    <Card
      className={`bg-muted/30 border rounded-lg p-4 ${
        hasIssue ? 'border-destructive/50' : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{policy.policy_type}</span>
          <Badge
            variant="default"
            className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-1.5 py-0"
          >
            Obrigatório
          </Badge>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Apólice</span>
          <p className="font-medium">{policy.code}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Seguradora</span>
          <p className="font-medium">{policy.insurer || '—'}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Limite de cobertura</span>
          <p className="font-medium">{formatCurrency(policy.coverage_limit)}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Prêmio estimado</span>
          <p className="font-medium">{formatCurrency(premium)}</p>
          <span className="text-muted-foreground text-xs">{formatPremiumRate(policy)}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Vigência</span>
          <p className="font-medium">
            {formatDateShort(policy.valid_from)} — {formatDateShort(policy.valid_until)}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Gerenciadora de Risco</span>
          <p className="font-medium">{policy.risk_manager || '—'}</p>
        </div>
      </div>

      {/* Inline warnings */}
      {!validity.ok && (
        <div className="mt-2 flex items-center gap-1.5 text-destructive text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{validity.message}</span>
        </div>
      )}
      {!coverage.ok && (
        <div className="mt-2 flex items-center gap-1.5 text-destructive text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{coverage.message}</span>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// InsuranceStep — step principal
// ---------------------------------------------------------------------------

export function InsuranceStep({
  form,
  activePolicies,
  loadingPolicies,
  insuranceOptions,
  isLoadingOptions,
  optionsError,
  selectedOption,
  setSelectedOption,
  originUf,
  destinationUf,
}: InsuranceStepProps) {
  const cargoValue = form.watch('cargo_value') || 0;

  // ---------- Mandatory policies from risk_policies ----------
  const mandatoryPolicies = useMemo(
    () => activePolicies.filter((p) => p.policy_type === 'RCTR-C' || p.policy_type === 'RC-DC'),
    [activePolicies]
  );

  // Aggregate validations
  const allCoverageOk = useMemo(
    () => mandatoryPolicies.every((p) => validateCoverage(p, cargoValue).ok),
    [mandatoryPolicies, cargoValue]
  );

  const allValidityOk = useMemo(
    () => mandatoryPolicies.every((p) => validateValidity(p).ok),
    [mandatoryPolicies]
  );

  const totalPremium = useMemo(
    () => mandatoryPolicies.reduce((sum, p) => sum + calculatePremium(p, cargoValue), 0),
    [mandatoryPolicies, cargoValue]
  );

  // ---------- Optional Buonny insurance (existing flow) ----------
  const insuranceEligible = form.watch('insurance_eligible') ?? false;
  const insuranceCoverageType = form.watch('insurance_coverage_type');

  // Hydrate selectedOption from saved form value once (edit mode).
  // Uses a ref guard so it fires only once per mount, avoiding a bidirectional loop.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!insuranceOptions.length || !insuranceCoverageType) return;
    const matching = insuranceOptions.find((opt) => opt.coverage_type === insuranceCoverageType);
    if (matching) {
      setSelectedOption(matching);
      hydratedRef.current = true;
    }
  }, [insuranceOptions, insuranceCoverageType, setSelectedOption]);

  // Unidirectional sync: state → form (normal selection path)
  useEffect(() => {
    if (selectedOption) {
      form.setValue('insurance_coverage_type', selectedOption.coverage_type);
      form.setValue('insurance_estimated_premium', selectedOption.estimated_premium);
      form.setValue('insurance_eligible', true);
      form.setValue('insurance_status', 'pending');
    }
  }, [selectedOption, form]);

  const handleSelectCoverage = useCallback(
    (coverageType: string) => {
      const option = insuranceOptions.find((opt) => opt.coverage_type === coverageType);
      if (option) {
        setSelectedOption(option);
      }
    },
    [insuranceOptions, setSelectedOption]
  );

  // ---------- Render ----------
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Shield className="w-4 h-4" /> Seguro de Carga
        </p>
      </div>

      {/* ===== MANDATORY POLICIES SECTION ===== */}
      <SectionBlock label="Apólices Obrigatórias (RCTR-C / RC-DC)">
        <p className="text-xs text-muted-foreground mb-3">
          Seguros obrigatórios por lei para transporte rodoviário de cargas (RCTR-C e RC-DC). As
          apólices abaixo são aplicadas automaticamente.
        </p>

        {loadingPolicies && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin">
              <Shield className="w-6 h-6 text-primary" />
            </div>
          </div>
        )}

        {!loadingPolicies && mandatoryPolicies.length === 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma apólice obrigatória (RCTR-C / RC-DC) ativa encontrada. Configure as apólices
              na Central de Riscos antes de prosseguir.
            </AlertDescription>
          </Alert>
        )}

        {!loadingPolicies && mandatoryPolicies.length > 0 && (
          <>
            {/* Policy cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {mandatoryPolicies.map((policy) => (
                <MandatoryPolicyCard key={policy.id} policy={policy} cargoValue={cargoValue} />
              ))}
            </div>

            {/* Coverage validation alerts */}
            {!allValidityOk && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Apólice vencida — verifique a vigência na Central de Riscos.
                </AlertDescription>
              </Alert>
            )}

            {!allCoverageOk && allValidityOk && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Valor da carga excede o limite de cobertura de uma ou mais apólices. Verifique o
                  valor declarado ou solicite endosso à seguradora.
                </AlertDescription>
              </Alert>
            )}

            {allCoverageOk && allValidityOk && (
              <Alert className="mt-4 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Cobertura ativa e compatível com o valor da carga.
                </AlertDescription>
              </Alert>
            )}

            {/* Total premium summary */}
            <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Total de prêmio estimado (apólices obrigatórias)
              </span>
              <span className="text-sm font-bold">{formatCurrency(totalPremium)}</span>
            </div>
          </>
        )}
      </SectionBlock>

      {/* ===== OPTIONAL ADDITIONAL COVERAGE ===== */}
      <Separator />

      <SectionBlock label="Cobertura Adicional (opcional)">
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
                  Cobertura adicional além das apólices vigentes
                </FormLabel>
              </FormItem>
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Cotação complementar via gerenciadora de risco (Buonny). Aplicável para cargas com
          requisitos especiais de seguro.
        </p>
      </SectionBlock>

      {/* Optional insurance selector (visible when checkbox is checked) */}
      {insuranceEligible && (
        <SectionBlock label="Nível de Cobertura Adicional" className="space-y-4">
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

            {!isLoadingOptions && insuranceOptions.length === 0 && !optionsError && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma opção de cobertura adicional disponível para esta rota ({originUf || '?'}{' '}
                  → {destinationUf || '?'}).
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Insurance Summary (inline mode) */}
          {selectedOption && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-sm mb-4">Resumo da Cobertura Adicional</h3>
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
            O valor do prêmio adicional é uma estimativa. A cotação final será confirmada pela
            Buonny após análise da documentação.
          </AlertDescription>
        </Alert>
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
