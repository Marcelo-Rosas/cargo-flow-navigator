import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type IcmsRate = Database['public']['Tables']['icms_rates']['Row'];
type IcmsRateInsert = Database['public']['Tables']['icms_rates']['Insert'];
type IcmsRateUpdate = Database['public']['Tables']['icms_rates']['Update'];

export function useIcmsRates() {
  return useQuery({
    queryKey: ['icms_rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icms_rates')
        .select('*')
        .order('origin_state', { ascending: true })
        .order('destination_state', { ascending: true });

      if (error) throw error;
      return data as IcmsRate[];
    },
  });
}

export function useIcmsRate(originState: string, destinationState: string) {
  return useQuery({
    queryKey: ['icms_rates', originState, destinationState],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icms_rates')
        .select('*')
        .eq('origin_state', originState.toUpperCase())
        .eq('destination_state', destinationState.toUpperCase())
        .maybeSingle();

      if (error) throw error;
      return data as IcmsRate | null;
    },
    enabled: !!originState && !!destinationState,
  });
}

export function useIcmsRatesByOrigin(originState: string) {
  return useQuery({
    queryKey: ['icms_rates', 'origin', originState],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icms_rates')
        .select('*')
        .eq('origin_state', originState.toUpperCase())
        .order('destination_state', { ascending: true });

      if (error) throw error;
      return data as IcmsRate[];
    },
    enabled: !!originState,
  });
}

export function useCreateIcmsRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rate: IcmsRateInsert) => {
      const { data, error } = await supabase
        .from('icms_rates')
        .insert({
          ...rate,
          origin_state: rate.origin_state.toUpperCase(),
          destination_state: rate.destination_state.toUpperCase(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icms_rates'] });
    },
  });
}

export function useUpdateIcmsRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: IcmsRateUpdate }) => {
      const normalizedUpdates = {
        ...updates,
        ...(updates.origin_state && { origin_state: updates.origin_state.toUpperCase() }),
        ...(updates.destination_state && { destination_state: updates.destination_state.toUpperCase() }),
      };

      const { data, error } = await supabase
        .from('icms_rates')
        .update(normalizedUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icms_rates'] });
    },
  });
}

export function useDeleteIcmsRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('icms_rates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icms_rates'] });
    },
  });
}

export function useUpsertIcmsRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rates: Omit<IcmsRateInsert, 'id'>[]) => {
      const results = [];

      for (const rate of rates) {
        const originState = rate.origin_state.toUpperCase();
        const destState = rate.destination_state.toUpperCase();
        
        // Normalize rate_percent: if value is between 0 and 1, multiply by 100
        // This ensures values like 0.12 become 12 (percent scale)
        let normalizedRate = Number(rate.rate_percent);
        if (normalizedRate > 0 && normalizedRate < 1) {
          normalizedRate = normalizedRate * 100;
        }

        // Check if record exists
        const { data: existing } = await supabase
          .from('icms_rates')
          .select('id')
          .eq('origin_state', originState)
          .eq('destination_state', destState)
          .maybeSingle();

        if (existing) {
          // Update existing record
          const { data, error } = await supabase
            .from('icms_rates')
            .update({
              rate_percent: normalizedRate,
              valid_from: rate.valid_from,
              valid_until: rate.valid_until,
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          results.push(data);
        } else {
          // Insert new record
          const { data, error } = await supabase
            .from('icms_rates')
            .insert({
              origin_state: originState,
              destination_state: destState,
              rate_percent: normalizedRate,
              valid_from: rate.valid_from,
              valid_until: rate.valid_until,
            })
            .select()
            .single();

          if (error) throw error;
          results.push(data);
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icms_rates'] });
    },
  });
}

// Helper hook to get ICMS rate for quote pricing
export function useIcmsRateForPricing(originState?: string, destinationState?: string) {
  return useQuery({
    queryKey: ['icms_rates', 'pricing', originState, destinationState],
    queryFn: async () => {
      if (!originState || !destinationState) return null;

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('icms_rates')
        .select('*')
        .eq('origin_state', originState.toUpperCase())
        .eq('destination_state', destinationState.toUpperCase())
        .or(`valid_from.is.null,valid_from.lte.${today}`)
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .maybeSingle();

      if (error) throw error;
      return data as IcmsRate | null;
    },
    enabled: !!originState && !!destinationState,
  });
}
