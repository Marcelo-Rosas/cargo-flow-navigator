import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  PricingParameter,
  VehicleType,
  WaitingTimeRule,
  TollRoute,
  TacRate,
  ConditionalFee,
  PaymentTerm,
} from '@/types/pricing';

// =====================================================
// PRICING PARAMETERS MUTATIONS
// =====================================================

export function useUpdatePricingParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PricingParameter> }) => {
      const { data, error } = await supabase
        .from('pricing_parameters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-parameters'] });
    },
  });
}

export function useCreatePricingParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      key: string;
      value: number;
      unit?: string;
      description?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('pricing_parameters')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-parameters'] });
    },
  });
}

export function useDeletePricingParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pricing_parameters').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-parameters'] });
    },
  });
}

// =====================================================
// VEHICLE TYPES MUTATIONS
// =====================================================

export function useCreateVehicleType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<VehicleType, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('vehicle_types')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] });
    },
  });
}

export function useUpdateVehicleType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<VehicleType> }) => {
      const { data, error } = await supabase
        .from('vehicle_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] });
    },
  });
}

export function useDeleteVehicleType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicle_types').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-types'] });
    },
  });
}

// =====================================================
// WAITING TIME RULES MUTATIONS
// =====================================================

export function useCreateWaitingTimeRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      vehicle_type_id?: string | null;
      context: string;
      free_hours: number;
      rate_per_hour?: number | null;
      rate_per_day?: number | null;
      min_charge?: number | null;
    }) => {
      const { data: result, error } = await supabase
        .from('waiting_time_rules')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiting-time-rules'] });
    },
  });
}

export function useUpdateWaitingTimeRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WaitingTimeRule> }) => {
      const { data, error } = await supabase
        .from('waiting_time_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiting-time-rules'] });
    },
  });
}

export function useDeleteWaitingTimeRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('waiting_time_rules').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiting-time-rules'] });
    },
  });
}

// =====================================================
// TOLL ROUTES MUTATIONS
// =====================================================

export function useCreateTollRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      origin_state: string;
      origin_city?: string | null;
      destination_state: string;
      destination_city?: string | null;
      vehicle_type_id?: string | null;
      toll_value: number;
      distance_km?: number | null;
      via_description?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from('toll_routes')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toll-routes'] });
    },
  });
}

export function useUpdateTollRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TollRoute> }) => {
      const { data, error } = await supabase
        .from('toll_routes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toll-routes'] });
    },
  });
}

export function useDeleteTollRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('toll_routes').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toll-routes'] });
    },
  });
}

// =====================================================
// TAC RATES MUTATIONS
// =====================================================

export function useCreateTacRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      reference_date: string;
      diesel_price_base: number;
      diesel_price_current: number;
      adjustment_percent: number;
      source_description?: string | null;
    }) => {
      const variation_percent =
        ((data.diesel_price_current - data.diesel_price_base) / data.diesel_price_base) * 100;

      const { data: result, error } = await supabase
        .from('tac_rates')
        .insert({ ...data, variation_percent })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tac-rates'] });
    },
  });
}

export function useUpdateTacRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TacRate> }) => {
      let variation_percent = updates.variation_percent;
      if (updates.diesel_price_base !== undefined && updates.diesel_price_current !== undefined) {
        variation_percent =
          ((updates.diesel_price_current - updates.diesel_price_base) / updates.diesel_price_base) *
          100;
      }

      const { data, error } = await supabase
        .from('tac_rates')
        .update({ ...updates, variation_percent })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tac-rates'] });
    },
  });
}

export function useDeleteTacRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tac_rates').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tac-rates'] });
    },
  });
}

// =====================================================
// CONDITIONAL FEES MUTATIONS
// =====================================================

export function useCreateConditionalFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      code: string;
      name: string;
      description?: string | null;
      fee_type: string;
      fee_value: number;
      min_value?: number | null;
      max_value?: number | null;
      applies_to: string;
      active?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('conditional_fees')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conditional-fees'] });
    },
  });
}

export function useUpdateConditionalFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<ConditionalFee, 'conditions'>>;
    }) => {
      const { data, error } = await supabase
        .from('conditional_fees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conditional-fees'] });
    },
  });
}

export function useDeleteConditionalFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('conditional_fees').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conditional-fees'] });
    },
  });
}

// =====================================================
// PAYMENT TERMS MUTATIONS
// =====================================================

export function useCreatePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      code: string;
      name: string;
      days: number;
      adjustment_percent: number;
      active?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('payment_terms')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
    },
  });
}

export function useUpdatePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PaymentTerm> }) => {
      const { data, error } = await supabase
        .from('payment_terms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
    },
  });
}

export function useDeletePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_terms').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
    },
  });
}
