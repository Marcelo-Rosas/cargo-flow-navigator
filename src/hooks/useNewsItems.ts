import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source_type: 'email' | 'web';
  source_name: string | null;
  source_url: string | null;
  relevance_score: number | null;
  created_at: string;
  raw_snippet: string | null;
}

// ─────────────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────────────

/** Fetch latest news items (pricing impact) ordered by created_at desc */
export function useNewsItems(limit = 50) {
  return useQuery({
    queryKey: ['news-items', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_items')
        .select(
          'id, title, summary, source_type, source_name, source_url, relevance_score, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as NewsItem[];
    },
  });
}
