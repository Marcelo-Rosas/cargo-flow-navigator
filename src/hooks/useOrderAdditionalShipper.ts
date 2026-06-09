import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  loadShipperById,
  resolveFirstAdditionalShipperEntry,
  shipperRecordToPartyData,
} from '@/lib/collection-order-parties';
import type { CollectionOrderPartyData } from '@/types/collectionOrder';

interface UseOrderAdditionalShipperInput {
  orderId: string;
  quoteId?: string | null;
  orderAdditionalShippers?: unknown;
}

export function useOrderAdditionalShipperPreview({
  orderId,
  quoteId,
  orderAdditionalShippers,
}: UseOrderAdditionalShipperInput) {
  return useQuery({
    queryKey: ['order-additional-shipper', orderId, quoteId, orderAdditionalShippers],
    enabled: !!orderId,
    queryFn: async (): Promise<CollectionOrderPartyData | null> => {
      const entry = await resolveFirstAdditionalShipperEntry(supabase, {
        quoteId,
        orderAdditionalShippers,
      });
      if (!entry) return null;

      const shipper = entry.shipper_id ? await loadShipperById(supabase, entry.shipper_id) : null;
      return shipperRecordToPartyData(shipper, { quoteEntry: entry });
    },
    staleTime: 60_000,
  });
}
