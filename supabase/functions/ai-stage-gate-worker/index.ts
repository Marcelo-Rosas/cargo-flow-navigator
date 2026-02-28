import { getCorsHeaders } from '../_shared/cors.ts';
import { executeStageGateWorker } from '../_shared/workers/stageGateWorker.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { orderData, targetStage } = await req.json();
    if (!orderData || !targetStage) {
      return new Response(JSON.stringify({ error: 'Missing orderData or targetStage' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const result = await executeStageGateWorker({ orderData, targetStage });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-stage-gate-worker error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
