import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type TableName =
  | 'quotes'
  | 'orders'
  | 'occurrences'
  | 'clients'
  | 'financial_documents'
  | 'financial_installments'
  | 'quote_payment_proofs';

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_documents',
        },
        () => {
          if (tables.includes('financial_documents')) {
            queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['card'] });
            queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_installments',
        },
        () => {
          if (tables.includes('financial_installments')) {
            queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['card'] });
            queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quote_payment_proofs',
        },
        () => {
          if (tables.includes('quote_payment_proofs')) {
            queryClient.invalidateQueries({ queryKey: ['quote_payment_proofs'] });
            queryClient.invalidateQueries({ queryKey: ['quote_reconciliation'] });
            queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tables]);
}
