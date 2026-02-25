import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
      return (data ?? []) as unknown as ComplianceCheck[];
    },
    enabled: !!orderId,
  });
}

// ─────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────

/** Trigger a compliance check via the ai-operational-agent edge function */
export function useRequestComplianceCheck() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      orderId,
      checkType,
    }: {
      orderId: string;
      checkType: ComplianceCheck['check_type'];
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? session?.access_token;

      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const { data, error } = await supabase.functions.invoke('ai-operational-agent', {
        body: { analysisType: 'compliance_check', orderId, checkType },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['compliance-checks', variables.orderId],
      });
    },
  });
}
