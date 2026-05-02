/// <reference path="../_shared/deno.d.ts" />

/**
 * Edge Function: identify-consolidation-opportunity (T6.1)
 *
 * Triggered by: AFTER INSERT ON quotes
 * Goal: Proactively identify consolidation opportunities for new quotations.
 *
 * This function acts as a bridge between the database trigger and the
 * heavy-lifting 'analyze-load-composition' function.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Parse Webhook Payload
    const payload = await req.json();
    console.log('[T6.1] Received trigger payload:', JSON.stringify(payload));

    const { record, type, table } = payload;

    if (type !== 'INSERT' || table !== 'quotes') {
      console.log('[T6.1] Skipping non-INSERT or non-quotes event');
      return new Response(JSON.stringify({ message: 'Skipped' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200,
      });
    }

    const quoteId = record.id;
    const shipperId = record.shipper_id;

    if (!quoteId || !shipperId) {
      console.error('[T6.1] Missing quoteId or shipperId in record');
      return new Response(JSON.stringify({ error: 'Incomplete record' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 400,
      });
    }

    console.log(`[T6.1] New quote ${quoteId} for shipper ${shipperId}. Triggering analysis...`);

    // 2. Call analyze-load-composition
    // We call it asynchronously (don't wait for the full analysis to finish before returning 200 to the webhook)
    // However, for debugging, we might want to wait or use a queue.
    // Given Edge Function limits, a direct fetch is fine if it stays under 50s.

    const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-load-composition`;

    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        shipper_id: shipperId,
        anchor_quote_id: quoteId,
        trigger_source: 'on_save',
        date_window_days: 14, // Configurable default
      }),
    });

    const result = await response.json();
    console.log('[T6.1] Analysis response:', JSON.stringify(result));

    return new Response(
      JSON.stringify({
        message: 'Analysis triggered',
        quote_id: quoteId,
        suggestions_found: result.total_found || 0,
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[T6.1] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500,
    });
  }
});
