import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';
import type {
  RiskEvaluation,
  RiskEvidence,
  RiskCost,
  RiskPolicy,
  RiskPolicyRule,
  RiskServiceCatalog,
  OrderRiskStatus,
  RiskCriticality,
} from '@/types/risk';

// ─────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────

/** Active risk policies */
export function useRiskPolicies() {
  return useQuery({
    queryKey: ['risk-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_policies' as 'documents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as RiskPolicy[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Rules for a specific policy */
export function useRiskPolicyRules(policyId: string | undefined) {
  return useQuery({
    queryKey: ['risk-policy-rules', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      const { data, error } = await supabase
        .from('risk_policy_rules' as 'documents')
        .select('*')
        .eq('policy_id', policyId)
        .eq('is_active', true)
        .order('sort_order');
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as RiskPolicyRule[];
    },
    enabled: !!policyId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Risk services catalog */
export function useRiskServicesCatalog() {
  return useQuery({
    queryKey: ['risk-services-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_services_catalog' as 'documents')
        .select('*')
        .eq('is_active', true);
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as RiskServiceCatalog[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Risk evaluation for an order or trip */
export function useRiskEvaluationByEntity(
  entityType: 'order' | 'trip',
  entityId: string | undefined
) {
  return useQuery({
    queryKey: ['risk-evaluation', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const { data, error } = await supabase
        .from('risk_evaluations' as 'documents')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .not('status', 'in', '("expired","rejected")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      return data as RiskEvaluation | null;
    },
    enabled: !!entityId,
  });
}

/** Evidence for an evaluation */
export function useRiskEvidence(evaluationId: string | undefined) {
  return useQuery({
    queryKey: ['risk-evidence', evaluationId],
    queryFn: async () => {
      if (!evaluationId) return [];
      const { data, error } = await supabase
        .from('risk_evidence' as 'documents')
        .select('*')
        .eq('evaluation_id', evaluationId)
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as RiskEvidence[];
    },
    enabled: !!evaluationId,
  });
}

/** Risk costs for an order */
export function useRiskCosts(orderId: string | undefined) {
  return useQuery({
    queryKey: ['risk-costs', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('risk_costs' as 'documents')
        .select('*')
        .eq('order_id', orderId);
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as RiskCost[];
    },
    enabled: !!orderId,
  });
}

/** Order risk status from the view */
export function useOrderRiskStatus(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-risk-status', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('vw_order_risk_status' as 'documents')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      return data as OrderRiskStatus | null;
    },
    enabled: !!orderId,
  });
}

/** Aggregate risk status for all orders in a trip (VG panel) */
export function useTripOrdersRiskStatus(orderIds: string[] | undefined) {
  return useQuery({
    queryKey: ['trip-orders-risk-status', orderIds],
    queryFn: async () => {
      if (!orderIds || orderIds.length === 0) return [];
      const { data, error } = await supabase
        .from('vw_order_risk_status' as 'documents')
        .select('*')
        .in('order_id', orderIds);
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as unknown as OrderRiskStatus[];
    },
    enabled: !!orderIds && orderIds.length > 0,
  });
}

// ─────────────────────────────────────────────────────
// Criticality Evaluator (client-side)
// ─────────────────────────────────────────────────────

const CRITICALITY_ORDER: RiskCriticality[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function evaluateCriticality(
  rules: RiskPolicyRule[],
  cargoValue: number,
  kmDistance: number
): { criticality: RiskCriticality; matchedRules: RiskPolicyRule[]; requirements: string[] } {
  let maxLevel = 0;
  let boost = 0;
  const matched: RiskPolicyRule[] = [];
  const allRequirements = new Set<string>();

  for (const rule of rules) {
    const cfg = rule.trigger_config as { min?: number; max?: number | null };
    let matches = false;

    if (rule.trigger_type === 'cargo_value') {
      const min = cfg.min ?? 0;
      const max = cfg.max ?? Infinity;
      matches = cargoValue >= min && cargoValue <= max;
    } else if (rule.trigger_type === 'km_distance') {
      const min = cfg.min ?? 0;
      matches = kmDistance >= min;
    }

    if (matches) {
      matched.push(rule);
      if (rule.criticality_boost > 0) {
        boost += rule.criticality_boost;
      } else {
        const level = CRITICALITY_ORDER.indexOf(rule.criticality);
        if (level > maxLevel) maxLevel = level;
      }
      for (const req of rule.requirements) {
        allRequirements.add(req);
      }
    }
  }

  const finalLevel = Math.min(maxLevel + boost, CRITICALITY_ORDER.length - 1);
  return {
    criticality: CRITICALITY_ORDER[finalLevel],
    matchedRules: matched,
    requirements: Array.from(allRequirements),
  };
}

// ─────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────

export function useCreateRiskEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      entity_type: 'order' | 'trip';
      entity_id: string;
      policy_id: string;
      criticality: RiskCriticality;
      cargo_value_evaluated: number;
      requirements: string[];
      policy_rules_applied: string[];
      route_municipalities?: string[];
    }) => {
      const { data, error } = await supabase
        .from('risk_evaluations' as 'documents')
        .insert(params as never)
        .select()
        .single();
      if (error) throw error;
      return data as RiskEvaluation;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['risk-evaluation', data.entity_type, data.entity_id] });
      qc.invalidateQueries({ queryKey: ['order-risk-status'] });
      toast.success('Avaliação de risco criada');
    },
    onError: (err: Error) => {
      toast.error('Erro ao criar avaliação: ' + err.message);
    },
  });
}

export function useUpdateRiskEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      status?: RiskEvaluationStatus;
      requirements_met?: Record<string, boolean>;
      evaluation_notes?: string;
      approval_request_id?: string;
    }) => {
      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from('risk_evaluations' as 'documents')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          ...(updates.status === 'evaluated' ? { evaluated_at: new Date().toISOString() } : {}),
        } as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as RiskEvaluation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk-evaluation'] });
      qc.invalidateQueries({ queryKey: ['order-risk-status'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao atualizar avaliação: ' + err.message);
    },
  });
}

export function useAddRiskEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      evaluation_id: string;
      evidence_type: string;
      document_id?: string;
      payload: Record<string, unknown>;
      status?: string;
      expires_at?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('risk_evidence' as 'documents')
        .insert(params as never)
        .select()
        .single();
      if (error) throw error;
      return data as RiskEvidence;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['risk-evidence', data.evaluation_id] });
      toast.success('Evidência registrada');
    },
    onError: (err: Error) => {
      toast.error('Erro ao registrar evidência: ' + err.message);
    },
  });
}

type RiskEvaluationStatus = 'pending' | 'evaluated' | 'approved' | 'rejected' | 'expired';

// ─────────────────────────────────────────────────────
// Edge Function Mutations
// ─────────────────────────────────────────────────────

interface EvaluateRiskResponse {
  success: boolean;
  error?: string;
  evaluation: {
    id: string;
    entity_type: 'order';
    entity_id: string;
    criticality: RiskCriticality;
    requirements: string[];
    requirements_met: Record<string, boolean>;
    cargo_value_evaluated: number;
    route_municipalities: string[];
    policy_rules_applied: string[];
    can_auto_approve: boolean;
  };
  trip_evaluation: {
    trip_id: string;
    criticality: RiskCriticality;
    total_cargo_value: number;
    order_count: number;
    all_orders_approved: boolean;
  } | null;
  estimated_costs: {
    items: Array<{ code: string; name: string; cost: number }>;
    total: number;
  };
}

interface BuonnyCheckResponse {
  success: boolean;
  error?: string;
  result: {
    status: string;
    consulta_id: string;
    validade: string;
    cadastro_existente: boolean;
    monitoramento_ativo: boolean;
    score: number;
  };
  evidence_id?: string;
}

/** Call evaluate-risk Edge function */
export function useEvaluateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      order_id: string;
      trip_id?: string;
      force_reevaluate?: boolean;
    }) => {
      const data = await invokeEdgeFunction<EvaluateRiskResponse>('evaluate-risk', {
        body: params,
      });
      if (!data.success) {
        throw new Error(data.error || 'Erro ao avaliar risco');
      }
      return data;
    },
    onSuccess: (data) => {
      const now = new Date().toISOString();
      // Optimistic: put evaluation in cache immediately so useRiskEvidence becomes enabled
      qc.setQueryData<RiskEvaluation | null>(
        ['risk-evaluation', 'order', data.evaluation.entity_id],
        {
          id: data.evaluation.id,
          entity_type: data.evaluation.entity_type,
          entity_id: data.evaluation.entity_id,
          policy_id: null,
          criticality: data.evaluation.criticality,
          status: 'pending',
          cargo_value_evaluated: data.evaluation.cargo_value_evaluated,
          requirements: data.evaluation.requirements,
          requirements_met: data.evaluation.requirements_met ?? {},
          route_municipalities: data.evaluation.route_municipalities ?? [],
          policy_rules_applied: data.evaluation.policy_rules_applied ?? [],
          evaluation_notes: null,
          evaluated_by: null,
          evaluated_at: null,
          approval_request_id: null,
          expires_at: null,
          created_at: now,
          updated_at: now,
        }
      );
      // Background refetch for full server data
      qc.invalidateQueries({ queryKey: ['risk-evaluation', 'order', data.evaluation.entity_id] });
      qc.invalidateQueries({ queryKey: ['order-risk-status'] });
      if (data.trip_evaluation) {
        qc.invalidateQueries({
          queryKey: ['risk-evaluation', 'trip', data.trip_evaluation.trip_id],
        });
      }
      toast.success('Avaliação de risco calculada');
    },
    onError: (err: Error) => {
      toast.error('Erro ao avaliar risco: ' + err.message);
    },
  });
}

/** Call buonny-check Edge function */
export function useBuonnyCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      driver_cpf: string;
      driver_name?: string;
      vehicle_plate?: string;
      evaluation_id?: string;
    }) => {
      const data = await invokeEdgeFunction<BuonnyCheckResponse>('buonny-check', {
        body: params,
      });
      if (!data.success) {
        throw new Error(data.error || 'Erro na consulta Buonny');
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      if (variables.evaluation_id) {
        qc.invalidateQueries({ queryKey: ['risk-evidence'] });
      }
      toast.success('Consulta Buonny realizada');
    },
    onError: (err: Error) => {
      toast.error('Erro na consulta Buonny: ' + err.message);
    },
  });
}
