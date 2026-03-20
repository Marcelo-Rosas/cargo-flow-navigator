import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

type Body = {
  tripId: string;
  userId?: string | null;
};

type TripReconciliationRow = {
  trip_id: string;
  trip_number: string;
  status_operational: string;
  financial_status: string;
  orders_count: number;
  expected_amount: number;
  paid_amount: number;
  delta_amount: number;
  trip_reconciled: boolean;
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function buildReceiptHtml(trip: TripReconciliationRow): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Recibo Trip ${trip.trip_number}</title></head>
<body>
<h1>Recibo de Fechamento - ${trip.trip_number}</h1>
<p>Data: ${new Date().toLocaleString('pt-BR')}</p>
<p>Status: Fechado</p>
<p>Valor esperado: R$ ${Number(trip.expected_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
<p>Valor pago: R$ ${Number(trip.paid_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
<p>Delta: R$ ${Number(trip.delta_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    if (!body?.tripId || !isUuid(body.tripId)) {
      return new Response(JSON.stringify({ error: 'Invalid tripId (expected uuid)' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: rows, error: viewErr } = await sb
      .from('v_trip_payment_reconciliation' as never)
      .select('*')
      .eq('trip_id', body.tripId)
      .maybeSingle();

    if (viewErr || !rows) {
      return new Response(
        JSON.stringify({ error: 'Trip not found or has no orders', details: viewErr?.message }),
        { status: 404, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }

    const trip = rows as unknown as TripReconciliationRow;
    const userId = body.userId ?? null;

    if (trip.trip_reconciled && trip.status_operational === 'finalizada') {
      const now = new Date().toISOString();

      await sb
        .from('trips')
        .update({
          financial_status: 'closed',
          closed_at: now,
          closed_by: userId,
          updated_at: now,
        })
        .eq('id', body.tripId);

      // Gerar recibo HTML e anexar em documents (se tivermos userId)
      if (userId) {
        try {
          const html = buildReceiptHtml(trip);
          const fileName = `recibo-trip-${trip.trip_number}.html`;
          const path = `trips/${body.tripId}/${fileName}`;

          const { error: uploadErr } = await sb.storage
            .from('documents')
            .upload(path, new Blob([html], { type: 'text/html' }), {
              contentType: 'text/html',
              upsert: true,
            });

          if (!uploadErr) {
            const { data: urlData } = sb.storage.from('documents').getPublicUrl(path);

            await sb.from('documents').insert({
              order_id: null,
              trip_id: body.tripId,
              type: 'outros',
              file_name: fileName,
              file_url: urlData.publicUrl,
              uploaded_by: userId,
            } as never);
          }
        } catch {
          // Receipt upload non-critical — trip close já aplicado
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          closed: true,
          trip_id: body.tripId,
          trip_number: trip.trip_number,
          financial_status: 'closed',
        }),
        { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }

    // Não pode fechar ainda → set closing e retorna delta
    await sb
      .from('trips')
      .update({
        financial_status: 'closing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.tripId);

    return new Response(
      JSON.stringify({
        success: true,
        closed: false,
        trip_id: body.tripId,
        trip_number: trip.trip_number,
        financial_status: 'closing',
        delta_amount: Number(trip.delta_amount),
        trip_reconciled: trip.trip_reconciled,
        status_operational: trip.status_operational,
        message: !trip.trip_reconciled
          ? 'Trip ainda não conciliada (verificar comprovantes por OS)'
          : trip.status_operational !== 'finalizada'
            ? 'Status operacional deve ser "finalizada" para fechar'
            : 'Delta fora da tolerância',
      }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
