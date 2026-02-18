import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type VehicleRow = Database['public']['Tables']['vehicles']['Row'];
type VehicleInsert = Database['public']['Tables']['vehicles']['Insert'];
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update'];

export type Vehicle = VehicleRow;

export interface VehicleWithRelations extends VehicleRow {
  owner?: { id: string; name: string; phone: string | null } | null;
  driver?: { id: string; name: string } | null;
}

const selectWithRelations =
  'id, plate, driver_id, owner_id, active, brand, model, owner:owners(id,name,phone), driver:drivers(id,name)';

export function useVehicles(driverId?: string | null) {
  return useQuery({
    queryKey: ['vehicles', driverId],
    queryFn: async () => {
      let query = supabase
        .from('vehicles')
        .select(selectWithRelations)
        .eq('active', asDb(true))
        .order('plate', { ascending: true });

      if (driverId) {
        query = query.eq('driver_id', asDb(driverId));
      }

      const { data, error } = await query;

      if (error) throw error;
      return filterSupabaseRows<VehicleWithRelations>(data);
    },
  });
}

export function useVehicle(id: string | null | undefined) {
  return useQuery({
    queryKey: ['vehicles', 'single', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('vehicles')
        .select(selectWithRelations)
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<VehicleWithRelations>(data);
    },
    enabled: !!id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vehicle: VehicleInsert) => {
      const { data, error } = await supabase
        .from('vehicles')
        .insert(asInsert(vehicle))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: VehicleUpdate }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicles').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}
