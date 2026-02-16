import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';

// Edge Function: price-row
// Contrato: 200 { row } | 404 { row: null, error } | 400 validação | 500 erro interno
// Recebe { price_table_id: uuid, km: number, rounding?: 'ceil'|'floor'|'round' }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROUNDING = ['ceil', 'floor', 'round'] as const;

function jsonResponse(body: object, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', Connection: 'keep-alive' },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return jsonResponse({ error: 'Content-Type must be application/json' }, 415, corsHeaders);
    }

    const { price_table_id, km, rounding } = await req.json().catch(() => ({}));

    // Validação antecipada 400
    if (!price_table_id) {
      return jsonResponse({ error: 'Missing required field: price_table_id' }, 400, corsHeaders);
    }
    if (typeof price_table_id !== 'string' || !UUID_REGEX.test(price_table_id)) {
      return jsonResponse(
        { error: 'Invalid price_table_id: must be a valid UUID' },
        400,
        corsHeaders
      );
    }
    if (typeof km !== 'number' || !Number.isFinite(km)) {
      return jsonResponse(
        { error: 'Missing or invalid field: km must be a finite number' },
        400,
        corsHeaders
      );
    }
    if (km < 0) {
      return jsonResponse({ error: 'km must be >= 0' }, 400, corsHeaders);
    }
    const roundVal = rounding ?? 'round';
    if (!VALID_ROUNDING.includes(roundVal)) {
      return jsonResponse(
        { error: `rounding must be one of: ${VALID_ROUNDING.join(', ')}` },
        400,
        corsHeaders
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
      p_rounding: roundVal,
    });

    if (rpcError) {
      console.error('[price-row] RPC error', rpcError);
      return jsonResponse(
        { error: 'Erro ao buscar faixa no banco', details: (rpcError as Error).message },
        500,
        corsHeaders
      );
    }

    const first = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!first?.id) {
      return jsonResponse(
        { row: null, error: `Nenhuma faixa encontrada para ${km} km na tabela especificada` },
        404,
        corsHeaders
      );
    }

    const { data: fullRow, error: fetchError } = await supabase
      .from('price_table_rows')
      .select('*')
      .eq('id', first.id)
      .single();

    if (fetchError) {
      console.error('[price-row] Fetch full row error', fetchError);
      return jsonResponse(
        { error: 'Erro ao obter dados da faixa', details: (fetchError as Error).message },
        500,
        corsHeaders
      );
    }

    return jsonResponse({ row: fullRow }, 200, corsHeaders);
  } catch (e) {
    console.error('[price-row] Unhandled error', e);
    return jsonResponse({ error: 'Internal error' }, 500, corsHeaders);
  }
});
