// Edge Function: price-row
// Contrato de resposta:
// 200: { row }
// 404: { row: null, error }
// 4xx/5xx: { error }
// Validações 400: km inválido/negativo, table_id ausente/uuid inválido, rounding inválido
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});
// Utilidades
const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (s) => !!s && /^[0-9a-f-]{36}$/i.test(s);
const validRoundings = new Set(['ceil', 'floor', 'round']);
function json(res, init = {}) {
  return new Response(JSON.stringify(res), {
    headers: {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    },
    ...init,
  });
}
// Opcional: métrica assíncrona
async function logMetric(params) {
  try {
    // Exemplo: você pode enviar para uma tabela de logs ou observabilidade externa
    // Aqui deixamos como no-op comentado para evitar dependências externas
    // await fetch('https://example-log', { method: 'POST', body: JSON.stringify(params) });
  } catch (_) {}
}
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json(
        {
          error: 'Method not allowed',
        },
        {
          status: 405,
        }
      );
    }
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return json(
        {
          error: 'Content-Type must be application/json',
        },
        {
          status: 415,
        }
      );
    }
    const body = await req.json().catch(() => null);
    const tableId = body?.p_price_table_id ?? '';
    const rawKm = body?.p_km_numeric;
    const rounding = body?.p_rounding ?? 'ceil';
    // Validações 400
    if (!tableId || !isUuid(tableId)) {
      return json(
        {
          error: 'p_price_table_id ausente ou inválido',
        },
        {
          status: 400,
        }
      );
    }
    const km = typeof rawKm === 'string' ? Number(rawKm) : Number(rawKm);
    if (!Number.isFinite(km)) {
      return json(
        {
          error: 'p_km_numeric inválido',
        },
        {
          status: 400,
        }
      );
    }
    if (km < 0) {
      return json(
        {
          error: 'p_km_numeric não pode ser negativo',
        },
        {
          status: 400,
        }
      );
    }
    if (!validRoundings.has(rounding)) {
      return json(
        {
          error: 'p_rounding inválido. Use ceil | floor | round',
        },
        {
          status: 400,
        }
      );
    }
    const { data, error } = await supabase.rpc('find_price_row_by_km', {
      p_price_table_id: tableId,
      p_km_numeric: km,
      p_rounding: rounding,
    });
    // Logs assíncronos (não bloqueantes)
    // deno-lint-ignore no-explicit-any
    globalThis.EdgeRuntime?.waitUntil?.(
      logMetric({
        fn: 'price-row',
        tableId,
        km,
        rounding,
        hasError: !!error,
        rows: Array.isArray(data) ? data.length : null,
        t: Date.now(),
      })
    );
    if (error) {
      // Erro do banco/sistema -> 500
      return json(
        {
          error: error.message ?? 'Erro interno',
        },
        {
          status: 500,
        }
      );
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      return json(
        {
          row: null,
          error: `Nenhuma faixa encontrada para ${km} km na tabela especificada`,
        },
        {
          status: 404,
        }
      );
    }
    // Sucesso 200
    const row = data[0];
    return json(
      {
        row,
      },
      {
        status: 200,
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(
      {
        error: message || 'Erro interno',
      },
      {
        status: 500,
      }
    );
  }
});
