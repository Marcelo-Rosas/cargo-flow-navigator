// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);

serve(async (req) => {
  try {
    const { channel, template_id, recipient, variables } = await req.json();

    const { data: template, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('key', template_id)
      .eq('active', true)
      .single();

    if (error || !template) {
      return new Response(JSON.stringify({ error: 'Template não encontrado' }), { status: 404 });
    }

    if (channel === 'whatsapp') {
      await sendWhatsApp(recipient, template, variables ?? {});
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

async function sendWhatsApp(recipient, template, variables) {
  const OPENCLAW = Deno.env.get('OPENCLAW_WEBHOOK_URL');

  if (template.is_meta_approved && template.meta_template_name) {
    const metaVars = template.meta_variables ?? [];
    const isNamed = metaVars.some((v) => v.type === 'named');

    const bodyParameters = isNamed
      ? metaVars.map((v) => ({ type: 'text', text: variables[v.key] ?? '' }))
      : [...metaVars]
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .map((v) => ({ type: 'text', text: variables[v.key] ?? '' }));

    const components = [];

    if (template.meta_template_name === 'rastreio_vectra_cargo') {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'location',
            location: {
              latitude: variables['lat'] ?? '-26.9',
              longitude: variables['lng'] ?? '-48.6',
              name: variables['veiculo'] ?? '',
              address: variables['posicao'] ?? '',
            },
          },
        ],
      });
    }

    components.push({ type: 'body', parameters: bodyParameters });

    const payload = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: template.meta_template_name,
        language: { code: template.meta_language_code ?? 'pt_BR' },
        components,
      },
    };

    return fetch(OPENCLAW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta_template', payload }),
    });
  }

  const body = interpolate(template.body_template, variables);
  return fetch(OPENCLAW, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'text', to: recipient, body }),
  });
}

function interpolate(tmpl, vars) {
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '{{' + k + '}}');
}
