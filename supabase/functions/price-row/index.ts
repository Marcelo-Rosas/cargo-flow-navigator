import { createClient } from 'npm:@supabase/supabase-js@2.45.3';
import { getCorsHeaders } from '../_shared/cors.ts';

// Edge Function: price-row
// Recebe { price_table_id: uuid, km: number, rounding?: 'ceil'|'floor'|'round' }
// Retorna a linha correspondente de public.price_table_rows usando a RPC find_price_row_by_km

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
        status: 415,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { price_table_id, km, rounding } = await req.json().catch(() => ({}));

    if (!price_table_id || typeof km !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: price_table_id (uuid) and km (number)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const { data: rpcData, error: rpcError } = await supabase.rpc('find_price_row_by_km', {
      p_price_table_id: price_table_id,
      p_km_numeric: km,
      p_rounding: rounding ?? 'round',
    });

    if (rpcError) {
      console.error('RPC error', rpcError);
      return new Response(JSON.stringify({ error: 'RPC error', details: rpcError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const first = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!first?.id) {
      return new Response(JSON.stringify({ row: null }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
        },
      });
    }

    const { data: fullRow, error: fetchError } = await supabase
      .from('price_table_rows')
      .select('*')
      .eq('id', first.id)
      .single();

    if (fetchError) {
      console.error('Fetch full row error', fetchError);
      return new Response(JSON.stringify({ error: 'Fetch error', details: fetchError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ row: fullRow }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        Connection: 'keep-alive',
      },
    });
  } catch (e) {
    console.error('Unhandled error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
