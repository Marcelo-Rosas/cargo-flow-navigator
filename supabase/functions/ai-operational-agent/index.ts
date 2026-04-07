/**
 * ai-operational-agent — backward-compat proxy
 *
 * @deprecated Use ai-operational-orchestrator directly. Frontend has been migrated.
 * Forwards all requests to ai-operational-orchestrator so existing
 * callers continue to work without changes.
 */
import { getCorsHeaders } from '../_shared/cors.ts';

const Deno = (globalThis as any).Deno;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const orchestratorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-operational-orchestrator`;

  try {
    const bodyText = await req.text();
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const apikey = anonKey || serviceRoleKey;

    const res = await fetch(orchestratorUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey,
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
