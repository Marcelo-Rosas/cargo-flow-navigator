/**
 * Hook: useLoadCompositionSuggestions
 * Fetches load composition suggestions for a shipper
 *
 * Usage:
 *   const { data, isLoading, error } = useLoadCompositionSuggestions({
 *     shipper_id: 'abc-123',
 *     status: 'pending'
 *   });
 */

import React from 'react';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LoadCompositionSuggestionWithDetails } from '@/types/load-composition';
export type {
  TriggerSource,
  LoadCompositionSuggestion,
  RoutingLeg,
  CompositionMetric,
  DiscountProposal,
  LoadCompositionSuggestionWithDetails,
} from '@/types/load-composition';

export interface UseLoadCompositionSuggestionsParams {
  shipper_id?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'executed';
  date_from?: Date;
  date_to?: Date;
  include_details?: boolean;
}

/**
 * Hook to fetch load composition suggestions
 */
export function useLoadCompositionSuggestions(
  params: UseLoadCompositionSuggestionsParams
): UseQueryResult<LoadCompositionSuggestionWithDetails[], Error> {
  return useQuery<LoadCompositionSuggestionWithDetails[], Error>({
    queryKey: ['load-composition-suggestions', params],
    queryFn: async () => {
      const { shipper_id, status, date_from, date_to, include_details = false } = params;

      if (!shipper_id) {
        return [];
      }

      let query = supabase
        // Cast to never to bypass generated type limitations for this new table
        .from('load_composition_suggestions' as never)
        .select(
          include_details
            ? `
              *,
              routings:load_composition_routings(*),
              metrics:load_composition_metrics(*),
              discounts:load_composition_discount_breakdown(*)
            `
            : '*'
        )
        .eq('shipper_id', shipper_id);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (date_from) {
        query = query.gte('created_at', date_from.toISOString());
      }

      if (date_to) {
        query = query.lte('created_at', date_to.toISOString());
      }

      // Order by score descending
      query = query.order('consolidation_score', { ascending: false });

      const { data, error } = (await query) as {
        data: unknown[] | null;
        error: { message: string } | null;
      };

      if (error) {
        throw new Error(`Failed to fetch suggestions: ${error.message}`);
      }

      const raw = (data ?? []) as unknown;
      return raw as LoadCompositionSuggestionWithDetails[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!params.shipper_id,
  });
}

/**
 * Hook to fetch a single composition with full details
 */
export function useLoadCompositionSuggestion(
  compositionId?: string
): UseQueryResult<LoadCompositionSuggestionWithDetails | null, Error> {
  return useQuery<LoadCompositionSuggestionWithDetails | null, Error>({
    queryKey: ['load-composition-suggestion', compositionId],
    queryFn: async () => {
      if (!compositionId) return null;

      const { data, error } = (await supabase
        // Cast to never to bypass generated type limitations for this new table
        .from('load_composition_suggestions' as never)
        .select(
          `
          *,
          routings:load_composition_routings(*),
          metrics:load_composition_metrics(*),
          discounts:load_composition_discount_breakdown(*)
        `
        )
        .eq('id', compositionId)
        .single()) as {
        data: unknown | null;
        error: { message: string; code?: string } | null;
      };

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to fetch suggestion: ${error.message}`);
      }

      return data as LoadCompositionSuggestionWithDetails;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!compositionId,
  });
}

/**
 * Hook to watch for new suggestions (real-time)
 * Uses Supabase JS v2 channel API (postgres_changes)
 * Note: load_composition_suggestions must be in supabase_realtime publication
 */
export function useLoadCompositionSuggestionsRealtime(shipperId?: string) {
  const query = useLoadCompositionSuggestions({
    shipper_id: shipperId,
    status: 'pending',
  });

  React.useEffect(() => {
    if (!shipperId) return;

    const channel = supabase
      .channel(`load-composition-${shipperId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'load_composition_suggestions',
          filter: `shipper_id=eq.${shipperId}`,
        },
        () => {
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shipperId, query]);

  return query;
}
