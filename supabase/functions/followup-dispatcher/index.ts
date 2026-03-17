// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);
const WA_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const filterPhone = body.filter_phone ?? null;

  let query = supabase
    .from('followup_campaigns')
    .select('*')
    .eq('status', 'pending')
    .order('days_stalled', { ascending: false });

  if (filterPhone) query = query.eq('shipper_phone', filterPhone);

  const { data: campaigns } = await query;

  if (!campaigns || campaigns.length === 0)
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

  const byPhone = {};
  for (const c of campaigns) {
    if (!byPhone[c.shipper_phone]) byPhone[c.shipper_phone] = [];
    byPhone[c.shipper_phone].push(c);
  }

  let sent = 0;
  const errors = [];

  for (const [phone, group] of Object.entries(byPhone)) {
    const lead = group.find((c) => c.is_group_lead) ?? group[0];
    const isGroup = group.length > 1;
    const contact = lead.shipper_contact ?? lead.shipper_name;
    const cot2 = isGroup ? 'algumas cotacoes' : lead.quote_code;

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: 'followup_vectra',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: contact },
              { type: 'text', text: cot2 },
            ],
          },
        ],
      },
    };

    const res = await fetch('https://graph.facebook.com/v19.0/' + WA_PHONE_ID + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + WA_TOKEN },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (res.ok) {
      const ids = group.map((c) => c.id);
      await supabase
        .from('followup_campaigns')
        .update({ status: 'sent', followup_sent_at: new Date().toISOString() })
        .in('id', ids);
      sent++;
    } else {
      errors.push(phone + ': ' + JSON.stringify(result));
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, errors }), { status: 200 });
});
