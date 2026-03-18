import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

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
  user_rating: number | null;
  user_feedback: string | null;
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
      return (data ?? []) as unknown as AiInsight[];
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
      return (data?.[0] ?? null) as unknown as AiInsight | null;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/** Fetch latest operational insights */
export function useOperationalInsights() {
  return useQuery({
    queryKey: ['ai-insights', 'operational'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_insights' as 'documents')
        .select('*')
        .eq('insight_type', 'operational_insights')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      return (data?.[0] ?? null) as unknown as AiInsight | null;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────

/** Trigger AI analysis on demand */
export function useRequestAiAnalysis() {
  const queryClient = useQueryClient();
  const OPERATIONAL_TYPES = new Set([
    'operational_insights',
    'driver_qualification',
    'stage_gate_validation',
    'compliance_check',
    'operational_report',
    'regulatory_update',
  ]);

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
      // `approval_summary` currently runs into auth issues when routed through
      // `ai-orchestrator-agent` to `ai-approval-summary-worker`.
      // To unblock the approvals UX, call the worker directly.
      if (analysisType === 'approval_summary') {
        return invokeEdgeFunction('ai-approval-summary-worker', {
          body: {
            entityId,
            entityType,
            // Worker has default model; pass explicitly for clarity.
            model: 'gemini-2.5-pro',
          },
        });
      }

      const primaryFnName = OPERATIONAL_TYPES.has(analysisType)
        ? 'ai-operational-orchestrator'
        : 'ai-orchestrator-agent';

      let data: { error?: string; success?: boolean };
      try {
        data = await invokeEdgeFunction<{ error?: string; success?: boolean }>(primaryFnName, {
          body: { analysisType, entityId, entityType },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const missingFn = /404|not found|function/i.test(message);
        if (primaryFnName !== 'ai-financial-agent' && missingFn) {
          data = await invokeEdgeFunction<{ error?: string; success?: boolean }>(
            'ai-financial-agent',
            {
              body: { analysisType, entityId, entityType },
            }
          );
        } else {
          throw e;
        }
      }

      if (data?.success === false && data?.error) throw new Error(data.error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['ai-insights', variables.entityType, variables.entityId],
      });
      queryClient.invalidateQueries({ queryKey: ['ai-insights', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ai-insights', 'operational'] });
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
    },
  });
}

/** Rate an AI insight (thumbs up/down or 1-5) */
export function useRateInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      insightId,
      rating,
      feedback,
    }: {
      insightId: string;
      rating: number;
      feedback?: string;
    }) => {
      const { error } = await supabase
        .from('ai_insights' as 'documents')
        .update({ user_rating: rating, user_feedback: feedback || null } as Record<string, unknown>)
        .eq('id', insightId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    },
  });
}
