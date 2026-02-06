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
      // Normalize state codes to uppercase
      const normalizedRates = rates.map(rate => ({
        ...rate,
        origin_state: rate.origin_state.toUpperCase(),
        destination_state: rate.destination_state.toUpperCase(),
      }));

      const { data, error } = await supabase
        .from('icms_rates')
        .upsert(normalizedRates, {
          onConflict: 'origin_state,destination_state',
          ignoreDuplicates: false,
        })
        .select();

      if (error) throw error;
      return data;
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
