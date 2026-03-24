/**
 * Hook: useLoadCompositionController
 *
 * Single source of truth for Load Composition state and actions.
 * Used by both LoadCompositionPanel and LoadCompositionOverlay
 * to eliminate duplicated handlers, queries and mutations.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLoadCompositionSuggestions } from '@/hooks/useLoadCompositionSuggestions';
import type { LoadCompositionSuggestionWithDetails } from '@/types/load-composition';
import { useApproveComposition } from '@/hooks/useApproveComposition';
import { useAnalyzeLoadComposition } from '@/hooks/useAnalyzeLoadComposition';
import { useCalculateDiscounts } from '@/hooks/useCalculateDiscounts';

export type CompositionFilterStatus = 'all' | 'pending' | 'approved' | 'executed';

export interface QuoteInfo {
  id: string;
  quote_code: string | null;
  client_name: string;
  destination: string;
  value: number;
  estimated_loading_date: string | null;
  weight: number | null;
}

export interface UseLoadCompositionControllerParams {
  shipperId: string;
  dateRange?: { from: Date; to: Date };
}

export function useLoadCompositionController({
  shipperId,
  dateRange,
}: UseLoadCompositionControllerParams) {
  // --- UI state ---
  const [filterStatus, setFilterStatus] = useState<CompositionFilterStatus>('pending');
  const [selectedCompositionId, setSelectedCompositionId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // --- Queries ---
  const {
    data: suggestions,
    isLoading,
    error,
    refetch,
  } = useLoadCompositionSuggestions({
    shipper_id: shipperId,
    status: filterStatus === 'all' ? undefined : filterStatus,
    date_from: dateRange?.from,
    date_to: dateRange?.to,
    include_details: true,
  });

  // Collect quote IDs for detail fetch
  const allQuoteIds = useMemo(() => {
    if (!suggestions) return [];
    const ids = new Set<string>();
    for (const s of suggestions) {
      for (const qid of s.quote_ids) ids.add(qid);
    }
    return Array.from(ids);
  }, [suggestions]);

  const { data: quoteInfoMap } = useQuery({
    queryKey: ['composition-quote-info', allQuoteIds],
    queryFn: async () => {
      if (allQuoteIds.length === 0) return {};
      const { data } = (await supabase
        .from('quotes' as never)
        .select('id, quote_code, client_name, destination, value, estimated_loading_date, weight')
        .in('id', allQuoteIds)) as unknown as { data: QuoteInfo[] | null };
      const map: Record<string, QuoteInfo> = {};
      for (const q of data ?? []) {
        map[q.id] = q;
      }
      return map;
    },
    enabled: allQuoteIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // --- Mutations ---
  const { mutate: approve, isPending: isApproving } = useApproveComposition();
  const { mutate: analyzeComposition, isPending: isAnalyzing } = useAnalyzeLoadComposition();
  const { mutate: calculateDiscounts, isPending: isCalculatingDiscounts } = useCalculateDiscounts();

  // --- Derived ---
  const filteredSuggestions = useMemo<LoadCompositionSuggestionWithDetails[]>(() => {
    if (!suggestions) return [];
    if (filterStatus === 'all') return suggestions;
    return suggestions.filter((s) => s.status === filterStatus);
  }, [suggestions, filterStatus]);

  // Economia máxima realizável: greedy pick de sugestões não-sobrepostas (por score desc)
  const { maxRealizableSavingsCents, realizableCount } = useMemo(() => {
    const sorted = [...filteredSuggestions].sort(
      (a, b) => b.consolidation_score - a.consolidation_score
    );
    const usedQuoteIds = new Set<string>();
    let savings = 0;
    let count = 0;
    for (const s of sorted) {
      const overlaps = s.quote_ids.some((qid) => usedQuoteIds.has(qid));
      if (!overlaps) {
        savings += s.estimated_savings_brl;
        count++;
        for (const qid of s.quote_ids) usedQuoteIds.add(qid);
      }
    }
    return { maxRealizableSavingsCents: savings, realizableCount: count };
  }, [filteredSuggestions]);

  const totalSuggestions = filteredSuggestions.length;
  const feasibleCount = filteredSuggestions.filter((s) => s.is_feasible).length;

  // --- Handlers ---
  /** Kanban "Gerar sugestões" — explicit batch mode (distinct from on_save / manual). */
  const handleAnalyze = () => {
    analyzeComposition({ shipper_id: shipperId, trigger_source: 'batch' });
  };

  /** "Atualizar" — deleta sugestões pendentes e re-analisa do zero */
  const handleRefresh = async () => {
    // Deletar sugestões pendentes do embarcador para forçar nova geração (sem dedup)
    await supabase
      .from('load_composition_suggestions' as never)
      .delete()
      .eq('shipper_id', shipperId)
      .eq('status', 'pending');
    // Re-analisar
    analyzeComposition({ shipper_id: shipperId, trigger_source: 'batch' });
  };

  const handleApprove = (compositionId: string) => {
    approve({ composition_id: compositionId });
  };

  const handleCalculateDiscounts = (compositionId: string) => {
    calculateDiscounts({
      composition_id: compositionId,
      discount_strategy: 'proportional_to_original',
      minimum_margin_percent: 30,
      simulate_only: false,
    });
  };

  const handleViewDetails = (compositionId: string) => {
    setSelectedCompositionId(compositionId);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCompositionId(null);
  };

  const handleApproveFromModal = () => {
    if (selectedCompositionId) {
      handleApprove(selectedCompositionId);
      setShowModal(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return {
    // State
    filterStatus,
    setFilterStatus,
    selectedCompositionId,
    showModal,
    expandedIds,

    // Data
    suggestions: filteredSuggestions,
    quoteInfoMap: quoteInfoMap ?? {},
    isLoading,
    error,

    // Summary
    totalSavingsCents: maxRealizableSavingsCents,
    realizableCount,
    totalSuggestions,
    feasibleCount,

    // Mutation state
    isAnalyzing,
    isApproving,
    isCalculatingDiscounts,

    // Actions
    refetch,
    handleAnalyze,
    handleRefresh,
    handleApprove,
    handleCalculateDiscounts,
    handleViewDetails,
    handleCloseModal,
    handleApproveFromModal,
    toggleExpand,
  };
}
