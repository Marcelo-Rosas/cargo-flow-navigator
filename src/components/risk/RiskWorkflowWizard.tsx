import { useState, useMemo, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBuonnyProfessionalCheck } from '@/hooks/useBuonnyProfessionalCheck';
import { useAnttRntrcCheck } from '@/hooks/useAnttRntrcCheck';
import { supabase } from '@/integrations/supabase/client';
import {
  useActivePolicies,
  useDriverActiveExposure,
  validateCoverage,
  validateValidity,
  calculatePremium,
} from '@/hooks/useRiskPolicies';
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
  useAddRiskEvidence,
  evaluateCriticality,
} from '@/hooks/useRiskEvaluation';
import { CRITICALITY_CONFIG, REQUIREMENT_LABELS, type RiskCriticality } from '@/types/risk';
import { BuonnyRegistrationModal, type BuonnyRegistrationData } from './BuonnyRegistrationModal';
import type { RiskEvidence } from '@/types/risk';

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function normalizePlate(s: string): string {
  return s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

interface RiskWorkflowWizardProps {
  orderId: string;
  orderStage: string;
  cargoValue: number;
  kmDistance: number;
  driverName?: string | null;
  driverCpf?: string | null;
  vehiclePlate?: string | null;
  vehicleTypeName?: string | null;
  tripId?: string | null;
  originUf?: string;
  destinationUf?: string;
}

const STEPS = [
  { key: 'antt', label: 'ANTT', short: '1' },
  { key: 'buonny', label: 'Buonny', short: '2' },
  { key: 'rules', label: 'Criticidade', short: '3' },
  { key: 'evidence', label: 'Evidências', short: '4' },
  { key: 'submit', label: 'Enviar', short: '5' },
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
  vehicleTypeName,
  tripId,
  originUf = 'SC',
  destinationUf = 'SP',
}: RiskWorkflowWizardProps) {
  const qc = useQueryClient();
  const [currentStep, setCurrentStep] = useState<StepKey>('antt');
  const [notes, setNotes] = useState('');

  const { data: policies } = useRiskPolicies();
  const activePolicy = policies?.[0];
  const { data: rules } = useRiskPolicyRules(activePolicy?.id);
  const { data: activePolicies = [] } = useActivePolicies();

  // Busca dados do motorista/veículo direto da OS quando os props chegam nulos
  // (janela de propagação após "Aplicar à OS" antes do refetch do componente pai)
  const { data: driverRecord } = useQuery({
    queryKey: ['wizard-driver-cpf', orderId],
    enabled: !driverCpf || !vehiclePlate || !driverName,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select(
          'driver_id, driver_name, vehicle_plate, vehicle_type_name, drivers!orders_driver_id_fkey(cpf, antt)'
        )
        .eq('id', orderId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return {
        cpf: (d?.drivers?.cpf as string | null) ?? null,
        antt: (d?.drivers?.antt as string | null) ?? null,
        driver_id: (d?.driver_id as string | null) ?? null,
        driver_name: (d?.driver_name as string | null) ?? null,
        vehicle_plate: (d?.vehicle_plate as string | null) ?? null,
        vehicle_type_name: (d?.vehicle_type_name as string | null) ?? null,
      };
    },
  });

  const resolvedDriverCpf = driverCpf || driverRecord?.cpf || undefined;
  const resolvedDriverAntt = driverRecord?.antt || undefined;
  const resolvedDriverId = driverRecord?.driver_id ?? null;
  const resolvedDriverName = driverName || driverRecord?.driver_name || undefined;
  const resolvedVehiclePlate = vehiclePlate || driverRecord?.vehicle_plate || undefined;
  const resolvedVehicleTypeName = vehicleTypeName || driverRecord?.vehicle_type_name || undefined;

  const { data: vehicleData } = useQuery({
    queryKey: ['wizard-vehicle-data', resolvedVehiclePlate],
    enabled: !!resolvedVehiclePlate,
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('renavam, owners!vehicles_owner_id_fkey(cpf_cnpj, cpf_cnpj_mask, name)')
        .eq('plate', resolvedVehiclePlate!)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return {
        renavam: (d?.renavam as string | null) ?? null,
        ownerCpfCnpj: (d?.owners?.cpf_cnpj as string | null) ?? null,
        ownerCpfCnpjMask: (d?.owners?.cpf_cnpj_mask as string | null) ?? null,
        ownerName: (d?.owners?.name as string | null) ?? null,
      };
    },
  });

  const vehicleRenavam = vehicleData?.renavam ?? null;
  const ownerCpfCnpj = vehicleData?.ownerCpfCnpj ?? null;

  // When motorista ≠ proprietário, use owner's CPF/CNPJ for ANTT lookup
  // (RNTRC is registered under the vehicle owner, not the driver)
  const driverOnlyDigits = onlyDigits(resolvedDriverCpf ?? '');
  const ownerOnlyDigits = onlyDigits(ownerCpfCnpj ?? '');
  const isDriverSameAsOwner =
    !!driverOnlyDigits && !!ownerOnlyDigits && driverOnlyDigits === ownerOnlyDigits;
  const anttCpfCnpj = !isDriverSameAsOwner && ownerCpfCnpj ? ownerCpfCnpj : resolvedDriverCpf;

  const { data: driverExposure } = useDriverActiveExposure(resolvedDriverId, orderId);

  const policyChecks = useMemo(
    () =>
      activePolicies.map((p) => ({
        policy: p,
        coverage: validateCoverage(p, cargoValue, { destinationUf }),
        validity: validateValidity(p),
        premium: calculatePremium(p, cargoValue),
      })),
    [activePolicies, cargoValue, destinationUf]
  );

  const aggregateExposureWarning = useMemo(() => {
    if (!driverExposure?.totalOtherOrders || !activePolicies.length) return null;
    const totalExposure = cargoValue + driverExposure.totalOtherOrders;
    const minLimit = Math.min(...activePolicies.map((p) => p.coverage_limit ?? Infinity));
    if (totalExposure > minLimit) {
      return {
        totalExposure,
        limit: minLimit,
        otherOrders: driverExposure.rows,
      };
    }
    return null;
  }, [driverExposure, cargoValue, activePolicies]);

  const coverageOk =
    activePolicies.length === 0 ||
    (policyChecks.every((c) => c.coverage.ok && c.validity.ok) && !aggregateExposureWarning);
  const { data: evaluation } = useRiskEvaluationByEntity('order', orderId);
  const { data: evidence } = useRiskEvidence(evaluation?.id);

  // Fallback: busca evidência Buonny válida em outras avaliações do mesmo driver+placa
  const { data: crossEvidence } = useQuery({
    queryKey: ['buonny-cross-evidence', resolvedDriverCpf, resolvedVehiclePlate],
    enabled: !!resolvedDriverCpf && !!resolvedVehiclePlate,
    queryFn: async () => {
      const { data } = await supabase
        .from('risk_evidence' as 'documents')
        .select('*')
        .eq('evidence_type', 'buonny_check')
        .eq('status', 'valid')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      const rows = (data ?? []) as import('@/types/risk').RiskEvidence[];
      return (
        rows.find((e) => {
          const p = e.payload as Record<string, unknown> | null;
          return p?.driver_cpf === resolvedDriverCpf && p?.vehicle_plate === resolvedVehiclePlate;
        }) ?? null
      );
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: crossAnttEvidence } = useQuery({
    queryKey: ['antt-cross-evidence', resolvedDriverCpf, resolvedVehiclePlate],
    enabled: !!resolvedDriverCpf && !!resolvedVehiclePlate,
    queryFn: async () => {
      const { data } = await supabase
        .from('risk_evidence' as 'documents')
        .select('*')
        .eq('evidence_type', 'antt_rntrc_check')
        .eq('status', 'valid')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      const rows = (data ?? []) as RiskEvidence[];
      const cpfNorm = onlyDigits(resolvedDriverCpf ?? '');
      const plateNorm = normalizePlate(resolvedVehiclePlate ?? '');
      return (
        rows.find((e) => {
          const p = e.payload as Record<string, unknown> | null;
          return (
            p != null &&
            onlyDigits(String(p.cpf_cnpj ?? '')) === cpfNorm &&
            normalizePlate(String(p.vehicle_plate ?? '')) === plateNorm
          );
        }) ?? null
      );
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: servicesCatalog } = useRiskServicesCatalog();

  const evaluateRisk = useEvaluateRisk();
  const addEvidence = useAddRiskEvidence();
  const updateEvaluation = useUpdateRiskEvaluation();
  const [buonnyModalOpen, setBuonnyModalOpen] = useState(false);
  const [anttCheckStage, setAnttCheckStage] = useState<'rntrc' | 'veiculo' | 'ciot' | null>(null);

  const isBuonnyEditable = orderStage === 'busca_motorista' || orderStage === 'documentacao';
  const isEditable = orderStage === 'busca_motorista' || orderStage === 'documentacao';
  const isTerminal = evaluation?.status === 'approved' || evaluation?.status === 'rejected';

  // Evaluate criticality from rules
  const critResult = useMemo(() => {
    if (!rules?.length) return null;
    return evaluateCriticality(rules, cargoValue, kmDistance);
  }, [rules, cargoValue, kmDistance]);

  // Check Buonny evidence — must match current driver CPF and vehicle plate.
  // Falls back to cross-evaluation evidence when this OS has no Buonny check yet.
  const buonnyEvidence = (() => {
    const localMatch = evidence?.find((e) => {
      if (e.evidence_type !== 'buonny_check' || e.status !== 'valid') return false;
      const p = e.payload as Record<string, unknown> | null;
      if (p?.driver_cpf) {
        if (!resolvedDriverCpf || p.driver_cpf !== resolvedDriverCpf) return false;
      }
      if (p?.vehicle_plate) {
        if (!resolvedVehiclePlate || p.vehicle_plate !== resolvedVehiclePlate) return false;
      }
      return true;
    });
    return localMatch ?? crossEvidence ?? undefined;
  })();
  const buonnyValid =
    !!buonnyEvidence && !!buonnyEvidence.expires_at
      ? new Date(buonnyEvidence.expires_at) > new Date()
      : false;

  const anttEvidence = (() => {
    const localMatch = evidence?.find((e) => {
      if (e.evidence_type !== 'antt_rntrc_check' || e.status !== 'valid') return false;
      const p = e.payload as Record<string, unknown> | null;
      if (p?.cpf_cnpj) {
        if (!resolvedDriverCpf || onlyDigits(String(p.cpf_cnpj)) !== onlyDigits(resolvedDriverCpf))
          return false;
      }
      if (p?.vehicle_plate) {
        if (
          !resolvedVehiclePlate ||
          normalizePlate(String(p.vehicle_plate)) !== normalizePlate(resolvedVehiclePlate)
        )
          return false;
      }
      return true;
    });
    return localMatch ?? crossAnttEvidence ?? undefined;
  })();

  const anttValid =
    !!anttEvidence && !!anttEvidence.expires_at && new Date(anttEvidence.expires_at) > new Date();

  useEffect(() => {
    if (currentStep === 'buonny' && !anttValid) {
      setCurrentStep('antt');
    }
  }, [currentStep, anttValid]);

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
  const anttStepComplete = anttValid;
  const buonnyStepComplete = buonnyValid;
  const evalStepComplete = !!evaluation;
  const evidenceStepComplete = evalStepComplete && allMet;

  // Handlers
  const handleBuonnyRegistration = async (data: BuonnyRegistrationData) => {
    let evalId = evaluation?.id;

    // Auto-create evaluation if it doesn't exist yet
    if (!evalId) {
      const result = await evaluateRisk.mutateAsync({
        order_id: orderId,
        trip_id: tripId ?? undefined,
      });
      evalId = result.evaluation.id;
    }

    // Calculate expiry based on validade type
    const expiresAt =
      data.validade === 'data' && data.data_validade
        ? new Date(data.data_validade + 'T23:59:59').toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // um embarque = 7 days default

    await addEvidence.mutateAsync({
      evaluation_id: evalId,
      evidence_type: 'buonny_check',
      status: data.evidenceStatus,
      expires_at: expiresAt,
      notes: `Código: ${data.codigo_liberacao} | Conjunto: ${data.numero_conjunto} | Validade: ${data.validade === 'um_embarque' ? 'Um embarque' : data.data_validade}`,
      payload: {
        codigo_liberacao: data.codigo_liberacao,
        numero_conjunto: data.numero_conjunto,
        status_buonny: data.status_buonny,
        validade: data.validade,
        driver_cpf: data.driver_cpf,
        driver_name: data.driver_name,
        vehicle_plate: data.vehicle_plate,
        vehicle_type: data.vehicle_type,
        proprietario: data.proprietario,
        registro_manual: true,
      },
    });

    // Await evidence refetch so buonnyValid updates immediately
    await qc.refetchQueries({ queryKey: ['risk-evidence', evalId] });
  };

  const buonnyCheck = useBuonnyProfessionalCheck();
  const anttCheck = useAnttRntrcCheck();

  const ensureEvaluationId = async (): Promise<string> => {
    if (evaluation?.id) return evaluation.id;
    const result = await evaluateRisk.mutateAsync({
      order_id: orderId,
      trip_id: tripId ?? undefined,
    });
    return result.evaluation.id;
  };

  const handleAnttConsult = async () => {
    if (!resolvedVehiclePlate) {
      toast.error('Placa do veículo não atribuída');
      return;
    }

    // TAC path needs driver CPF; Agregado path only needs the plate
    let digits = '';
    if (isDriverSameAsOwner) {
      if (!anttCpfCnpj) {
        toast.error('CPF/CNPJ do transportador não cadastrado');
        return;
      }
      digits = onlyDigits(anttCpfCnpj);
      if (digits.length !== 11 && digits.length !== 14) {
        toast.error('Informe um CPF (11) ou CNPJ (14 dígitos) válido no cadastro do transportador');
        return;
      }
    }

    try {
      type Modalidade = 'tac' | 'agregado' | 'indefinido';
      let modalidade: Modalidade = 'indefinido';
      let veiculoNaFrota: boolean | null = null;
      let ciotFound: boolean | null = null;
      let ciotStatus: string | null = null;
      let ciotMensagem: string | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let firstResp: any = null;

      if (!isDriverSameAsOwner) {
        // ── Agregado path: consulta Por Veículo (placa) → RNTRC do proprietário ──
        // Não depende do CPF do proprietário estar cadastrado no banco.
        setAnttCheckStage('veiculo');
        const respV = await anttCheck.mutateAsync({
          order_id: orderId,
          vehicle_plate: resolvedVehiclePlate,
          cpf_cnpj: anttCpfCnpj ?? undefined,
          operation: 'veiculo',
        });
        firstResp = respV;
        modalidade = 'agregado';

        if (respV.situacao === 'regular') {
          // RNTRC do proprietário vem da resposta do portal, ou usa o ANTT do motorista como fallback
          const rntrcForCiot = respV.rntrc ?? resolvedDriverAntt ?? null;
          if (rntrcForCiot && vehicleRenavam) {
            // ── Passo 2: CIOT Agregado ──────────────────────────────────────
            setAnttCheckStage('ciot');
            const respC = await anttCheck.mutateAsync({
              order_id: orderId,
              vehicle_plate: resolvedVehiclePlate,
              rntrc: rntrcForCiot,
              renavam: vehicleRenavam,
              operation: 'ciot',
            });
            ciotFound = respC.ciot?.found ?? null;
            ciotStatus = respC.ciot?.status ?? null;
            ciotMensagem = respC.ciot?.mensagem ?? null;
          }
        }
      } else {
        // ── TAC path: consulta Por Transportador (CPF) → confirma frota ────
        setAnttCheckStage('rntrc');
        const resp1 = await anttCheck.mutateAsync({
          order_id: orderId,
          cpf_cnpj: digits,
          vehicle_plate: resolvedVehiclePlate,
          rntrc: resolvedDriverAntt || undefined,
          operation: 'rntrc',
        });
        firstResp = resp1;

        if (resp1.situacao === 'regular' && vehicleRenavam) {
          setAnttCheckStage('veiculo');
          const resp2 = await anttCheck.mutateAsync({
            order_id: orderId,
            cpf_cnpj: digits,
            vehicle_plate: resolvedVehiclePlate,
            rntrc: resp1.rntrc || resolvedDriverAntt || undefined,
            operation: 'veiculo',
          });
          veiculoNaFrota = resp2.veiculo_na_frota ?? null;

          if (resp2.veiculo_na_frota === true) {
            modalidade = 'tac';
          } else if (resp2.veiculo_na_frota === false) {
            modalidade = 'agregado';
            const rntrcForCiot = resp1.rntrc || resolvedDriverAntt;
            if (rntrcForCiot) {
              setAnttCheckStage('ciot');
              const resp3 = await anttCheck.mutateAsync({
                order_id: orderId,
                cpf_cnpj: digits,
                vehicle_plate: resolvedVehiclePlate,
                rntrc: rntrcForCiot,
                renavam: vehicleRenavam,
                operation: 'ciot',
              });
              ciotFound = resp3.ciot?.found ?? null;
              ciotStatus = resp3.ciot?.status ?? null;
              ciotMensagem = resp3.ciot?.mensagem ?? null;
            }
          }
        }
      }

      const overallOk =
        firstResp?.situacao === 'regular' &&
        (modalidade === 'tac' ||
          (modalidade === 'agregado' && ciotFound === true) ||
          modalidade === 'indefinido');

      const notes =
        modalidade === 'tac'
          ? 'ANTT: TAC — veículo na frota do motorista'
          : modalidade === 'agregado' && ciotFound
            ? 'ANTT: Agregado — CIOT vigente, operação autorizada'
            : modalidade === 'agregado'
              ? 'ANTT: Agregado — sem CIOT vigente'
              : (firstResp?.message ??
                (overallOk ? 'Consulta ANTT (RNTRC)' : 'Situação irregular na consulta ANTT'));

      const evalId = await ensureEvaluationId();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await addEvidence.mutateAsync({
        evaluation_id: evalId,
        evidence_type: 'antt_rntrc_check',
        status: overallOk ? 'valid' : 'rejected',
        expires_at: overallOk ? expiresAt : null,
        notes,
        payload: {
          situacao: firstResp?.situacao ?? 'indeterminado',
          situacao_raw: firstResp?.situacao_raw ?? null,
          rntrc: firstResp?.rntrc ?? null,
          transportador: firstResp?.transportador ?? null,
          apto: firstResp?.apto ?? null,
          renavam: vehicleRenavam ?? null,
          cpf_cnpj: digits || null,
          vehicle_plate: normalizePlate(resolvedVehiclePlate),
          is_stub: firstResp?.is_stub ?? true,
          consult_source: 'auto',
          modalidade,
          veiculo_na_frota: veiculoNaFrota,
          ciot_found: ciotFound,
          ciot_status: ciotStatus,
          ciot_mensagem: ciotMensagem,
        },
      });
      await qc.refetchQueries({ queryKey: ['risk-evidence', evalId] });

      if (modalidade === 'tac') {
        toast.success('ANTT: TAC — veículo na frota do motorista');
      } else if (modalidade === 'agregado' && ciotFound) {
        toast.success('ANTT: Agregado — CIOT vigente, operação autorizada');
      } else if (modalidade === 'agregado') {
        toast.warning('ANTT: Agregado sem CIOT vigente — operação não autorizada');
      } else {
        toast.success(
          `ANTT: ${firstResp?.situacao ?? 'indeterminado'}${firstResp?.is_stub ? ' (stub)' : ''}`
        );
      }
    } catch (err) {
      toast.error(`Erro na consulta ANTT: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAnttCheckStage(null);
    }
  };

  const handleAutoCheck = async () => {
    if (!resolvedDriverCpf) {
      toast.error('CPF do motorista não cadastrado');
      return;
    }
    if (!resolvedVehiclePlate) {
      toast.error('Placa do veículo não atribuída');
      return;
    }

    type AutoStatus = 'adequado' | 'insuficiente' | 'divergente' | 'expirado';
    type EvidSt = 'valid' | 'pending' | 'invalid' | 'expired';
    const apiMap: Record<string, { status_buonny: AutoStatus; evidenceStatus: EvidSt }> = {
      'PERFIL ADEQUADO AO RISCO': { status_buonny: 'adequado', evidenceStatus: 'valid' },
      'PERFIL DIVERGENTE': { status_buonny: 'divergente', evidenceStatus: 'invalid' },
      'PERFIL COM INSUFICIÊNCIA DE DADOS': {
        status_buonny: 'insuficiente',
        evidenceStatus: 'pending',
      },
      'EM ANÁLISE': { status_buonny: 'insuficiente', evidenceStatus: 'pending' },
      'PERFIL EXPIRADO': { status_buonny: 'expirado', evidenceStatus: 'expired' },
    };

    try {
      const resp = await buonnyCheck.mutateAsync({
        order_id: orderId,
        driver_cpf: resolvedDriverCpf,
        vehicle_plate: resolvedVehiclePlate,
        cargo_value: cargoValue,
        origin_uf: originUf,
        destination_uf: destinationUf,
      });
      const mapped = apiMap[resp.status] ?? {
        status_buonny: 'divergente' as AutoStatus,
        evidenceStatus: 'invalid' as EvidSt,
      };
      await handleBuonnyRegistration({
        ...mapped,
        codigo_liberacao: resp.numero_liberacao ?? '',
        numero_conjunto: '',
        validade: 'um_embarque',
        driver_cpf: resolvedDriverCpf,
        driver_name: resolvedDriverName ?? '',
        vehicle_plate: resolvedVehiclePlate,
        vehicle_type: resolvedVehicleTypeName ?? '',
        proprietario: '',
      });
      toast.success(`Buonny: ${resp.status}${resp.is_stub ? ' (stub)' : ''}`);
    } catch (err) {
      toast.error(`Erro na consulta: ${err instanceof Error ? err.message : String(err)}`);
    }
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
      (crit === 'LOW' || crit === 'MEDIUM') &&
      requirements.length <= 2 &&
      allMet &&
      anttValid &&
      buonnyValid;

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
            (i === 0 && anttStepComplete) ||
            (i === 1 && buonnyStepComplete) ||
            (i === 2 && evalStepComplete) ||
            (i === 3 && evidenceStepComplete) ||
            (i === 4 && (evaluation?.status === 'evaluated' || evaluation?.status === 'approved'));
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
          {currentStep === 'antt' && (
            <StepAntt
              driverName={resolvedDriverName}
              driverCpf={anttCpfCnpj}
              ownerName={(!isDriverSameAsOwner && vehicleData?.ownerName) || undefined}
              vehiclePlate={resolvedVehiclePlate}
              vehicleTypeName={resolvedVehicleTypeName}
              anttEvidence={anttEvidence}
              anttValid={anttValid}
              isEditable={isBuonnyEditable}
              onConsult={handleAnttConsult}
              isConsulting={anttCheck.isPending || anttCheckStage !== null}
              checkStage={anttCheckStage}
              consultError={anttCheck.isError ? (anttCheck.error?.message ?? 'Erro') : null}
              canAdvance={anttStepComplete}
              onNext={() => setCurrentStep('buonny')}
            />
          )}
          {currentStep === 'buonny' && (
            <>
              <StepBuonny
                driverName={resolvedDriverName}
                driverCpf={resolvedDriverCpf}
                vehiclePlate={resolvedVehiclePlate}
                vehicleTypeName={resolvedVehicleTypeName}
                buonnyEvidence={buonnyEvidence}
                buonnyValid={buonnyValid}
                isEditable={isBuonnyEditable}
                onOpenRegistration={() => setBuonnyModalOpen(true)}
                onAutoCheck={handleAutoCheck}
                isAutoChecking={buonnyCheck.isPending}
                autoCheckError={buonnyCheck.isError ? (buonnyCheck.error?.message ?? 'Erro') : null}
                canAdvance={buonnyStepComplete}
                onNext={() => setCurrentStep('rules')}
                onBack={() => setCurrentStep('antt')}
              />
              <BuonnyRegistrationModal
                open={buonnyModalOpen}
                onOpenChange={setBuonnyModalOpen}
                driverName={resolvedDriverName}
                driverCpf={resolvedDriverCpf}
                vehiclePlate={resolvedVehiclePlate}
                vehicleTypeName={resolvedVehicleTypeName}
                onSubmit={handleBuonnyRegistration}
                isLoading={addEvidence.isPending || evaluateRisk.isPending}
              />
            </>
          )}
          {currentStep === 'rules' && (
            <StepRules
              critResult={critResult}
              cargoValue={cargoValue}
              kmDistance={kmDistance}
              evaluation={evaluation}
              policyChecks={policyChecks}
              aggregateExposureWarning={aggregateExposureWarning}
              isEditable={isEditable}
              canAdvance={evalStepComplete}
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
              canAdvance={evidenceStepComplete}
              onNext={() => setCurrentStep('submit')}
              onBack={() => setCurrentStep('rules')}
            />
          )}
          {currentStep === 'submit' && (
            <StepSubmit
              evaluation={evaluation}
              critResult={critResult}
              allMet={allMet}
              anttValid={anttValid}
              buonnyValid={buonnyValid}
              coverageOk={coverageOk}
              policyChecks={policyChecks}
              aggregateExposureWarning={aggregateExposureWarning}
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

// Step 1: ANTT / RNTRC
function StepAntt({
  driverName,
  driverCpf,
  ownerName,
  vehiclePlate,
  vehicleTypeName,
  anttEvidence,
  anttValid,
  isEditable,
  onConsult,
  isConsulting,
  checkStage,
  consultError,
  canAdvance,
  onNext,
}: {
  driverName?: string | null;
  driverCpf?: string | null;
  ownerName?: string | null;
  vehiclePlate?: string | null;
  vehicleTypeName?: string | null;
  anttEvidence: RiskEvidence | undefined;
  anttValid: boolean;
  isEditable: boolean;
  onConsult: () => void;
  isConsulting: boolean;
  checkStage?: 'rntrc' | 'veiculo' | 'ciot' | null;
  consultError?: string | null;
  canAdvance: boolean;
  onNext: () => void;
}) {
  const payload = anttEvidence?.payload as Record<string, unknown> | undefined;
  const situacao = payload?.situacao ? String(payload.situacao) : null;
  const situacaoRaw = payload?.situacao_raw ? String(payload.situacao_raw) : null;
  const modalidade = payload?.modalidade ? String(payload.modalidade) : null;

  const stageLabelMap: Record<string, string> = {
    rntrc: 'Verificando RNTRC...',
    veiculo: ownerName
      ? 'Consultando transportador (por placa)...'
      : 'Verificando vínculo veículo...',
    ciot: 'Verificando CIOT...',
  };
  const consultLabel = checkStage
    ? (stageLabelMap[checkStage] ?? 'Consultando...')
    : 'Consultar ANTT';

  return (
    <div className="space-y-4" data-testid="risk-step-antt">
      <h3 className="font-semibold">Passo 1: Consulta ANTT (RNTRC)</h3>
      <p className="text-sm text-muted-foreground">
        Validação cadastral na consulta pública antes da verificação Buonny.
      </p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Motorista:</span>{' '}
          <span className="font-medium">{driverName ?? 'Não atribuído'}</span>
        </div>
        {ownerName ? (
          <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs space-y-0.5">
            <div className="font-medium text-amber-700 dark:text-amber-400">
              ⚠ Veículo agregado — proprietário diferente do motorista
            </div>
            <div className="text-amber-700 dark:text-amber-400">
              Proprietário: <span className="font-semibold">{ownerName}</span>
            </div>
            <div className="text-amber-600 dark:text-amber-500">
              Consulta ANTT por placa (RNTRC do proprietário via portal)
            </div>
          </div>
        ) : (
          <div>
            <span className="text-muted-foreground">CPF/CNPJ:</span>{' '}
            <span className="font-medium">{driverCpf ?? '—'}</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Placa:</span>{' '}
          <span className="font-medium">{vehiclePlate ?? 'Não atribuído'}</span>
        </div>
        {vehicleTypeName && (
          <div>
            <span className="text-muted-foreground">Tipo:</span>{' '}
            <span className="font-medium">{vehicleTypeName}</span>
          </div>
        )}
      </div>

      {anttEvidence ? (
        <div
          className={cn(
            'rounded-lg border p-3 space-y-1 text-sm',
            anttValid
              ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
              : 'border-red-200 bg-red-50 dark:bg-red-950/20'
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            {anttValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            ANTT: {anttValid ? 'Consulta válida' : 'Reprovada / expirada'}
          </div>
          {payload?.transportador && (
            <div className="text-muted-foreground">{String(payload.transportador)}</div>
          )}
          {payload?.rntrc != null && String(payload.rntrc).length > 0 && (
            <div className="text-muted-foreground">RNTRC: {String(payload.rntrc)}</div>
          )}
          {situacao && <div className="text-muted-foreground capitalize">Situação: {situacao}</div>}
          {situacaoRaw && situacaoRaw !== 'ATIVO' && (
            <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              Situação RNTRC: {situacaoRaw}
            </div>
          )}
          {modalidade && modalidade !== 'indefinido' && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                  modalidade === 'tac'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                )}
              >
                {modalidade === 'tac' ? 'TAC' : 'Agregado'}
              </span>
              {modalidade === 'agregado' && (
                <span className="text-muted-foreground text-xs">
                  CIOT:{' '}
                  {payload?.ciot_found === true
                    ? 'vigente'
                    : payload?.ciot_found === false
                      ? 'não encontrado'
                      : '—'}
                </span>
              )}
            </div>
          )}
          {payload?.is_stub === true && (
            <div className="text-xs text-amber-700 dark:text-amber-400">
              Modo simulado — deploy da integração real substitui este resultado.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma consulta ANTT registrada
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2">
        {isEditable && !anttValid && (
          <Button
            size="sm"
            onClick={onConsult}
            disabled={isConsulting}
            aria-label="Consultar situação ANTT RNTRC"
          >
            {isConsulting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isConsulting ? consultLabel : 'Consultar ANTT'}
          </Button>
        )}
        <Button size="sm" onClick={onNext} disabled={!canAdvance} className="ml-auto">
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {consultError && <p className="text-xs text-destructive">{consultError}</p>}

      {!canAdvance && isEditable && (
        <p className="text-xs text-muted-foreground">
          Execute a consulta ANTT para liberar o passo Buonny.
        </p>
      )}
    </div>
  );
}

// Step 2: Buonny
function StepBuonny({
  driverName,
  driverCpf,
  vehiclePlate,
  vehicleTypeName,
  buonnyEvidence,
  buonnyValid,
  isEditable,
  onOpenRegistration,
  onAutoCheck,
  isAutoChecking,
  autoCheckError,
  canAdvance,
  onNext,
  onBack,
}: {
  driverName?: string | null;
  driverCpf?: string | null;
  vehiclePlate?: string | null;
  vehicleTypeName?: string | null;
  buonnyEvidence: ReturnType<typeof Array.prototype.find>;
  buonnyValid: boolean;
  isEditable: boolean;
  onOpenRegistration: () => void;
  onAutoCheck: () => void;
  isAutoChecking: boolean;
  autoCheckError?: string | null;
  canAdvance: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  const payload = (buonnyEvidence as { payload?: Record<string, unknown> })?.payload;
  const statusLabel = payload?.status_buonny
    ? String(payload.status_buonny).replace(/_/g, ' ')
    : null;

  return (
    <div className="space-y-4" data-testid="risk-step-buonny">
      <h3 className="font-semibold">Passo 2: Verificação Buonny</h3>
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
          <span className="text-muted-foreground">Placa:</span>{' '}
          <span className="font-medium">{vehiclePlate ?? 'Não atribuído'}</span>
        </div>
        {vehicleTypeName && (
          <div>
            <span className="text-muted-foreground">Tipo:</span>{' '}
            <span className="font-medium">{vehicleTypeName}</span>
          </div>
        )}
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
            Buonny: {buonnyValid ? 'Adequado ao risco' : 'Expirado / Reprovado'}
          </div>
          {payload && (
            <>
              {payload.codigo_liberacao && (
                <div className="text-muted-foreground">
                  Código de Liberação: {String(payload.codigo_liberacao)}
                </div>
              )}
              {payload.numero_conjunto && (
                <div className="text-muted-foreground">
                  Nº Conjunto: {String(payload.numero_conjunto)}
                </div>
              )}
              {statusLabel && (
                <div className="text-muted-foreground capitalize">Status: {statusLabel}</div>
              )}
              {payload.proprietario && (
                <div className="text-muted-foreground">
                  Proprietário: {String(payload.proprietario)}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma consulta Buonny registrada
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Voltar para consulta ANTT">
            <ChevronLeft className="h-4 w-4" /> ANTT
          </Button>
          {isEditable && !buonnyValid && (
            <>
              <Button size="sm" onClick={onAutoCheck} disabled={isAutoChecking}>
                {isAutoChecking && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {isAutoChecking ? 'Consultando...' : 'Consultar Buonny'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenRegistration}
                disabled={isAutoChecking}
              >
                Registrar manualmente
              </Button>
            </>
          )}
        </div>
        <Button size="sm" onClick={onNext} disabled={!canAdvance} className="ml-auto">
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {autoCheckError && <p className="text-xs text-destructive">{autoCheckError}</p>}

      {!canAdvance && isEditable && (
        <p className="text-xs text-muted-foreground">
          Consulte ou registre o retorno da Buonny para avançar.
        </p>
      )}
    </div>
  );
}

type AggregateExposureWarning = {
  totalExposure: number;
  limit: number;
  otherOrders: { id: string; cargo_value: number | null; os_number: string; stage: string }[];
} | null;

// Step 3: Rules & Criticality
function StepRules({
  critResult,
  cargoValue,
  kmDistance,
  evaluation,
  policyChecks,
  aggregateExposureWarning,
  isEditable,
  canAdvance,
  onNext,
  onBack,
}: {
  critResult: ReturnType<typeof evaluateCriticality> | null;
  cargoValue: number;
  kmDistance: number;
  evaluation: unknown;
  policyChecks: ReturnType<typeof validateCoverage> extends infer R
    ? {
        policy: import('@/hooks/useRiskPolicies').RiskPolicy;
        coverage: ReturnType<typeof validateCoverage>;
        validity: ReturnType<typeof validateValidity>;
        premium: number;
      }[]
    : never;
  aggregateExposureWarning: AggregateExposureWarning;
  isEditable: boolean;
  canAdvance: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="risk-step-rules">
      <h3 className="font-semibold">Passo 3: Criticidade</h3>
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

      {/* Insurance policy coverage */}
      {policyChecks.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Cobertura do Seguro</span>
          {policyChecks.map(({ policy, coverage, validity, premium }) => {
            const ok = coverage.ok && validity.ok;
            return (
              <div
                key={policy.id}
                className={cn(
                  'rounded-lg border p-3 text-xs space-y-1',
                  ok
                    ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
                    : 'border-red-200 bg-red-50 dark:bg-red-950/20'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{policy.policy_type}</span>
                  {ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="text-muted-foreground">{policy.insurer}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span className="text-muted-foreground">Limite:</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(policy.coverage_limit ?? 0)}
                  </span>
                  <span className="text-muted-foreground">Prêmio estimado:</span>
                  <span className="font-medium tabular-nums">{formatCurrency(premium)}</span>
                  <span className="text-muted-foreground">Vigência até:</span>
                  <span className="font-medium">
                    {policy.valid_until
                      ? new Date(policy.valid_until + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>
                {!coverage.ok && <p className="text-red-600 font-medium">{coverage.message}</p>}
                {!validity.ok && <p className="text-red-600 font-medium">{validity.message}</p>}
              </div>
            );
          })}
        </div>
      )}

      {aggregateExposureWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Exposição agregada excede o limite da apólice
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <div>
              Total deste motorista:{' '}
              <span className="font-medium tabular-nums">
                {formatCurrency(aggregateExposureWarning.totalExposure)}
              </span>{' '}
              — Limite:{' '}
              <span className="font-medium tabular-nums">
                {formatCurrency(aggregateExposureWarning.limit)}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="font-medium">Outras OS ativas deste motorista:</span>
              {aggregateExposureWarning.otherOrders.map((o) => (
                <div key={o.id} className="pl-3">
                  • OS {o.os_number} — {formatCurrency(o.cargo_value ?? 0)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!evaluation && isEditable && (
        <p className="text-xs text-muted-foreground">
          A avaliação será criada automaticamente ao executar a consulta Buonny.
        </p>
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

// Step 4: Evidence & Requirements
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
      <h3 className="font-semibold">Passo 4: Evidências e Exigências</h3>

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

// Step 5: Review & Submit
function StepSubmit({
  evaluation,
  critResult,
  allMet,
  anttValid,
  buonnyValid,
  coverageOk,
  policyChecks,
  aggregateExposureWarning,
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
  anttValid: boolean;
  buonnyValid: boolean;
  coverageOk: boolean;
  policyChecks: {
    policy: import('@/hooks/useRiskPolicies').RiskPolicy;
    coverage: ReturnType<typeof validateCoverage>;
    validity: ReturnType<typeof validateValidity>;
    premium: number;
  }[];
  aggregateExposureWarning: AggregateExposureWarning;
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
    anttValid &&
    buonnyValid &&
    allMet &&
    coverageOk &&
    isEditable &&
    eval_?.status !== 'evaluated' &&
    eval_?.status !== 'approved';
  const isSubmitted = eval_?.status === 'evaluated';
  const isAutoApproved = eval_?.status === 'approved';
  const willAutoApprove =
    critResult &&
    (critResult.criticality === 'LOW' || critResult.criticality === 'MEDIUM') &&
    allMet &&
    anttValid &&
    buonnyValid &&
    coverageOk;

  return (
    <div className="space-y-4" data-testid="risk-step-submit">
      <h3 className="font-semibold">Passo 5: Revisão e Envio</h3>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          {anttValid ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span>Consulta ANTT (RNTRC)</span>
        </div>
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
        <div className="flex items-center gap-2">
          {coverageOk ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span>Cobertura do seguro</span>
          {!coverageOk && policyChecks.length > 0 && (
            <span className="text-xs text-red-600">
              —{' '}
              {policyChecks.find((c) => !c.coverage.ok || !c.validity.ok)?.coverage.message ??
                policyChecks.find((c) => !c.validity.ok)?.validity.message}
            </span>
          )}
        </div>
        {aggregateExposureWarning && (
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <span>Exposição agregada do motorista</span>
              <div className="text-xs text-red-600 font-medium">
                Total {formatCurrency(aggregateExposureWarning.totalExposure)} excede limite{' '}
                {formatCurrency(aggregateExposureWarning.limit)}
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {aggregateExposureWarning.otherOrders.map((o) => (
                  <div key={o.id} className="pl-2">
                    • OS {o.os_number} — {formatCurrency(o.cargo_value ?? 0)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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

      {willAutoApprove && !isSubmitted && !isAutoApproved && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          Esta avaliação será auto-aprovada (criticidade baixa/média com todos os requisitos
          atendidos).
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
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          Avaliação de risco salva.
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        {!isSubmitted && !isAutoApproved && (
          <Button size="sm" onClick={onSubmit} disabled={!canSubmit || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Avaliação de Risco'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
