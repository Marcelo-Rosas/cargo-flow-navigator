import { getCorsHeaders } from '../_shared/cors.ts';
import { executeDriverQualificationWorker } from '../_shared/workers/driverQualificationWorker.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Use service role key for backend operations
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    // Persist driver qualification data
    const { data: existingQualification, error: fetchError } = await supabaseClient
      .from('driver_qualifications')
      .select('id')
      .eq('order_id', orderData.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means "no rows found"
      console.error('Error fetching existing driver qualification:', fetchError);
      throw new Error(fetchError.message);
    }

    if (existingQualification) {
      // Update existing record
      const { error: updateError } = await supabaseClient
        .from('driver_qualifications')
        .update(result.driver_qualification_data)
        .eq('id', existingQualification.id);

      if (updateError) {
        console.error('Error updating driver qualification:', updateError);
        throw new Error(updateError.message);
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabaseClient
        .from('driver_qualifications')
        .insert(result.driver_qualification_data);

      if (insertError) {
        console.error('Error inserting driver qualification:', insertError);
        throw new Error(insertError.message);
      }
    }

    // Persist AI insight data
    const { error: aiInsightError } = await supabaseClient
      .from('ai_insights')
      .insert(result.ai_insight_data);

    if (aiInsightError) {
      console.error('Error inserting AI insight:', aiInsightError);
      throw new Error(aiInsightError.message);
    }

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
