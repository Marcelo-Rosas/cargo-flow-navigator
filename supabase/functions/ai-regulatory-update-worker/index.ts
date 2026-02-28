import { getCorsHeaders } from '../_shared/cors.ts';
import { executeRegulatoryUpdateWorker } from '../_shared/workers/regulatoryUpdateWorker.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { articlesToProcess, model } = await req.json();
    if (!Array.isArray(articlesToProcess)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid articlesToProcess' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const result = await executeRegulatoryUpdateWorker({
      articlesToProcess,
      model: model || 'gpt-4.1-mini',
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-regulatory-update-worker error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
