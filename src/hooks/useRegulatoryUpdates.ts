import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface RegulatoryUpdate {
  id: string;
  source: string;
  title: string;
  url: string | null;
  summary: string | null;
  relevance_score: number | null;
  ai_analysis: Record<string, unknown> | null;
  action_required: boolean;
  published_at: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────

/** Fetch latest regulatory updates ordered by created_at desc */
export function useRegulatoryUpdates(limit = 20) {
  return useQuery({
    queryKey: ['regulatory-updates', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regulatory_updates' as 'documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as unknown as RegulatoryUpdate[];
    },
  });
}

/** Fetch only high-relevance regulatory updates (relevance_score >= 7) */
export function useHighRelevanceUpdates() {
  return useQuery({
    queryKey: ['regulatory-updates', 'high-relevance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regulatory_updates' as 'documents')
        .select('*')
        .gte('relevance_score', 7)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as unknown as RegulatoryUpdate[];
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
