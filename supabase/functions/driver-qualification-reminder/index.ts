// @ts-nocheck
/**
 * driver-qualification-reminder
 *
 * Cadência de follow-up para motoristas que não responderam o formulário.
 *
 * Wave 1 (lembrete): whatsapp_sent_at há +2 dias, whatsapp_reminded_at IS NULL
 * Wave 2 (encerramento): whatsapp_reminded_at há +3 dias
 *
 * Config via env vars:
 * - QUALIFICATION_FORM_URL              URL base do formulário
 * - QUALIFICATION_REMINDER_DELAY_DAYS   dias após envio para lembrete (default 2)
 * - QUALIFICATION_CLOSING_DELAY_DAYS    dias após lembrete para encerramento (default 3)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const QUALIFICATION_FORM_URL = Deno.env.get('QUALIFICATION_FORM_URL') ?? '';
const REMINDER_DELAY_DAYS = Number(Deno.env.get('QUALIFICATION_REMINDER_DELAY_DAYS') ?? '2');
const CLOSING_DELAY_DAYS = Number(Deno.env.get('QUALIFICATION_CLOSING_DELAY_DAYS') ?? '3');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendNotification(
  templateId: string,
  recipient: string,
  variables: Record<string, string>
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notification-hub`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ channel: 'whatsapp', template_id: templateId, recipient, variables }),
  });
  if (!res.ok) throw new Error(`notification-hub ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const reminderCutoff = new Date(
      Date.now() - REMINDER_DELAY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const closingCutoff = new Date(
      Date.now() - CLOSING_DELAY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // Wave 1: lembrete — enviado há +2 dias, ainda não lembrado
    const { data: toRemind } = await supabase
      .from('driver_qualifications')
      .select(`id, driver_name, orders!inner ( os_number, driver_phone )`)
      .eq('status', 'pendente')
      .not('whatsapp_sent_at', 'is', null)
      .is('whatsapp_reminded_at', null)
      .lt('whatsapp_sent_at', reminderCutoff)
      .not('orders.driver_phone', 'is', null)
      .limit(50);

    let reminded = 0;
    for (const r of toRemind ?? []) {
      const order = r.orders as { os_number: string; driver_phone: string };
      const formLink = `${QUALIFICATION_FORM_URL}?phone=${order.driver_phone}&cid=${r.id}`;
      try {
        await sendNotification('driver_qualification_reminder_msg', order.driver_phone, {
          nome: r.driver_name ?? 'Motorista',
          link: formLink,
        });
        await supabase
          .from('driver_qualifications')
          .update({ whatsapp_reminded_at: new Date().toISOString() })
          .eq('id', r.id);
        reminded++;
      } catch (e) {
        console.error(`[driver-qualification-reminder] wave1 ${r.id}:`, e);
      }
    }

    // Wave 2: encerramento — lembrado há +3 dias sem resposta
    const { data: toClose } = await supabase
      .from('driver_qualifications')
      .select(`id, driver_name, orders!inner ( os_number, driver_phone )`)
      .eq('status', 'pendente')
      .not('whatsapp_reminded_at', 'is', null)
      .lt('whatsapp_reminded_at', closingCutoff)
      .not('orders.driver_phone', 'is', null)
      .limit(50);

    let closed = 0;
    for (const r of toClose ?? []) {
      const order = r.orders as { os_number: string; driver_phone: string };
      try {
        await sendNotification('driver_qualification_closing', order.driver_phone, {
          nome: r.driver_name ?? 'Motorista',
        });
        closed++;
      } catch (e) {
        console.error(`[driver-qualification-reminder] wave2 ${r.id}:`, e);
      }
    }

    console.log(`[driver-qualification-reminder] reminded=${reminded} closed=${closed}`);
    return new Response(JSON.stringify({ reminded, closed }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('[driver-qualification-reminder] fatal:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
