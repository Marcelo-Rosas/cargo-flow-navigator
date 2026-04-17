// @ts-nocheck
/**
 * driver-qualification-dispatcher
 *
 * Envia template Meta "Atualização de Cadastro Motoristas" via WhatsApp
 * para motoristas com driver_qualifications.status = 'pendente' e
 * whatsapp_sent_at IS NULL.
 *
 * Config via env vars:
 * - QUALIFICATION_FORM_URL  URL base do formulário (ex: https://form.typeform.com/to/RDLYWB6C)
 * - QUALIFICATION_DAILY_LIMIT  máximo de envios por execução (default 20)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const QUALIFICATION_FORM_URL = Deno.env.get('QUALIFICATION_FORM_URL') ?? '';
const DAILY_LIMIT = Number(Deno.env.get('QUALIFICATION_DAILY_LIMIT') ?? '20');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  if (!QUALIFICATION_FORM_URL) {
    console.error('[driver-qualification-dispatcher] QUALIFICATION_FORM_URL not configured');
    return new Response(JSON.stringify({ error: 'QUALIFICATION_FORM_URL not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const { data: pending, error } = await supabase
      .from('driver_qualifications')
      .select(
        `
        id,
        driver_name,
        orders!inner ( os_number, driver_phone )
      `
      )
      .eq('status', 'pendente')
      .is('whatsapp_sent_at', null)
      .not('orders.driver_phone', 'is', null)
      .limit(DAILY_LIMIT);

    if (error) throw error;

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No pending records' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const record of pending) {
      const order = record.orders as { os_number: string; driver_phone: string };
      const formLink = `${QUALIFICATION_FORM_URL}?phone=${order.driver_phone}&cid=${record.id}`;

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/notification-hub`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            channel: 'whatsapp',
            template_id: 'driver_qualification_outreach',
            recipient: order.driver_phone,
            variables: {
              nome: record.driver_name ?? 'Motorista',
              link: formLink,
            },
          }),
        });

        if (!res.ok) {
          errors.push(`[${record.id}] notification-hub ${res.status}: ${await res.text()}`);
          continue;
        }

        const { error: updateError } = await supabase
          .from('driver_qualifications')
          .update({ whatsapp_sent_at: new Date().toISOString() })
          .eq('id', record.id);

        if (updateError) {
          errors.push(`[${record.id}] update failed: ${updateError.message}`);
          continue;
        }

        sent++;
      } catch (e) {
        errors.push(`[${record.id}] ${String(e)}`);
      }
    }

    console.log(`[driver-qualification-dispatcher] sent=${sent} errors=${errors.length}`);

    return new Response(JSON.stringify({ sent, ...(errors.length > 0 && { errors }) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('[driver-qualification-dispatcher] fatal:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
