import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/supabase-invoke';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface ComplianceCheck {
  id: string;
  order_id: string | null;
  check_type: 'pre_contratacao' | 'pre_coleta' | 'pre_entrega' | 'auditoria_periodica';
  rules_evaluated: Array<{ rule: string; passed: boolean; detail: string }>;
  violations: Array<{ rule: string; severity: string; detail: string; remediation: string }>;
  status: 'ok' | 'warning' | 'violation';
  ai_analysis: Record<string, unknown> | null;
  created_at: string;
}

type CompliancePayload = {
  rules_evaluated?: Array<{ rule: string; passed: boolean; detail: string }>;
  violations?: Array<{ rule: string; severity: string; detail: string; remediation: string }>;
  status?: 'ok' | 'warning' | 'violation';
};

// ─────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────

/** Fetch all compliance checks for a given order */
export function useComplianceChecks(orderId: string) {
  return useQuery({
    queryKey: ['compliance-checks', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_checks' as 'documents')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => {
        const result = (row.result as CompliancePayload | null) ?? {};
        const aiAnalysis = (row.ai_analysis as CompliancePayload | null) ?? {};

        const rulesEvaluated =
          (row.rules_evaluated as ComplianceCheck['rules_evaluated'] | null) ??
          result.rules_evaluated ??
          aiAnalysis.rules_evaluated ??
          [];

        const violations =
          (row.violations as ComplianceCheck['violations'] | null) ??
          result.violations ??
          aiAnalysis.violations ??
          [];

        const status =
          (row.status as ComplianceCheck['status'] | null) ??
          result.status ??
          aiAnalysis.status ??
          'ok';

        return {
          ...(row as unknown as ComplianceCheck),
          rules_evaluated: rulesEvaluated,
          violations,
          status,
        };
      });
    },
    enabled: !!orderId,
  });
}

// ─────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────

/** Trigger a compliance check via the ai-operational-orchestrator */
export function useRequestComplianceCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      checkType,
    }: {
      orderId: string;
      checkType: ComplianceCheck['check_type'];
    }) => {
      return invokeEdgeFunction('ai-operational-orchestrator', {
        analysisType: 'compliance_check',
        orderId,
        entityId: orderId,
        entityType: 'order',
        checkType,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['compliance-checks', variables.orderId],
      });
    },
  });
}
