import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateCollectionOrderPdf } from '@/lib/generateCollectionOrderPdf';
import type {
  CollectionOrder,
  CollectionOrderCargoData,
  CollectionOrderDriverData,
  CollectionOrderPartyData,
  CollectionOrderVehicleData,
} from '@/types/collectionOrder';

const COLLECTION_ORDERS_QK = 'collection_orders';

export function useCollectionOrders(orderId: string | undefined) {
  return useQuery({
    queryKey: [COLLECTION_ORDERS_QK, 'order', orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<CollectionOrder[]> => {
      const { data, error } = await supabase
        .from('collection_orders')
        .select('*')
        .eq('order_id', orderId!)
        .order('issued_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CollectionOrder[];
    },
    staleTime: 30_000,
  });
}

export interface CancelCollectionOrderInput {
  collectionOrderId: string;
  reason?: string | null;
}

export function useCancelCollectionOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ collectionOrderId, reason }: CancelCollectionOrderInput) => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id ?? null;

      const { data, error } = await supabase
        .from('collection_orders')
        .update({
          status: 'cancelada',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: reason ?? null,
        })
        .eq('id', collectionOrderId)
        .eq('status', 'emitida')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_ORDERS_QK, 'order', orderId] });
    },
  });
}

export function downloadCollectionOrderPdf(storagePath: string | null | undefined) {
  if (!storagePath) {
    return Promise.reject(new Error('PDF nao disponivel para esta OC'));
  }
  return supabase.storage
    .from('collection-orders')
    .createSignedUrl(storagePath, 60 * 5)
    .then(({ data, error }) => {
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('URL assinada nao retornada');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    });
}

// ── Create ──────────────────────────────────────────────────────────────────────

export interface CreateCollectionOrderInput {
  orderId: string;
  /** Texto livre para "Informações Adicionais" (auto da cotação + edits) */
  additionalInfo?: string | null;
  /** Override opcional dos campos do remetente (para preencher Nº/Bairro/Comp se shipper estava sem) */
  senderOverride?: Partial<CollectionOrderPartyData>;
}

export function useCreateCollectionOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId: oid,
      additionalInfo,
      senderOverride,
    }: CreateCollectionOrderInput) => {
      // 1. Carregar dados base
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select(
          `id, os_number, notes, weight, volume, cargo_value, cargo_type,
           shipper_id, client_id, driver_id, vehicle_plate, vehicle_brand, vehicle_model, vehicle_type_name,
           driver_name, driver_phone, driver_cnh, driver_antt,
           eta, pickup_date, origin, destination, origin_cep, destination_cep,
           shipper:shippers(id, name, cnpj, cpf, phone, email, address, address_number, address_complement, address_neighborhood, zip_code, city, state),
           client:clients(id, name, cnpj, cpf, phone, email, address, address_number, address_complement, address_neighborhood, zip_code, city, state),
           driver:drivers(id, name, cpf, cnh, antt, phone)`
        )
        .eq('id', oid)
        .single();

      if (orderErr) throw orderErr;
      if (!order) throw new Error('OS nao encontrada');

      // 2. Buscar carreta via vehicles (plate_2) usando driver_id
      let trailerPlate: string | null = null;
      if (order.driver_id) {
        const { data: veh } = await supabase
          .from('vehicles')
          .select('plate, plate_2')
          .eq('driver_id', order.driver_id)
          .limit(1)
          .maybeSingle();
        trailerPlate = veh?.plate_2 ?? null;
      }

      // 2b. Buscar ultimo resultado ANTT/RNTRC da OS via risk_evidence
      let anttSnapshot: import('@/types/collectionOrder').CollectionOrderAnttData | null = null;
      try {
        const { data: evals } = await supabase
          .from('risk_evaluations')
          .select('id')
          .eq('entity_type', 'order')
          .eq('entity_id', oid)
          .order('created_at', { ascending: false })
          .limit(1);
        const evalId = evals?.[0]?.id;
        if (evalId) {
          const { data: evidence } = await supabase
            .from('risk_evidence')
            .select('payload, created_at')
            .eq('evaluation_id', evalId)
            .eq('evidence_type', 'antt_rntrc_check')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (evidence?.payload) {
            const p = evidence.payload as Record<string, unknown>;
            anttSnapshot = {
              situacao: (p.situacao as string) ?? null,
              situacao_raw: (p.situacao_raw as string) ?? null,
              rntrc_registry_type: (p.rntrc_registry_type as 'TAC' | 'ETC' | null) ?? null,
              rntrc: (p.rntrc as string) ?? null,
              transportador: (p.transportador as string) ?? null,
              cpf_cnpj_mask: (p.cpf_cnpj_mask as string) ?? null,
              cadastrado_desde: (p.cadastrado_desde as string) ?? null,
              municipio_uf: (p.municipio_uf as string) ?? null,
              apto: (p.apto as boolean | null) ?? null,
              veiculo_na_frota: (p.veiculo_na_frota as boolean | null) ?? null,
              comprovante_url: (p.comprovante_url as string) ?? null,
              checked_at: evidence.created_at ?? null,
            };
          }
        }
      } catch {
        // se a busca falhar a OC ainda emite — antt_data fica null
      }

      // 3. Próximo número
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const { data: seqData, error: seqErr } = await supabase.rpc('next_collection_order_seq', {
        p_year: year,
        p_month: month,
      });
      if (seqErr) throw seqErr;
      const seq = seqData as number;
      const ocNumber = `OC-${year}-${String(month).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;

      // 4. Snapshots
      const shipper = (order as unknown as { shipper: Record<string, unknown> | null }).shipper;
      const client = (order as unknown as { client: Record<string, unknown> | null }).client;
      const driver = (order as unknown as { driver: Record<string, unknown> | null }).driver;

      const sender: CollectionOrderPartyData = {
        name: (shipper?.name as string) ?? '',
        cnpj: (shipper?.cnpj as string) ?? null,
        cpf: (shipper?.cpf as string) ?? null,
        phone: (shipper?.phone as string) ?? null,
        email: (shipper?.email as string) ?? null,
        address: (shipper?.address as string) ?? null,
        address_number: (shipper?.address_number as string) ?? null,
        address_complement: (shipper?.address_complement as string) ?? null,
        address_neighborhood: (shipper?.address_neighborhood as string) ?? null,
        zip_code: (shipper?.zip_code as string) ?? order.origin_cep ?? null,
        city: (shipper?.city as string) ?? null,
        state: (shipper?.state as string) ?? null,
        ...(senderOverride ?? {}),
      };

      const recipient: CollectionOrderPartyData = {
        name: (client?.name as string) ?? '',
        cnpj: (client?.cnpj as string) ?? null,
        cpf: (client?.cpf as string) ?? null,
        phone: (client?.phone as string) ?? null,
        email: (client?.email as string) ?? null,
        address: (client?.address as string) ?? null,
        address_number: (client?.address_number as string) ?? null,
        address_complement: (client?.address_complement as string) ?? null,
        address_neighborhood: (client?.address_neighborhood as string) ?? null,
        zip_code: (client?.zip_code as string) ?? order.destination_cep ?? null,
        city: (client?.city as string) ?? null,
        state: (client?.state as string) ?? null,
      };

      const driverData: CollectionOrderDriverData = {
        name: (driver?.name as string) ?? order.driver_name ?? '',
        cpf: (driver?.cpf as string) ?? null,
        cnh: (driver?.cnh as string) ?? order.driver_cnh ?? null,
        antt: (driver?.antt as string) ?? order.driver_antt ?? null,
        phone: (driver?.phone as string) ?? order.driver_phone ?? null,
      };

      const vehicleData: CollectionOrderVehicleData = {
        plate: order.vehicle_plate ?? null,
        trailer_plate: trailerPlate,
        vehicle_type: order.vehicle_type_name ?? null,
        brand: order.vehicle_brand ?? null,
        model: order.vehicle_model ?? null,
      };

      const cargoData: CollectionOrderCargoData = {
        weight_kg: order.weight != null ? Number(order.weight) : null,
        volume_m3: order.volume != null ? Number(order.volume) : null,
        cargo_value: order.cargo_value != null ? Number(order.cargo_value) : null,
        cargo_type: order.cargo_type ?? null,
      };

      // 5. Datas (pickup_date e delivery_date)
      // pickup_date vem direto da OS (preenchido pelo operador no formulário).
      // ETA é a chegada no destino → delivery_date.
      const pickupDate: string | null =
        ((order as unknown as Record<string, unknown>).pickup_date as string | null) ?? null;
      const deliveryDate: string | null = order.eta
        ? new Date(order.eta).toISOString().slice(0, 10)
        : null;

      // 6. Identidade do emissor
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      let issuedByName: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', userId)
          .maybeSingle();
        issuedByName = profile?.full_name ?? profile?.email ?? null;
      }

      // 7. Gerar PDF
      const issuedAtIso = new Date().toISOString();
      const { blob } = await generateCollectionOrderPdf({
        oc_number: ocNumber,
        issued_at: issuedAtIso,
        issued_by_name: issuedByName,
        sender,
        recipient,
        driver: driverData,
        vehicle: vehicleData,
        cargo: cargoData,
        antt: anttSnapshot,
        pickup_date: pickupDate,
        delivery_date: deliveryDate,
        observation: order.notes ?? null,
        additional_info: additionalInfo ?? null,
      });

      // 8. Upload no bucket
      const storagePath = `${oid}/${ocNumber}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('collection-orders')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      // 9. INSERT
      const { data: inserted, error: insertErr } = await supabase
        .from('collection_orders')
        .insert({
          oc_number: ocNumber,
          oc_year: year,
          oc_month: month,
          oc_seq: seq,
          order_id: oid,
          status: 'emitida',
          sender_data: sender as unknown as Record<string, unknown>,
          recipient_data: recipient as unknown as Record<string, unknown>,
          driver_data: driverData as unknown as Record<string, unknown>,
          vehicle_data: vehicleData as unknown as Record<string, unknown>,
          cargo_data: cargoData as unknown as Record<string, unknown>,
          antt_data: anttSnapshot as unknown as Record<string, unknown> | null,
          pickup_date: pickupDate,
          delivery_date: deliveryDate,
          additional_info: additionalInfo ?? null,
          pdf_storage_path: storagePath,
          issued_at: issuedAtIso,
          issued_by: userId,
        })
        .select()
        .single();

      if (insertErr) {
        // Rollback do storage se INSERT falhar
        await supabase.storage.from('collection-orders').remove([storagePath]);
        throw insertErr;
      }

      // 10. Salvar overrides de endereço no shipper se preenchido manualmente
      if (
        senderOverride &&
        order.shipper_id &&
        (senderOverride.address_number ||
          senderOverride.address_complement ||
          senderOverride.address_neighborhood)
      ) {
        await supabase
          .from('shippers')
          .update({
            address_number: senderOverride.address_number ?? sender.address_number ?? null,
            address_complement:
              senderOverride.address_complement ?? sender.address_complement ?? null,
            address_neighborhood:
              senderOverride.address_neighborhood ?? sender.address_neighborhood ?? null,
          })
          .eq('id', order.shipper_id);
      }

      return { collectionOrder: inserted, blob };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLLECTION_ORDERS_QK, 'order', orderId] });
    },
  });
}
