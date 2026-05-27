import { useEffect, useMemo } from 'react';
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
  // Stable reference to avoid effect re-runs when caller passes inline arrays
  const tablesKey = useMemo(() => tables.sort().join(','), [tables]);

  useEffect(() => {
    const tablesSet = new Set(tables);

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
          if (tablesSet.has('quotes')) {
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
          if (tablesSet.has('orders')) {
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
          if (tablesSet.has('occurrences')) {
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
          if (tablesSet.has('clients')) {
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
          if (tablesSet.has('financial_documents')) {
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
          if (tablesSet.has('financial_installments')) {
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
          if (tablesSet.has('quote_payment_proofs')) {
            queryClient.invalidateQueries({ queryKey: ['quote_payment_proofs'] });
            queryClient.invalidateQueries({ queryKey: ['quote_reconciliation'] });
            queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useRealtimeSubscription] Realtime channel error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tablesKey]);
}
