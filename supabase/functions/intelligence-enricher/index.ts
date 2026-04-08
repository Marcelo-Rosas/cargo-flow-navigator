// @ts-nocheck
/**
 * intelligence-enricher — Enrich a delivery address with logistics traffic rules.
 *
 * Flow:
 *   1. Receive { city, state, address } from CFN frontend or quote creation
 *   2. Query logistics_traffic_rules by city/state
 *   3. If not found → call Claude API with relevant context to research restrictions
 *   4. Save result to logistics_traffic_rules for future lookups
 *   5. Return { organ, restriction_type, rules_summary, permit_info, provocation_hook }
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function enrichWithClaude(city: string, state: string, address: string) {
  const prompt = `You are a Brazilian freight logistics expert for Vectra Cargo, a specialized fitness equipment transport company.

Research the traffic restrictions for heavy vehicle delivery at this location:
City: ${city}, ${state}
Address: ${address}

Provide a JSON response with this exact schema:
{
  "organ_name": "AMC",
  "full_name": "Autarquia Municipal de Trânsito",
  "restriction_type": "ZMRC",
  "rules_summary": "Vehicles above 6 tons prohibited 06h-20h on weekdays in central area",
  "permit_info": "Authorization required via portal AMC 48h in advance for loads above 3 tons",
  "provocation_hook": "Sabia que na [street] a [organ] exige autorização prévia para caminhões acima de X tons? Já analisamos isso para você."
}

Use your knowledge of Brazilian municipal traffic authorities:
- São Paulo: CET-SP
- Fortaleza: AMC (Autarquia Municipal de Trânsito)
- Rio de Janeiro: CET-Rio
- Belo Horizonte: BHTrans
- Curitiba: URBS
- Porto Alegre: EPTC
- Manaus: MANAUSTRANS
- Salvador: TRANSALVADOR
If the city is not a major capital, use "Órgão Municipal de Trânsito" as fallback.
Return ONLY valid JSON, no markdown.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? '{}';
  return JSON.parse(text);
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
    const { city, state, address } = await req.json();

    if (!city || !state) {
      return new Response(JSON.stringify({ error: 'city and state are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Check cache first
    const { data: cached } = await supabase
      .from('logistics_traffic_rules')
      .select('*')
      .eq('city', city)
      .eq('state', state)
      .limit(3);

    if (cached && cached.length > 0) {
      return new Response(JSON.stringify({ ok: true, source: 'cache', rules: cached }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Not cached — enrich with Claude
    const enriched = await enrichWithClaude(city, state, address ?? '');

    // 3. Save for future lookups
    await supabase.from('logistics_traffic_rules').upsert(
      {
        city,
        state,
        organ_name: enriched.organ_name ?? 'Órgão Municipal de Trânsito',
        full_name: enriched.full_name ?? null,
        restriction_type: enriched.restriction_type ?? null,
        rules_summary: enriched.rules_summary ?? null,
        permit_info: enriched.permit_info ?? null,
        source: 'ai',
      },
      { onConflict: 'city,state,organ_name' }
    );

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'ai',
        rules: [enriched],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('intelligence-enricher error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
