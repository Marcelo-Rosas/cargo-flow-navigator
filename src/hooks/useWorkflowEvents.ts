import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface WorkflowEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  created_by: string | null;
}

export interface WorkflowEventLog {
  id: string;
  event_id: string;
  action: string;
  agent: string;
  details: Record<string, unknown>;
  created_at: string;
}

// ─────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────

/** Recent workflow events (activity feed) */
export function useRecentWorkflowEvents(limit = 20) {
  return useQuery({
    queryKey: ['workflow-events', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_events' as 'documents')
        .select('*')
        .in('status', ['completed', 'failed'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as WorkflowEvent[];
    },
    refetchInterval: 2 * 60_000, // Refetch every 2 min
  });
}

/** Workflow event logs for a specific event */
export function useWorkflowEventLogs(eventId: string) {
  return useQuery({
    queryKey: ['workflow-event-logs', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_event_logs' as 'documents')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as WorkflowEventLog[];
    },
    enabled: !!eventId,
  });
}

/** Count of pending/failed events (for admin monitoring) */
export function useWorkflowEventCounts() {
  return useQuery({
    queryKey: ['workflow-events', 'counts'],
    queryFn: async () => {
      const [{ count: pending }, { count: failed }, { count: completed }] = await Promise.all([
        supabase
          .from('workflow_events' as 'documents')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('workflow_events' as 'documents')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed'),
        supabase
          .from('workflow_events' as 'documents')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed'),
      ]);

      return {
        pending: pending ?? 0,
        failed: failed ?? 0,
        completed: completed ?? 0,
      };
    },
    refetchInterval: 30_000,
  });
}
