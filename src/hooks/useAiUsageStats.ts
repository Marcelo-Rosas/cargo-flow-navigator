import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface ModelStats {
  model_used: string;
  calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cost: number;
}

interface TypeStats {
  analysis_type: string;
  calls: number;
  total_cost: number;
}

interface ErrorEntry {
  analysis_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface AiUsageStats {
  daily_spend: number;
  monthly_spend: number;
  daily_limit: number;
  monthly_limit: number;
  alert_threshold: number;
  today_calls: number;
  month_calls: number;
  today_by_model: ModelStats[] | null;
  month_by_type: TypeStats[] | null;
  recent_errors: ErrorEntry[] | null;
}

// ─────────────────────────────────────────────────────
// Hook: Full usage statistics
// ─────────────────────────────────────────────────────

export function useAiUsageStats() {
  return useQuery({
    queryKey: ['ai-usage-stats'],
    queryFn: async (): Promise<AiUsageStats> => {
      const { data, error } = await supabase.rpc('get_ai_usage_stats' as never);

      if (error) {
        console.warn('Failed to fetch AI usage stats:', error.message);
        return {
          daily_spend: 0,
          monthly_spend: 0,
          daily_limit: 2,
          monthly_limit: 30,
          alert_threshold: 0.8,
          today_calls: 0,
          month_calls: 0,
          today_by_model: null,
          month_by_type: null,
          recent_errors: null,
        };
      }

      return data as unknown as AiUsageStats;
    },
    refetchInterval: 5 * 60_000, // Refresh every 5 min
    staleTime: 2 * 60_000,
  });
}

// ─────────────────────────────────────────────────────
// Hook: Recent usage history (last N entries)
// ─────────────────────────────────────────────────────

export interface UsageEntry {
  id: string;
  analysis_type: string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  estimated_cost_usd: number;
  status: string;
  entity_type: string | null;
  duration_ms: number | null;
  created_at: string;
}

export function useRecentAiUsage(limit = 20) {
  return useQuery({
    queryKey: ['ai-usage-recent', limit],
    queryFn: async (): Promise<UsageEntry[]> => {
      const { data, error } = await supabase
        .from('ai_usage_tracking' as never)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Failed to fetch recent AI usage:', error.message);
        return [];
      }

      return (data || []) as unknown as UsageEntry[];
    },
    refetchInterval: 5 * 60_000,
  });
}
