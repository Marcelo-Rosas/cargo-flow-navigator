/**
 * ai-operational-agent — backward-compat proxy
 *
 * @deprecated Use ai-operational-orchestrator directly. Frontend has been migrated.
 * Forwards all requests to ai-operational-orchestrator so existing
 * callers continue to work without changes.
 */
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const orchestratorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-operational-orchestrator`;

  try {
    const bodyText = await req.text();

    const res = await fetch(orchestratorUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: bodyText || undefined,
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-operational-agent proxy error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
