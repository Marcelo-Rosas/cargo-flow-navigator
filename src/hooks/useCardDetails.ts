import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  cardQueryKey,
  mapCardFullDataToCanonicalCard,
  type CanonicalCard,
  type CardFullDataRpc,
} from '@/lib/card-mapping';

type Params = {
  quoteId?: string | null;
  orderId?: string | null;
  enabled?: boolean;
};

export function useCardDetails(params: Params) {
  const { quoteId, orderId, enabled = true } = params;
  const effectiveEnabled = !!(quoteId || orderId) && enabled;

  return useQuery({
    queryKey: cardQueryKey(quoteId, orderId),
    queryFn: async (): Promise<CanonicalCard | null> => {
      const { data, error } = await supabase.rpc('get_card_full_data', {
        p_quote_id: quoteId || null,
        p_order_id: orderId || null,
      });

      if (error) throw error;
      const rpc = (data ?? null) as CardFullDataRpc | null;
      if (!rpc) return null;
      return mapCardFullDataToCanonicalCard(rpc);
    },
    enabled: effectiveEnabled,
  });
}
