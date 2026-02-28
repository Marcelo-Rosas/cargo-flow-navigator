import { getCorsHeaders } from '../_shared/cors.ts';
import { executeOperationalReportWorker } from '../_shared/workers/operationalReportWorker.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { operationalData, reportType, model } = await req.json();
    if (!operationalData) {
      return new Response(JSON.stringify({ error: 'Missing operationalData' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const result = await executeOperationalReportWorker({
      operationalData,
      reportType: reportType || 'daily',
      model: model || 'gpt-4.1',
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-operational-report-worker error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
