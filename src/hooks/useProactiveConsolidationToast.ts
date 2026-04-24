import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LoadCompositionSuggestion } from '@/types/load-composition';

const MIN_SCORE = 60;

function formatSavings(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    centavos / 100
  );
}

function showConsolidationToast(
  toast: ReturnType<typeof useToast>['toast'],
  count: number,
  savings: number
) {
  const plural = count > 1;
  toast({
    title: '🚀 Oportunidade de Consolidação!',
    description: plural
      ? `A IA detectou ${count} oportunidades com economia estimada de ${formatSavings(savings)}.`
      : `A IA detectou uma economia de ${formatSavings(savings)} ao consolidar cargas.`,
    variant: 'default',
  });
}

type RealtimeSuggestionPayload = Pick<
  LoadCompositionSuggestion,
  'id' | 'estimated_savings_brl' | 'consolidation_score' | 'status' | 'trigger_source'
>;

export function useProactiveConsolidationToast(enabled = true) {
  const { toast } = useToast();

  // Check on mount for suggestions that already exist in the DB
  useEffect(() => {
    if (!enabled) return;
    async function checkExisting() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('load_composition_suggestions' as never)
        .select('id, estimated_savings_brl, consolidation_score, trigger_source, status')
        .in('trigger_source', ['on_save', 'realtime'])
        .eq('status', 'pending')
        .gte('consolidation_score', MIN_SCORE);

      if (error || !data || data.length === 0) return;

      const totalSavings = data.reduce(
        (acc: number, s: LoadCompositionSuggestion) => acc + (s.estimated_savings_brl ?? 0),
        0
      );
      showConsolidationToast(toast, data.length, totalSavings);
      console.log('[T6.1] Mount check: found', data.length, 'pending suggestion(s)');
    }

    checkExisting();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time listener for new inserts while the user is on the page
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('proactive-consolidation')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'load_composition_suggestions' },
        (payload) => {
          const s = payload.new as RealtimeSuggestionPayload;
          if (
            ['on_save', 'realtime'].includes(s.trigger_source) &&
            s.status === 'pending' &&
            s.consolidation_score >= MIN_SCORE
          ) {
            showConsolidationToast(toast, 1, s.estimated_savings_brl ?? 0);
            console.log('[T6.1] Realtime toast triggered for suggestion:', s.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, toast]);
}
