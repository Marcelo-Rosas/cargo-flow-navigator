import { useState, useMemo } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import {
  useRiskPolicies,
  useRiskPolicyRules,
  useRiskEvaluationByEntity,
  useRiskEvidence,
  useRiskServicesCatalog,
  useUpdateRiskEvaluation,
  useEvaluateRisk,
  useBuonnyCheck,
  evaluateCriticality,
} from '@/hooks/useRiskEvaluation';
import { CRITICALITY_CONFIG, REQUIREMENT_LABELS, type RiskCriticality } from '@/types/risk';

interface RiskWorkflowWizardProps {
  orderId: string;
  orderStage: string;
  cargoValue: number;
  kmDistance: number;
  driverName?: string | null;
  driverCpf?: string | null;
  vehiclePlate?: string | null;
  tripId?: string | null;
}

const STEPS = [
  { key: 'buonny', label: 'Buonny', short: '1' },
  { key: 'rules', label: 'Criticidade', short: '2' },
  { key: 'evidence', label: 'Evidências', short: '3' },
  { key: 'submit', label: 'Enviar', short: '4' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

export function RiskWorkflowWizard({
  orderId,
  orderStage,
  cargoValue,
  kmDistance,
  driverName,
  driverCpf,
  vehiclePlate,
  tripId,
}: RiskWorkflowWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepKey>('buonny');
  const [notes, setNotes] = useState('');

  const { data: policies } = useRiskPolicies();
  const activePolicy = policies?.[0];
  const { data: rules } = useRiskPolicyRules(activePolicy?.id);
  const { data: evaluation } = useRiskEvaluationByEntity('order', orderId);
  const { data: evidence } = useRiskEvidence(evaluation?.id);
  const { data: servicesCatalog } = useRiskServicesCatalog();

  const evaluateRisk = useEvaluateRisk();
  const buonnyCheck = useBuonnyCheck();
  const updateEvaluation = useUpdateRiskEvaluation();

  const isEditable = orderStage === 'documentacao';
  const isTerminal = evaluation?.status === 'approved' || evaluation?.status === 'rejected';

  // Evaluate criticality from rules
  const critResult = useMemo(() => {
    if (!rules?.length) return null;
    return evaluateCriticality(rules, cargoValue, kmDistance);
  }, [rules, cargoValue, kmDistance]);

  // Check Buonny evidence
  const buonnyEvidence = evidence?.find(
    (e) => e.evidence_type === 'buonny_check' && e.status === 'valid'
  );
  const buonnyValid =
    buonnyEvidence && buonnyEvidence.expires_at
      ? new Date(buonnyEvidence.expires_at) > new Date()
      : false;

  // Requirements met status
  const requirementsMet = evaluation?.requirements_met ?? {};
  const requirements = evaluation?.requirements ?? critResult?.requirements ?? [];
  const allMet = requirements.length === 0 || requirements.every((r) => requirementsMet[r]);

  // Estimated costs
  const estimatedCosts = useMemo(() => {
    if (!servicesCatalog?.length || !critResult) return [];
    return servicesCatalog
      .filter((s) => {
        if (s.required_when === 'always') return true;
        if (s.required_when === 'high_critical')
          return critResult.criticality === 'HIGH' || critResult.criticality === 'CRITICAL';
        return critResult.requirements.includes(s.code.toLowerCase());
      })
      .map((s) => ({ code: s.code, name: s.name, cost: s.unit_cost }));
  }, [servicesCatalog, critResult]);

  const totalEstimatedCost = estimatedCosts.reduce((sum, c) => sum + c.cost, 0);

  // Step completion checks
  const step1Complete = buonnyValid;
  const step2Complete = !!evaluation;
  const step3Complete = step2Complete && allMet;

  // Handlers
  const handleCreateEvaluation = async () => {
    await evaluateRisk.mutateAsync({
      order_id: orderId,
      trip_id: tripId ?? undefined,
    });
  };

  const handleBuonnyCheck = async () => {
    if (!driverCpf) return;
    await buonnyCheck.mutateAsync({
      driver_cpf: driverCpf,
      driver_name: driverName ?? undefined,
      vehicle_plate: vehiclePlate ?? undefined,
      evaluation_id: evaluation?.id,
    });
  };

  const handleToggleRequirement = async (req: string, met: boolean) => {
    if (!evaluation) return;
    await updateEvaluation.mutateAsync({
      id: evaluation.id,
      requirements_met: { ...requirementsMet, [req]: met },
    });
  };

  const handleSubmit = async () => {
    if (!evaluation) return;
    const crit = evaluation.criticality ?? critResult?.criticality;
    const canAutoApprove =
      (crit === 'LOW' || crit === 'MEDIUM') && requirements.length <= 2 && allMet && buonnyValid;

    await updateEvaluation.mutateAsync({
      id: evaluation.id,
      status: canAutoApprove ? 'approved' : 'evaluated',
      evaluation_notes: canAutoApprove
        ? notes || 'Auto-aprovado (LOW/MEDIUM com requisitos atendidos)'
        : notes || undefined,
    });
  };

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  // Terminal state display
  if (isTerminal && evaluation) {
    const approved = evaluation.status === 'approved';
    return (
      <Card className={cn('border-2', approved ? 'border-green-500/30' : 'border-red-500/30')}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {approved ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Avaliação de Risco {approved ? 'Aprovada' : 'Rejeitada'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Criticidade:</span>
            <RiskCriticalityBadge criticality={evaluation.criticality} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Valor avaliado:</span>
            <span className="font-medium">
              {formatCurrency(evaluation.cargo_value_evaluated ?? 0)}
            </span>
          </div>
          {evaluation.evaluation_notes && (
            <div className="p-2 rounded bg-muted text-xs">{evaluation.evaluation_notes}</div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stepper — read-only indicators, not clickable */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isActive = step.key === currentStep;
          const isPast = i < stepIndex;
          const isComplete =
            (i === 0 && step1Complete) ||
            (i === 1 && step2Complete) ||
            (i === 2 && step3Complete) ||
            (i === 3 && (evaluation?.status === 'evaluated' || evaluation?.status === 'approved'));
          return (
            <div key={step.key} className="flex items-center gap-1">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  isActive && 'bg-primary text-primary-foreground',
                  isPast && !isActive && 'bg-primary/20 text-primary',
                  !isActive && !isPast && 'bg-muted text-muted-foreground'
                )}
                data-testid={`risk-wizard-step-${step.key}`}
              >
                {isComplete && !isActive ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <span>{step.short}</span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 'buonny' && (
            <StepBuonny
              driverName={driverName}
              driverCpf={driverCpf}
              vehiclePlate={vehiclePlate}
              buonnyEvidence={buonnyEvidence}
              buonnyValid={buonnyValid}
              isEditable={isEditable}
              onSimulate={handleBuonnyCheck}
              isLoading={buonnyCheck.isPending}
              canAdvance={step1Complete}
              onNext={() => setCurrentStep('rules')}
            />
          )}
          {currentStep === 'rules' && (
            <StepRules
              critResult={critResult}
              cargoValue={cargoValue}
              kmDistance={kmDistance}
              evaluation={evaluation}
              isEditable={isEditable}
              onCreateEvaluation={handleCreateEvaluation}
              isLoading={evaluateRisk.isPending}
              canAdvance={step2Complete}
              onNext={() => setCurrentStep('evidence')}
              onBack={() => setCurrentStep('buonny')}
            />
          )}
          {currentStep === 'evidence' && (
            <StepEvidence
              requirements={requirements}
              requirementsMet={requirementsMet}
              isEditable={isEditable}
              onToggle={handleToggleRequirement}
              estimatedCosts={estimatedCosts}
              totalEstimatedCost={totalEstimatedCost}
              canAdvance={step3Complete}
              onNext={() => setCurrentStep('submit')}
              onBack={() => setCurrentStep('rules')}
            />
          )}
          {currentStep === 'submit' && (
            <StepSubmit
              evaluation={evaluation}
              critResult={critResult}
              allMet={allMet}
              buonnyValid={buonnyValid}
              cargoValue={cargoValue}
              totalEstimatedCost={totalEstimatedCost}
              notes={notes}
              onNotesChange={setNotes}
              isEditable={isEditable}
              onSubmit={handleSubmit}
              isLoading={updateEvaluation.isPending}
              onBack={() => setCurrentStep('evidence')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────

export function RiskCriticalityBadge({ criticality }: { criticality: RiskCriticality }) {
  const config = CRITICALITY_CONFIG[criticality];
  return (
    <Badge variant={config.badgeVariant} data-testid="risk-criticality-badge">
      <Shield className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// Step 1: Buonny
function StepBuonny({
  driverName,
  driverCpf,
  vehiclePlate,
  buonnyEvidence,
  buonnyValid,
  isEditable,
  onSimulate,
  isLoading,
  canAdvance,
  onNext,
}: {
  driverName?: string | null;
  driverCpf?: string | null;
  vehiclePlate?: string | null;
  buonnyEvidence: ReturnType<typeof Array.prototype.find>;
  buonnyValid: boolean;
  isEditable: boolean;
  onSimulate: () => void;
  isLoading: boolean;
  canAdvance: boolean;
  onNext: () => void;
}) {
  const payload = (buonnyEvidence as { payload?: Record<string, unknown> })?.payload;
  return (
    <div className="space-y-4" data-testid="risk-step-buonny">
      <h3 className="font-semibold">Passo 1: Verificação Buonny</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Motorista:</span>{' '}
          <span className="font-medium">{driverName ?? 'Não atribuído'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">CPF:</span>{' '}
          <span className="font-medium">{driverCpf ?? '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Veículo:</span>{' '}
          <span className="font-medium">{vehiclePlate ?? '—'}</span>
        </div>
      </div>

      {buonnyEvidence ? (
        <div
          className={cn(
            'rounded-lg border p-3 space-y-1 text-sm',
            buonnyValid
              ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
              : 'border-red-200 bg-red-50 dark:bg-red-950/20'
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            {buonnyValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            Buonny: {buonnyValid ? 'Válido' : 'Expirado'}
          </div>
          {payload && (
            <>
              <div className="text-muted-foreground">
                Consulta ID: {String(payload.consulta_id ?? '—')}
              </div>
              <div className="text-muted-foreground">
                Cadastro: {payload.cadastro ? 'Sim' : 'Não'}
              </div>
              <div className="text-muted-foreground">
                Monitoramento: {payload.monitoramento ? 'Ativo' : 'Não ativo'}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma consulta Buonny registrada
        </div>
      )}

      <div className="flex justify-between">
        {isEditable && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSimulate}
            disabled={isLoading || buonnyValid || !driverCpf}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Consultando...
              </>
            ) : buonnyValid ? (
              'Consulta válida'
            ) : !driverCpf ? (
              'CPF não informado'
            ) : (
              'Consultar Buonny'
            )}
          </Button>
        )}
        <Button size="sm" onClick={onNext} disabled={!canAdvance} className="ml-auto">
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!canAdvance && isEditable && (
        <p className="text-xs text-muted-foreground">Execute a consulta Buonny para avançar.</p>
      )}
    </div>
  );
}

// Step 2: Rules & Criticality
function StepRules({
  critResult,
  cargoValue,
  kmDistance,
  evaluation,
  isEditable,
  onCreateEvaluation,
  isLoading,
  canAdvance,
  onNext,
  onBack,
}: {
  critResult: ReturnType<typeof evaluateCriticality> | null;
  cargoValue: number;
  kmDistance: number;
  evaluation: unknown;
  isEditable: boolean;
  onCreateEvaluation: () => void;
  isLoading: boolean;
  canAdvance: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="risk-step-rules">
      <h3 className="font-semibold">Passo 2: Criticidade</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Valor da carga:</span>{' '}
          <span className="font-medium">{formatCurrency(cargoValue)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Distância:</span>{' '}
          <span className="font-medium">{kmDistance.toLocaleString('pt-BR')} km</span>
        </div>
      </div>

      {critResult && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Resultado:</span>
            <RiskCriticalityBadge criticality={critResult.criticality} />
          </div>
          {critResult.matchedRules.length > 0 && (
            <div className="space-y-1 text-xs">
              <span className="font-medium text-muted-foreground">Regras aplicadas:</span>
              {critResult.matchedRules.map((r) => (
                <div key={r.id} className="pl-3 text-muted-foreground">
                  • {r.description ?? r.trigger_type}
                  {r.criticality_boost > 0
                    ? ` (+${r.criticality_boost} nível)`
                    : ` → ${r.criticality}`}
                </div>
              ))}
            </div>
          )}
          {critResult.requirements.length > 0 && (
            <div className="space-y-1 text-xs">
              <span className="font-medium text-muted-foreground">Exigências:</span>
              {critResult.requirements.map((req) => (
                <div key={req} className="pl-3 text-muted-foreground">
                  • {REQUIREMENT_LABELS[req] ?? req}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!evaluation && isEditable && critResult && (
        <Button size="sm" onClick={onCreateEvaluation} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Criando...
            </>
          ) : (
            'Criar Avaliação de Risco'
          )}
        </Button>
      )}

      {!evaluation && isEditable && (
        <p className="text-xs text-muted-foreground">Crie a avaliação de risco para avançar.</p>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button size="sm" onClick={onNext} disabled={!canAdvance}>
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Step 3: Evidence & Requirements
function StepEvidence({
  requirements,
  requirementsMet,
  isEditable,
  onToggle,
  estimatedCosts,
  totalEstimatedCost,
  canAdvance,
  onNext,
  onBack,
}: {
  requirements: string[];
  requirementsMet: Record<string, boolean>;
  isEditable: boolean;
  onToggle: (req: string, met: boolean) => void;
  estimatedCosts: { code: string; name: string; cost: number }[];
  totalEstimatedCost: number;
  canAdvance: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="risk-step-evidence">
      <h3 className="font-semibold">Passo 3: Evidências e Exigências</h3>

      {requirements.length > 0 ? (
        <div className="space-y-2">
          {requirements.map((req) => {
            const met = requirementsMet[req] ?? false;
            return (
              <label
                key={req}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md border cursor-pointer text-sm transition-colors',
                  met ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-muted'
                )}
              >
                <input
                  type="checkbox"
                  checked={met}
                  onChange={(e) => isEditable && onToggle(req, e.target.checked)}
                  disabled={!isEditable}
                  className="h-4 w-4 rounded"
                />
                <span className={met ? 'line-through text-muted-foreground' : ''}>
                  {REQUIREMENT_LABELS[req] ?? req}
                </span>
                {met && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma exigência adicional identificada.</p>
      )}

      {estimatedCosts.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Custos Estimados de Risco</h4>
          {estimatedCosts.map((c) => (
            <div key={c.code} className="flex justify-between text-sm">
              <span>{c.name}</span>
              <span className="font-medium tabular-nums">{formatCurrency(c.cost)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold border-t pt-2">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(totalEstimatedCost)}</span>
          </div>
        </div>
      )}

      {!canAdvance && requirements.length > 0 && (
        <p className="text-xs text-muted-foreground">Marque todas as exigências para avançar.</p>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button size="sm" onClick={onNext} disabled={!canAdvance}>
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Step 4: Review & Submit
function StepSubmit({
  evaluation,
  critResult,
  allMet,
  buonnyValid,
  cargoValue,
  totalEstimatedCost,
  notes,
  onNotesChange,
  isEditable,
  onSubmit,
  isLoading,
  onBack,
}: {
  evaluation: unknown;
  critResult: ReturnType<typeof evaluateCriticality> | null;
  allMet: boolean;
  buonnyValid: boolean;
  cargoValue: number;
  totalEstimatedCost: number;
  notes: string;
  onNotesChange: (v: string) => void;
  isEditable: boolean;
  onSubmit: () => void;
  isLoading: boolean;
  onBack: () => void;
}) {
  const eval_ = evaluation as { status?: string; criticality?: RiskCriticality } | null;
  const canSubmit =
    !!evaluation &&
    buonnyValid &&
    allMet &&
    isEditable &&
    eval_?.status !== 'evaluated' &&
    eval_?.status !== 'approved';
  const isSubmitted = eval_?.status === 'evaluated';
  const isAutoApproved = eval_?.status === 'approved';
  const willAutoApprove =
    critResult &&
    (critResult.criticality === 'LOW' || critResult.criticality === 'MEDIUM') &&
    allMet &&
    buonnyValid;

  return (
    <div className="space-y-4" data-testid="risk-step-submit">
      <h3 className="font-semibold">Passo 4: Revisão e Envio</h3>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          {buonnyValid ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span>Consulta Buonny</span>
        </div>
        <div className="flex items-center gap-2">
          {allMet ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          <span>Exigências atendidas</span>
        </div>
        <div className="flex items-center gap-2">
          {evaluation ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span>Avaliação de criticidade</span>
        </div>
      </div>

      {critResult && (
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div>
            <span className="text-muted-foreground">Criticidade: </span>
            <RiskCriticalityBadge criticality={critResult.criticality} />
          </div>
          <div>
            <span className="text-muted-foreground">Valor: </span>
            <span className="font-medium">{formatCurrency(cargoValue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Custo risco: </span>
            <span className="font-medium">{formatCurrency(totalEstimatedCost)}</span>
          </div>
        </div>
      )}

      {isEditable && !isSubmitted && !isAutoApproved && (
        <Textarea
          placeholder="Notas para o aprovador (opcional)"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
        />
      )}

      {isAutoApproved && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Avaliação auto-aprovada (criticidade baixa/média com requisitos atendidos).
        </div>
      )}

      {isSubmitted && !isAutoApproved && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-blue-600" />
          Avaliação enviada. Aguardando aprovação gerencial.
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        {isEditable && !isSubmitted && !isAutoApproved && (
          <Button size="sm" onClick={onSubmit} disabled={!canSubmit || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Enviando...
              </>
            ) : willAutoApprove ? (
              'Aprovar Automaticamente'
            ) : (
              'Enviar para Aprovação'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
