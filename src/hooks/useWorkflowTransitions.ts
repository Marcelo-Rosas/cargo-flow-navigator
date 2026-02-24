import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface ValidTransition {
  to_stage: string;
  description: string | null;
  requires_approval: boolean;
  required_documents: string[];
}

export interface TransitionValidation {
  valid: boolean;
  errors: string[];
  requires_approval: boolean;
  approval_type: string | null;
  post_actions: unknown[];
  required_fields: string[];
  required_documents: string[];
  description?: string;
}

// ─────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────

/**
 * Get all valid target stages from a given entity type + current stage.
 * Useful for showing available transitions in Kanban drop targets.
 */
export function useValidTransitions(entityType: string, fromStage: string) {
  return useQuery({
    queryKey: ['workflow-transitions', entityType, fromStage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_valid_transitions' as never,
        {
          p_entity_type: entityType,
          p_from_stage: fromStage,
        } as never
      );

      if (error) {
        if (error.code === '42883') return []; // Function doesn't exist yet
        throw error;
      }

      return (data ?? []) as ValidTransition[];
    },
    enabled: !!entityType && !!fromStage,
    staleTime: 5 * 60 * 1000, // 5 minutes (transitions rarely change)
  });
}

// ─────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────

/**
 * Validate a specific transition before executing it.
 * Returns detailed info about requirements and approval needs.
 */
export function useValidateTransition() {
  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      fromStage,
      toStage,
    }: {
      entityType: string;
      entityId: string;
      fromStage: string;
      toStage: string;
    }) => {
      const { data, error } = await supabase.rpc(
        'validate_transition' as never,
        {
          p_entity_type: entityType,
          p_entity_id: entityId,
          p_from_stage: fromStage,
          p_to_stage: toStage,
        } as never
      );

      if (error) throw error;
      return data as TransitionValidation;
    },
  });
}
