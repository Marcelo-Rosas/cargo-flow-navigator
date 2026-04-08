// @ts-nocheck
/**
 * paperclip-trigger — Fire a Paperclip routine webhook for commercial cadence.
 *
 * Called by mirofish-sync (high-priority recommendations) or directly from
 * CFN frontend when a lead is manually qualified.
 *
 * Flow:
 *   1. Receive lead data + insight context
 *   2. Enrich with traffic rules from logistics_traffic_rules
 *   3. Fire Paperclip webhook → Scout Comercial agent wakes up
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PAPERCLIP_CADENCIA_WEBHOOK_URL      (cadencia-lead-quente routine)
 *   PAPERCLIP_CADENCIA_WEBHOOK_SECRET
 *   PAPERCLIP_DOC_WEBHOOK_URL           (gerar-doc-preparacao routine, optional)
 *   PAPERCLIP_DOC_WEBHOOK_SECRET        (optional)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CADENCIA_WEBHOOK_URL = Deno.env.get('PAPERCLIP_CADENCIA_WEBHOOK_URL') ?? '';
const CADENCIA_WEBHOOK_SECRET = Deno.env.get('PAPERCLIP_CADENCIA_WEBHOOK_SECRET') ?? '';
const DOC_WEBHOOK_URL = Deno.env.get('PAPERCLIP_DOC_WEBHOOK_URL') ?? '';
const DOC_WEBHOOK_SECRET = Deno.env.get('PAPERCLIP_DOC_WEBHOOK_SECRET') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fireWebhook(url: string, secret: string, payload: unknown) {
  if (!url || !secret) return { ok: false, reason: 'webhook not configured' };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
      'Idempotency-Key': `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status };
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      routine = 'cadencia', // 'cadencia' | 'doc'
      lead_name,
      lead_phone,
      lead_address,
      lead_city,
      lead_state,
      academy_name,
      mirofish_context, // optional: { route, avg_ticket, ntc_impact }
      quote_id,
    } = body;

    // Fetch traffic rules for the delivery city
    let trafficRules: any[] = [];
    if (lead_city && lead_state) {
      const { data } = await supabase
        .from('logistics_traffic_rules')
        .select('organ_name, restriction_type, rules_summary, permit_info')
        .eq('city', lead_city)
        .eq('state', lead_state)
        .limit(3);
      trafficRules = data ?? [];
    }

    const payload = {
      source: 'vectra-cfn',
      triggered_at: new Date().toISOString(),
      lead: {
        name: lead_name,
        phone: lead_phone,
        address: lead_address,
        city: lead_city,
        state: lead_state,
        academy_name,
      },
      traffic_restrictions: trafficRules,
      mirofish_context: mirofish_context ?? null,
      quote_id: quote_id ?? null,
    };

    let result: any;
    if (routine === 'doc') {
      result = await fireWebhook(DOC_WEBHOOK_URL, DOC_WEBHOOK_SECRET, payload);
    } else {
      result = await fireWebhook(CADENCIA_WEBHOOK_URL, CADENCIA_WEBHOOK_SECRET, payload);
    }

    return new Response(JSON.stringify({ ok: result.ok, paperclip: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('paperclip-trigger error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
