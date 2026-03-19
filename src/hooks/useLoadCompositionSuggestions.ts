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

export interface LoadCompositionSuggestion {
  id: string;
  shipper_id: string;
  quote_ids: string[];
  consolidation_score: number;
  estimated_savings_brl: number;
  distance_increase_percent: number;
  validation_warnings: string[];
  is_feasible: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  created_order_id?: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RoutingLeg {
  id: string;
  composition_id: string;
  route_sequence: number;
  quote_id?: string;
  leg_distance_km: number;
  leg_duration_min: number;
  leg_polyline: string;
  pickup_window_start?: string;
  pickup_window_end?: string;
  estimated_arrival?: string;
  is_feasible: boolean;
  created_at: string;
}

export interface CompositionMetric {
  id: string;
  composition_id: string;
  original_total_cost: number;
  composed_total_cost: number;
  savings_brl: number;
  savings_percent: number;
  original_km_total: number;
  composed_km_total: number;
  km_efficiency_percent?: number;
  co2_reduction_kg?: number;
  created_at: string;
}

export interface DiscountProposal {
  id: string;
  composition_id: string;
  quote_id: string;
  shipper_id: string;
  original_quote_price_brl: number; // centavos
  original_freight_cost_brl: number;
  original_margin_brl: number;
  original_margin_percent: number;
  max_discount_allowed_brl: number;
  discount_offered_brl: number;
  discount_percent: number;
  final_quote_price_brl: number;
  final_margin_brl: number;
  final_margin_percent: number;
  margin_rule_source: string; // 'global' | 'customer'
  minimum_margin_percent_applied: number;
  discount_strategy: string; // 'equal_share' | 'proportional_to_original' | 'weighted_by_weight'
  is_feasible: boolean;
  validation_warnings: string[];
  created_by?: string;
  created_at: string;
}

export interface LoadCompositionSuggestionWithDetails extends LoadCompositionSuggestion {
  routings?: RoutingLeg[];
  metrics?: CompositionMetric;
  discounts?: DiscountProposal[];
}

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
