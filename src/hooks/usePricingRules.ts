import { useQuery } from '@tanstack/react-query';
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
// PRICING PARAMETERS
// =====================================================

export function usePricingParameters() {
  return useQuery({
    queryKey: ['pricing-parameters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_parameters').select('*').order('key');

      if (error) throw error;
      return data as PricingParameter[];
    },
  });
}

export function usePricingParameter(key: string) {
  return useQuery({
    queryKey: ['pricing-parameters', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_parameters')
        .select('*')
        .eq('key', key)
        .maybeSingle();

      if (error) throw error;
      return data as PricingParameter | null;
    },
    enabled: !!key,
  });
}

// =====================================================
// VEHICLE TYPES
// =====================================================

export function useVehicleTypes(activeOnly = true) {
  return useQuery({
    queryKey: ['vehicle-types', { activeOnly }],
    queryFn: async () => {
      let query = supabase.from('vehicle_types').select('*').order('axes_count');

      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as VehicleType[];
    },
  });
}

// =====================================================
// WAITING TIME RULES
// =====================================================

export function useWaitingTimeRules() {
  return useQuery({
    queryKey: ['waiting-time-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiting_time_rules')
        .select('*, vehicle_types(code, name)')
        .order('vehicle_type_id', { nullsFirst: true });

      if (error) throw error;
      return data as (WaitingTimeRule & { vehicle_types: { code: string; name: string } | null })[];
    },
  });
}

// =====================================================
// TOLL ROUTES
// =====================================================

export function useTollRoutes() {
  return useQuery({
    queryKey: ['toll-routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('toll_routes')
        .select('*, vehicle_types(code, name)')
        .order('origin_state')
        .order('destination_state');

      if (error) throw error;
      return data as (TollRoute & { vehicle_types: { code: string; name: string } | null })[];
    },
  });
}

// =====================================================
// TAC RATES
// =====================================================

export function useTacRates() {
  return useQuery({
    queryKey: ['tac-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tac_rates')
        .select('*')
        .order('reference_date', { ascending: false });

      if (error) throw error;
      return data as TacRate[];
    },
  });
}

export function useLatestTacRate() {
  return useQuery({
    queryKey: ['tac-rates', 'latest'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('tac_rates')
        .select('*')
        .lte('reference_date', today)
        .order('reference_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as TacRate | null;
    },
  });
}

// =====================================================
// CONDITIONAL FEES
// =====================================================

export function useConditionalFees(activeOnly = true) {
  return useQuery({
    queryKey: ['conditional-fees', { activeOnly }],
    queryFn: async () => {
      let query = supabase.from('conditional_fees').select('*').order('code');

      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConditionalFee[];
    },
  });
}

// =====================================================
// PAYMENT TERMS
// =====================================================

export function usePaymentTerms(activeOnly = true) {
  return useQuery({
    queryKey: ['payment-terms', { activeOnly }],
    queryFn: async () => {
      let query = supabase.from('payment_terms').select('*').order('days');

      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PaymentTerm[];
    },
  });
}
