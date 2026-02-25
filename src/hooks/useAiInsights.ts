import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface AiInsight {
  id: string;
  insight_type: string;
  entity_type: string | null;
  entity_id: string | null;
  analysis: Record<string, unknown>;
  summary_text: string;
  expires_at: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────

/** Fetch insights for a specific entity (quote, financial_document, etc.) */
export function useEntityInsights(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['ai-insights', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_insights' as 'documents')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as AiInsight[];
    },
    enabled: !!entityType && !!entityId,
  });
}

/** Fetch latest dashboard insights */
export function useDashboardInsights() {
  return useQuery({
    queryKey: ['ai-insights', 'dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_insights' as 'documents')
        .select('*')
        .eq('insight_type', 'dashboard_insights')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      return (data?.[0] ?? null) as AiInsight | null;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// ─────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────

/** Trigger AI analysis on demand */
export function useRequestAiAnalysis() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      analysisType,
      entityId,
      entityType,
    }: {
      analysisType: string;
      entityId: string;
      entityType: string;
    }) => {
      // Get a fresh session to avoid stale/expired JWTs
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? session?.access_token;

      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const { data, error } = await supabase.functions.invoke('ai-financial-agent', {
        body: { analysisType, entityId, entityType },
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
        queryKey: ['ai-insights', variables.entityType, variables.entityId],
      });
      queryClient.invalidateQueries({ queryKey: ['ai-insights', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
    },
  });
}
