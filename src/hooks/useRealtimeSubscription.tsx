import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type TableName = 'quotes' | 'orders' | 'occurrences' | 'clients';

export function useRealtimeSubscription(tables: TableName[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('realtime-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
        },
        () => {
          if (tables.includes('quotes')) {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          if (tables.includes('orders')) {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'occurrences',
        },
        () => {
          if (tables.includes('occurrences')) {
            queryClient.invalidateQueries({ queryKey: ['occurrences'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        () => {
          if (tables.includes('clients')) {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tables]);
}
