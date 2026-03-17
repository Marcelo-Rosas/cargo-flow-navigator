import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NTC_AGENT_JSON_URL = Deno.env.get('NTC_AGENT_JSON_URL') || '';

interface MarketIndexPayload {
  periodo_referencia: string;
  gerado_em: string;
  inctf_mensal?: number;
  inctf_acumulado?: number;
  inctl_mensal?: number;
  inctl_acumulado?: number;
  inctl_por_faixa?: Record<string, number>;
  diesel_s10?: number;
  diesel_s500?: number;
  diesel_variacao_mensal?: number;
  diesel_variacao_anual?: number;
  reajuste_sugerido?: number;
  alerta_reajuste?: 'estavel' | 'atencao' | 'urgente';
  justificativa_reajuste?: string;
  fonte?: string;
  agente_versao?: string;
  relatorio_url?: string;
}

function validatePayload(data: unknown): MarketIndexPayload {
  const d = data as Record<string, unknown>;
  if (!d.periodo_referencia || typeof d.periodo_referencia !== 'string') {
    throw new Error('Campo obrigatório: periodo_referencia');
  }
  if (!d.gerado_em || typeof d.gerado_em !== 'string') {
    throw new Error('Campo obrigatório: gerado_em');
  }
  return d as unknown as MarketIndexPayload;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    let payload: MarketIndexPayload;

    // If body has content, use it directly (manual/test insert)
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    const bodyJson = bodyText ? JSON.parse(bodyText) : null;

    if (bodyJson && bodyJson.periodo_referencia) {
      // Direct POST with payload
      payload = validatePayload(bodyJson);
    } else if (NTC_AGENT_JSON_URL) {
      // Fetch from agent's published JSON URL
      console.log(`Fetching from NTC agent: ${NTC_AGENT_JSON_URL}`);
      const res = await fetch(NTC_AGENT_JSON_URL);
      if (!res.ok) {
        throw new Error(`Fetch agent JSON failed: ${res.status} ${res.statusText}`);
      }
      const agentData = await res.json();
      payload = validatePayload(agentData);
    } else {
      throw new Error('Nenhum payload fornecido e NTC_AGENT_JSON_URL não configurada');
    }

    // Upsert into market_indices
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from('market_indices')
      .upsert(
        {
          periodo_referencia: payload.periodo_referencia,
          gerado_em: payload.gerado_em,
          inctf_mensal: payload.inctf_mensal ?? null,
          inctf_acumulado: payload.inctf_acumulado ?? null,
          inctl_mensal: payload.inctl_mensal ?? null,
          inctl_acumulado: payload.inctl_acumulado ?? null,
          inctl_por_faixa: payload.inctl_por_faixa ?? {},
          diesel_s10: payload.diesel_s10 ?? null,
          diesel_s500: payload.diesel_s500 ?? null,
          diesel_variacao_mensal: payload.diesel_variacao_mensal ?? null,
          diesel_variacao_anual: payload.diesel_variacao_anual ?? null,
          reajuste_sugerido: payload.reajuste_sugerido ?? null,
          alerta_reajuste: payload.alerta_reajuste ?? null,
          justificativa_reajuste: payload.justificativa_reajuste ?? null,
          fonte: payload.fonte ?? 'ntc-agent',
          agente_versao: payload.agente_versao ?? null,
          relatorio_url: payload.relatorio_url ?? null,
          raw_payload: payload as unknown,
        },
        { onConflict: 'periodo_referencia' }
      )
      .select('id, periodo_referencia')
      .single();

    if (error) throw error;

    console.log(`Upserted market_indices: ${data.periodo_referencia} (${data.id})`);

    return new Response(
      JSON.stringify({ success: true, id: data.id, periodo_referencia: data.periodo_referencia }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('ntc-ingest error:', err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
