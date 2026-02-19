import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Document = Database['public']['Tables']['documents']['Row'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<Document>(data);
    },
  });
}

export function useDocumentsByQuote(quoteId: string) {
  return useQuery({
    queryKey: ['documents', 'quote', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('quote_id', asDb(quoteId))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<Document>(data);
    },
    enabled: !!quoteId,
  });
}

export function useDocumentsByOrder(orderId: string) {
  return useQuery({
    queryKey: ['documents', 'order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('order_id', asDb(orderId))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<Document>(data);
    },
    enabled: !!orderId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (document: DocumentInsert) => {
      const { data, error } = await supabase
        .from('documents')
        .insert(asInsert(document))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documents').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
