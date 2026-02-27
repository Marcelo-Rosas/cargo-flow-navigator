import { getCorsHeaders } from '../_shared/cors.ts';
import {
  executeComplianceCheckWorker,
  type CheckType,
} from '../_shared/workers/complianceCheckWorker.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { orderData, quoteData, checkType, model, previousInsights } = await req.json();
    if (!orderData) {
      return new Response(JSON.stringify({ error: 'Missing orderData' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const result = await executeComplianceCheckWorker({
      orderData,
      quoteData: quoteData || null,
      checkType: (checkType || 'pre_coleta') as CheckType,
      model: model || 'gpt-4.1',
      previousInsights,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-compliance-check-worker error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
