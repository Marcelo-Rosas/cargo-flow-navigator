import { useQuery } from '@tanstack/react-query';
import { asDb, filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import type { VehicleType } from '@/types/pricing';

/** Campos usados em selects operacionais + QuoteForm (WebRouter `categoria_veiculo` / eixos). */
const OPERATIONAL_SELECT = 'id, code, name, axes_count, ailog_category, active' as const;

export type VehicleTypeOperational = Pick<
  VehicleType,
  'id' | 'code' | 'name' | 'axes_count' | 'ailog_category' | 'active'
>;

export type VehicleTypeFleetFormRow = Pick<VehicleType, 'id' | 'code' | 'name'>;

/**
 * Admin: tipos ativos e inativos, ordenação por eixos (paridade com pricing).
 */
export function useVehicleTypesAdmin() {
  return useQuery({
    queryKey: ['vehicle-types', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .order('axes_count', { ascending: true });

      if (error) throw error;
      return filterSupabaseRows<VehicleType>(data);
    },
  });
}

/**
 * Operação: só ativos; inclui `ailog_category` para `calculate-distance-webrouter`.
 */
export function useVehicleTypesOperational() {
  return useQuery({
    queryKey: ['vehicle-types', 'operational', { activeOnly: true }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select(OPERATIONAL_SELECT)
        .eq('active', asDb(true))
        .order('axes_count', { ascending: true });

      if (error) throw error;
      return filterSupabaseRows<VehicleTypeOperational>(data);
    },
  });
}

/**
 * Formulário de veículo: dropdown por nome, cache mais longo.
 */
export function useVehicleTypesFleetForm() {
  return useQuery({
    queryKey: ['vehicle-types', 'fleet-form', { activeOnly: true }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('id, code, name')
        .eq('active', asDb(true))
        .order('name', { ascending: true });

      if (error) throw error;
      return filterSupabaseRows<VehicleTypeFleetFormRow>(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
