import { getCorsHeaders } from '../_shared/cors.ts';
import { executeDriverQualificationWorker } from '../_shared/workers/driverQualificationWorker.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { orderData, model, previousInsights } = await req.json();
    if (!orderData) {
      return new Response(JSON.stringify({ error: 'Missing orderData' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const result = await executeDriverQualificationWorker({
      orderData,
      model: model || 'gpt-4.1-mini',
      previousInsights,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-driver-qualification-worker error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
