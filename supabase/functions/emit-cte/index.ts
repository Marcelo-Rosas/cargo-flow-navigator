// @ts-nocheck
/**
 * emit-cte: build and submit a CT-e (modelo 57) to Focus NFe.
 *
 * Body: { quote_id: string, expedidor_id?: string, recebedor_id?: string,
 *         natureza_operacao?: string }
 *
 * Flow:
 *  1. Auth: caller must be authenticated (Supabase JWT). RBAC enforced via
 *     RLS on cte_emissions (only admin/financeiro can INSERT).
 *  2. Load quote + shipper + client rows.
 *  3. Resolve missing IBGE codes via ibge-lookup (BrasilAPI/ViaCEP).
 *  4. Allocate (serie, numero) atomically via next_cte_numero RPC.
 *  5. Build payload via cte-mapper.
 *  6. POST Focus /v2/cte?ref=<ref>.
 *  7. Persist cte_emissions (status=processing|sent).
 *  8. Return { id, ref, status, focus_status, focus_body, warnings }.
 *
 * Webhook focus-webhook will later update status to authorized|rejected.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { FocusClient, type FocusAmbiente } from '../_shared/focus-client.ts';
import { lookupIbgeByCep } from '../_shared/ibge-lookup.ts';
import { lookupIeByCnpj } from '../_shared/ie-lookup.ts';
import {
  buildCtePayload,
  type VectraConfig,
  type QuoteRow,
  type PartyRow,
} from '../_shared/cte-mapper.ts';

function envOrThrow(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`[emit-cte] missing env: ${key}`);
  return v;
}

function buildVectraConfig(): VectraConfig {
  return {
    cnpj: envOrThrow('VECTRA_CNPJ'),
    nome: envOrThrow('VECTRA_NOME'),
    fantasia: Deno.env.get('VECTRA_FANTASIA') ?? envOrThrow('VECTRA_NOME'),
    ie: envOrThrow('VECTRA_IE'),
    iest: Deno.env.get('VECTRA_IEST') ?? envOrThrow('VECTRA_IE'),
    rntrc: envOrThrow('VECTRA_RNTRC'),
    logradouro: envOrThrow('VECTRA_LOGRADOURO'),
    numero: envOrThrow('VECTRA_NUMERO'),
    complemento: Deno.env.get('VECTRA_COMPLEMENTO'),
    bairro: envOrThrow('VECTRA_BAIRRO'),
    municipio: envOrThrow('VECTRA_MUNICIPIO'),
    ibge: Number(envOrThrow('VECTRA_IBGE_MUN')),
    uf: envOrThrow('VECTRA_UF'),
    cep: envOrThrow('VECTRA_CEP'),
    telefone: Deno.env.get('VECTRA_TELEFONE'),
    crt: Number(envOrThrow('VECTRA_CRT')),
  };
}

/**
 * Resolve a IE de uma parte (shipper/client) marcada contribuinte (ie_indicator=1)
 * mas sem state_registration, via SintegrAPI, e persiste no cadastro (self-healing).
 * Se a API diz não-contribuinte (sem IE ativa na UF) → corrige ie_indicator=9.
 * Degrada sem erro: se a consulta falha, devolve a parte inalterada.
 */
async function ensurePartyIe(
  supabase: ReturnType<typeof createClient>,
  party: Record<string, unknown> | null,
  table: 'shippers' | 'clients'
): Promise<Record<string, unknown> | null> {
  if (!party) return party;
  const indicator = Number(party.ie_indicator ?? 0);
  const hasIe = party.state_registration && String(party.state_registration).trim() !== '';
  const cnpj = String(party.cnpj ?? '').replace(/\D/g, '');
  const uf = String(party.state ?? '')
    .toUpperCase()
    .slice(0, 2);
  if (indicator !== 1 || hasIe || cnpj.length !== 14 || uf.length !== 2) return party;

  const r = await lookupIeByCnpj(cnpj, uf);
  if (!r) return party;
  if (r.ie) {
    await supabase.from(table).update({ state_registration: r.ie }).eq('id', party.id);
    return { ...party, state_registration: r.ie };
  }
  if (r.naoContribuinte) {
    await supabase.from(table).update({ ie_indicator: 9 }).eq('id', party.id);
    return { ...party, ie_indicator: 9 };
  }
  return party;
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  // Auth: validate caller JWT
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401, cors);
  }
  const userJwt = authHeader.slice('Bearer '.length);

  const supabaseUrl = envOrThrow('SUPABASE_URL');
  const serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = envOrThrow('SUPABASE_ANON_KEY');

  // Service-role client: full access (we run inside trusted edge fn)
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // User-scoped client: verify identity + check RLS will permit insert
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'unauthorized', detail: userErr?.message }, 401, cors);
  }
  const userId = userData.user.id;

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }
  const quoteId = String(body.quote_id ?? '');
  if (!quoteId) return json({ error: 'quote_id_required' }, 400, cors);

  // Load quote
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();
  if (quoteErr || !quote) {
    return json({ error: 'quote_not_found', detail: quoteErr?.message }, 404, cors);
  }
  if (!quote.client_id) return json({ error: 'quote_missing_client_id' }, 422, cors);
  if (!quote.shipper_id) return json({ error: 'quote_missing_shipper_id' }, 422, cors);
  if (quote.tomador_tipo == null) return json({ error: 'quote_missing_tomador_tipo' }, 422, cors);

  // Load shipper + client
  const [{ data: shipper, error: shipErr }, { data: client, error: clientErr }] = await Promise.all(
    [
      supabase.from('shippers').select('*').eq('id', quote.shipper_id).single(),
      supabase.from('clients').select('*').eq('id', quote.client_id).single(),
    ]
  );
  if (shipErr || !shipper) return json({ error: 'shipper_not_found' }, 404, cors);
  if (clientErr || !client) return json({ error: 'client_not_found' }, 404, cors);

  // F2.3 Gate: route by shipper.emit_cte_via — prevents double-issuance with Active
  const shipperRoute = (shipper as { emit_cte_via?: string }).emit_cte_via ?? 'active';
  if (shipperRoute !== 'cfn') {
    return json(
      {
        error: 'shipper_not_routed_to_cfn',
        detail: `Shipper ${shipper.name} routed to '${shipperRoute}' — emit via that system or migrate router to 'cfn'.`,
        emit_cte_via: shipperRoute,
      },
      422,
      cors
    );
  }

  // Resolve missing IBGE for shipper/client via BrasilAPI/ViaCEP
  // + resolve/persist IE faltante (contribuinte sem state_registration) via SintegrAPI.
  const shipperPatched = await ensurePartyIe(supabase, await resolveIbge(shipper), 'shippers');
  const clientPatched = await ensurePartyIe(supabase, await resolveIbge(client), 'clients');

  // Resolve missing IBGE for origin/destination CEPs
  let originIbge = quote.origin_ibge;
  let originUf = quote.origin_uf;
  if (!originIbge && quote.origin_cep) {
    const r = await lookupIbgeByCep(quote.origin_cep);
    if (r) {
      originIbge = r.ibge_code;
      originUf = originUf ?? r.uf;
    }
  }
  let destinationIbge = quote.destination_ibge;
  let destinationUf = quote.destination_uf;
  if (!destinationIbge && quote.destination_cep) {
    const r = await lookupIbgeByCep(quote.destination_cep);
    if (r) {
      destinationIbge = r.ibge_code;
      destinationUf = destinationUf ?? r.uf;
    }
  }
  const quotePatched: QuoteRow = {
    ...quote,
    origin_ibge: originIbge,
    origin_uf: originUf,
    destination_ibge: destinationIbge,
    destination_uf: destinationUf,
  };

  // Vectra config + ambiente
  const ambiente = (Deno.env.get('FOCUS_NFE_AMBIENTE') as FocusAmbiente) ?? 'homolog';
  let vectra: VectraConfig;
  try {
    vectra = buildVectraConfig();
  } catch (err) {
    return json({ error: 'vectra_config_missing', detail: String(err) }, 500, cors);
  }

  // Allocate next numero (atomic via RPC)
  const { data: numeroData, error: numeroErr } = await supabase.rpc('next_cte_numero', {
    p_ambiente: ambiente,
    p_serie: 1,
  });
  if (numeroErr || numeroData == null) {
    return json({ error: 'numero_alloc_failed', detail: numeroErr?.message }, 500, cors);
  }
  const numero = Number(numeroData);
  const serie = 1;

  // Build payload
  let built;
  try {
    built = buildCtePayload({
      quote: quotePatched,
      shipper: shipperPatched as PartyRow,
      client: clientPatched as PartyRow,
      serie,
      numero,
      vectra,
      naturezaOperacao:
        typeof body.natureza_operacao === 'string' ? body.natureza_operacao : undefined,
    });
  } catch (err) {
    return json({ error: 'mapper_failed', detail: String(err) }, 500, cors);
  }

  // Insert cte_emissions row (status=sent) BEFORE Focus call (audit even if Focus fails)
  const { data: emission, error: insErr } = await supabase
    .from('cte_emissions')
    .insert({
      order_id: null,
      quote_id: quote.id,
      ref: built.ref,
      ambiente,
      serie,
      numero,
      status: 'sent',
      tomador_tipo: quote.tomador_tipo,
      cfop: built.payload.cfop,
      payload_sent: built.payload,
      created_by: userId,
    })
    .select()
    .single();
  if (insErr || !emission) {
    return json({ error: 'persist_failed', detail: insErr?.message }, 500, cors);
  }

  // POST Focus
  let focusResp;
  try {
    const focus = new FocusClient({ ambiente });
    focusResp = await focus.emitCte(built.ref, built.payload);
  } catch (err) {
    await supabase
      .from('cte_emissions')
      .update({
        status: 'rejected',
        rejection_code: 'focus_network',
        rejection_msg: String(err),
        response_received: { error: String(err) },
      })
      .eq('id', emission.id);
    return json({ error: 'focus_unreachable', detail: String(err) }, 502, cors);
  }

  // Map Focus response → status
  const focusStatus = String(focusResp.body.status ?? '');
  let newStatus: string = 'processing';
  if (focusResp.status === 202 || focusStatus === 'processando_autorizacao')
    newStatus = 'processing';
  else if (focusStatus === 'autorizado') newStatus = 'authorized';
  else if (focusStatus === 'cancelado') newStatus = 'cancelled';
  else if (focusStatus === 'erro_autorizacao' || focusResp.status === 422) newStatus = 'rejected';
  else if (focusResp.status === 409) newStatus = 'processing'; // already in flight

  const isError = focusResp.status >= 400 && focusResp.status !== 409 && focusResp.status !== 422;

  await supabase
    .from('cte_emissions')
    .update({
      status: newStatus,
      response_received: focusResp.body,
      status_sefaz: focusResp.body.status_sefaz ?? null,
      rejection_code:
        newStatus === 'rejected' ? String(focusResp.body.codigo_status ?? focusResp.status) : null,
      rejection_msg:
        newStatus === 'rejected'
          ? String(focusResp.body.mensagem_sefaz ?? focusResp.body.mensagem ?? '')
          : null,
    })
    .eq('id', emission.id);

  return json(
    {
      ok: !isError,
      emission_id: emission.id,
      ref: built.ref,
      ambiente,
      serie,
      numero,
      status: newStatus,
      focus_status: focusResp.status,
      focus_body: focusResp.body,
      warnings: built.warnings,
    },
    isError ? 502 : 200,
    cors
  );
});

// ---------------------------------------------------------------------------
// IBGE resolution helper
// ---------------------------------------------------------------------------
async function resolveIbge<
  T extends { ibge_code?: number | null; zip_code?: string | null; state?: string | null },
>(party: T): Promise<T> {
  if (party.ibge_code) return party;
  if (!party.zip_code) return party;
  const r = await lookupIbgeByCep(party.zip_code);
  if (!r) return party;
  return { ...party, ibge_code: r.ibge_code, state: party.state ?? r.uf };
}
