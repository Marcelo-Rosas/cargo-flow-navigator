import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface ApprovalRequest {
  id: string;
  entity_type: string;
  entity_id: string;
  approval_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requested_by: string | null;
  assigned_to: string | null;
  assigned_to_role: string | null;
  title: string;
  description: string | null;
  ai_analysis: Record<string, unknown> | null;
  decision_notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ApprovalDecision = 'approved' | 'rejected';

// ─────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────

export function useApprovalRequests(status?: string) {
  return useQuery({
    queryKey: ['approval-requests', status],
    queryFn: async () => {
      let query = supabase
        .from('approval_requests' as 'documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01') return []; // table doesn't exist yet
        throw error;
      }
      const list = (data ?? []) as unknown as ApprovalRequest[];
      // Esconde aprovações fora da regra: risk_gate é só para OS/trip, não para cotação
      return list.filter((a) => !(a.entity_type === 'quote' && a.approval_type === 'risk_gate'));
    },
  });
}

export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ['approval-requests', 'pending-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_requests' as 'documents')
        .select('id, entity_type, approval_type')
        .eq('status', 'pending');

      if (error) {
        if (error.code === '42P01') return 0;
        throw error;
      }
      const list = (data ?? []) as unknown as {
        id: string;
        entity_type: string;
        approval_type: string;
      }[];
      const filtered = list.filter(
        (a) => !(a.entity_type === 'quote' && a.approval_type === 'risk_gate')
      );
      return filtered.length;
    },
    refetchInterval: 30_000, // Refetch every 30s
  });
}

export function useApprovalRequestById(id: string) {
  return useQuery({
    queryKey: ['approval-requests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_requests' as 'documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as ApprovalRequest | null;
    },
    enabled: !!id,
  });
}

// ─────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────

export function useDecideApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      decision,
      notes,
    }: {
      id: string;
      decision: ApprovalDecision;
      notes?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('approval_requests' as 'documents')
        .update({
          status: decision,
          decision_notes: notes || null,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-events'] });
      toast.success(
        variables.decision === 'approved'
          ? 'Aprovação concedida com sucesso'
          : 'Solicitação rejeitada'
      );
    },
    onError: (err: Error) => {
      toast.error(`Erro ao processar aprovação: ${err.message}`);
    },
  });
}
