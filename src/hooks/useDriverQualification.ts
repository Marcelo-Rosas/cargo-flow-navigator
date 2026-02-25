import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface DriverQualification {
  id: string;
  order_id: string;
  driver_cpf: string | null;
  driver_name: string | null;
  status: 'pendente' | 'em_analise' | 'aprovado' | 'reprovado' | 'bloqueado';
  checklist: Record<string, boolean>;
  risk_flags: Array<{ flag: string; severity: string; detail: string }>;
  risk_score: number | null;
  ai_analysis: Record<string, unknown> | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────

/** Fetch the driver qualification record for a given order */
export function useDriverQualification(orderId: string) {
  return useQuery({
    queryKey: ['driver-qualification', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_qualifications' as 'documents')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      return (data?.[0] ?? null) as unknown as DriverQualification | null;
    },
    enabled: !!orderId,
  });
}

// ─────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────

/** Trigger AI-based driver qualification via the ai-operational-agent edge function */
export function useRequestDriverQualification() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ orderId, driverCpf }: { orderId: string; driverCpf: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? session?.access_token;

      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const { data, error } = await supabase.functions.invoke('ai-operational-agent', {
        body: { analysisType: 'driver_qualification', orderId, driverCpf },
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
        queryKey: ['driver-qualification', variables.orderId],
      });
    },
  });
}

/** Approve or reject a driver qualification */
export function useDecideDriverQualification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      qualificationId,
      orderId,
      decision,
    }: {
      qualificationId: string;
      orderId: string;
      decision: 'aprovado' | 'reprovado' | 'bloqueado';
    }) => {
      const { error } = await supabase
        .from('driver_qualifications' as 'documents')
        .update({
          status: decision,
          decided_by: user?.id ?? null,
          decided_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', qualificationId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['driver-qualification', variables.orderId],
      });
    },
  });
}
