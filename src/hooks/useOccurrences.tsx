import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type OccurrenceInsert = Database['public']['Tables']['occurrences']['Insert'];
type OccurrenceUpdate = Database['public']['Tables']['occurrences']['Update'];

export function useOccurrences() {
  return useQuery({
    queryKey: ['occurrences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('occurrences')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Occurrence[];
    },
  });
}

export function useOccurrencesByOrder(orderId: string) {
  return useQuery({
    queryKey: ['occurrences', 'order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('occurrences')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Occurrence[];
    },
    enabled: !!orderId,
  });
}

export function useCreateOccurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (occurrence: OccurrenceInsert) => {
      const { data, error } = await supabase
        .from('occurrences')
        .insert(occurrence)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOccurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: OccurrenceUpdate }) => {
      const { data, error } = await supabase
        .from('occurrences')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useResolveOccurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, resolved_by }: { id: string; resolved_by: string }) => {
      const { data, error } = await supabase
        .from('occurrences')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useDeleteOccurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('occurrences').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
