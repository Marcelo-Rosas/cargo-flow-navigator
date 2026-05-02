import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert } from '@/lib/supabase-utils';
import { cardQueryKey } from '@/lib/card-mapping';
import { supabase } from '@/integrations/supabase/client';

export interface LegacyQuotePayload {
  // Quote (FAT)
  client_id: string | null;
  client_name: string;
  origin: string;
  destination: string;
  value: number;
  quote_code?: string | null;
  created_at?: string | null;
  advance_due_date?: string | null;
  balance_due_date?: string | null;
  payment_term_id?: string | null;
  payment_term_advance_percent?: number | null;
  shipper_id?: string | null;
  shipper_name?: string | null;
  km_distance?: number | null;
  cargo_type?: string | null;
  weight?: number | null;
  volume?: number | null;
  toll_value?: number | null;
  notes?: string | null;
  validity_date?: string | null;
  // Order (PAG)
  carreteiro_real: number;
  os_number?: string | null;
  carrier_payment_term_id?: string | null;
  carrier_advance_percent?: number | null;
  carrier_advance_date?: string | null;
  carrier_balance_date?: string | null;
}

export function useCreateLegacyQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LegacyQuotePayload) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const sessionData = await supabase.auth.getSession();
      let token = sessionData?.data?.session?.access_token;
      if (!token) {
        const refreshData = await supabase.auth.refreshSession();
        token = refreshData?.data?.session?.access_token ?? undefined;
      }
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const createdAt = payload.created_at ? new Date(payload.created_at).toISOString() : undefined;

      // 1. Insert Quote
      const quoteInsert = asInsert({
        client_id: payload.client_id || null,
        client_name: payload.client_name,
        origin: payload.origin,
        destination: payload.destination,
        value: payload.value,
        stage: 'ganho',
        created_by: user.id,
        is_legacy: true,
        pricing_breakdown: { source: 'legacy' },
        quote_code: payload.quote_code || null,
        created_at: createdAt,
        advance_due_date: payload.advance_due_date || null,
        balance_due_date: payload.balance_due_date || null,
        payment_term_id: payload.payment_term_id || null,
        shipper_id: payload.shipper_id || null,
        shipper_name: payload.shipper_name || null,
        km_distance: payload.km_distance ?? null,
        cargo_type: payload.cargo_type || null,
        weight: payload.weight ?? null,
        volume: payload.volume ?? null,
        toll_value: payload.toll_value ?? null,
        notes: payload.notes || null,
        validity_date: payload.validity_date?.trim() || null,
      });

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert(quoteInsert)
        .select()
        .single();

      if (quoteError) throw quoteError;
      if (!quote) throw new Error('Erro ao criar cotação');

      // 2. Generate or use manual os_number
      let osNumber = payload.os_number?.trim() || null;
      if (!osNumber) {
        const { data: gen } = await supabase.rpc('generate_os_number');
        osNumber = gen || '';
      }

      // 3. Insert Order
      const orderInsert = asInsert({
        os_number: osNumber,
        quote_id: quote.id,
        client_id: payload.client_id || null,
        client_name: payload.client_name,
        origin: payload.origin,
        destination: payload.destination,
        value: payload.value,
        carreteiro_real: payload.carreteiro_real,
        created_by: user.id,
        stage: 'entregue',
        has_pod: true,
        carrier_payment_term_id: payload.carrier_payment_term_id || null,
        carrier_advance_date: payload.carrier_advance_date || null,
        carrier_balance_date: payload.carrier_balance_date || null,
        km_distance: payload.km_distance ?? null,
        cargo_type: payload.cargo_type || null,
        weight: payload.weight ?? null,
        volume: payload.volume ?? null,
        toll_value: payload.toll_value ?? null,
        shipper_id: payload.shipper_id || null,
        shipper_name: payload.shipper_name || null,
        payment_term_id: payload.payment_term_id || null,
        pricing_breakdown: { source: 'legacy' },
        created_at: createdAt,
      });

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderInsert)
        .select()
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('Erro ao criar ordem');

      // 4. Create FAT
      const { data: fatRes, error: fatErr } = await supabase.functions.invoke(
        'ensure-financial-document',
        {
          body: {
            docType: 'FAT',
            sourceId: quote.id,
            totalAmount: payload.value,
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (fatErr) throw fatErr;
      const fatData = fatRes as { data?: { id?: string }; error?: string } | null;
      if (fatData?.error) throw new Error(fatData.error);
      const fatId = fatData?.data?.id;

      if (fatId) {
        const advPercent = payload.payment_term_advance_percent ?? 0;
        const advDate = payload.advance_due_date || new Date().toISOString().slice(0, 10);
        const balDate = payload.balance_due_date || new Date().toISOString().slice(0, 10);
        const fatTotal = payload.value;

        const { data: existingFat } = await supabase
          .from('financial_installments')
          .select('id')
          .eq('financial_document_id', asDb(fatId));

        if (!existingFat?.length && fatTotal > 0) {
          if (advPercent > 0) {
            const advAmount = Math.round(fatTotal * (advPercent / 100) * 100) / 100;
            const balAmount = Math.round((fatTotal - advAmount) * 100) / 100;
            await supabase.from('financial_installments').insert(
              asInsert([
                {
                  financial_document_id: fatId,
                  amount: advAmount,
                  due_date: advDate,
                  payment_method: `Adiantamento ${advPercent}%`,
                  status: 'pendente',
                },
                {
                  financial_document_id: fatId,
                  amount: balAmount,
                  due_date: balDate,
                  payment_method: `Saldo ${100 - advPercent}%`,
                  status: 'pendente',
                },
              ])
            );
          } else {
            await supabase.from('financial_installments').insert(
              asInsert({
                financial_document_id: fatId,
                amount: fatTotal,
                due_date: advDate,
                payment_method: 'Pagamento Único',
                status: 'pendente',
              })
            );
          }
        }
      }

      // 5. Create PAG
      const { data: pagRes, error: pagErr } = await supabase.functions.invoke(
        'ensure-financial-document',
        {
          body: {
            docType: 'PAG',
            sourceId: order.id,
            totalAmount: payload.carreteiro_real,
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (pagErr) throw pagErr;
      const pagData = pagRes as { data?: { id?: string }; error?: string } | null;
      if (pagData?.error) throw new Error(pagData.error);
      const pagId = pagData?.data?.id;

      if (pagId) {
        const carrAdvDate = payload.carrier_advance_date || new Date().toISOString().slice(0, 10);
        const carrBalDate =
          payload.carrier_balance_date || payload.carrier_advance_date || carrAdvDate;
        const carrTotal = payload.carreteiro_real;

        const { data: existingPag } = await supabase
          .from('financial_installments')
          .select('id')
          .eq('financial_document_id', asDb(pagId));

        if (!existingPag?.length && carrTotal > 0) {
          const carrAdvPercent = payload.carrier_advance_percent ?? 0;
          if (carrAdvPercent > 0) {
            const advAmount = Math.round(carrTotal * (carrAdvPercent / 100) * 100) / 100;
            const balAmount = Math.round((carrTotal - advAmount) * 100) / 100;
            await supabase.from('financial_installments').insert(
              asInsert([
                {
                  financial_document_id: pagId,
                  amount: advAmount,
                  due_date: carrAdvDate,
                  payment_method: `Adiantamento ${carrAdvPercent}%`,
                  status: 'pendente',
                },
                {
                  financial_document_id: pagId,
                  amount: balAmount,
                  due_date: carrBalDate,
                  payment_method: `Saldo ${100 - carrAdvPercent}%`,
                  status: 'pendente',
                },
              ])
            );
          } else {
            await supabase.from('financial_installments').insert(
              asInsert({
                financial_document_id: pagId,
                amount: carrTotal,
                due_date: carrAdvDate,
                payment_method: 'Pagamento Único',
                status: 'pendente',
              })
            );
          }
        }
      }

      return { quote, order };
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
      queryClient.invalidateQueries({ queryKey: ['pending-installments'] });
    },
  });
}
