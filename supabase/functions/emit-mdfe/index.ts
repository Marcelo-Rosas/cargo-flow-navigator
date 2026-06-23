// @ts-nocheck
/**
 * emit-mdfe: build and submit an MDF-e (modelo 58) to Focus NFe aggregating
 * N authorized CT-es for a single (vehicle, driver, date, UF route).
 *
 * Body: {
 *   cte_emission_ids: string[],   // must all be status=authorized
 *   vehicle_id: string,
 *   driver_id: string,
 *   percurso_ufs?: string[],      // intermediate UFs between origin and destination
 *   produto_predominante?: { descricao: string, ncm?: string, cean?: string }
 * }
 *
 * Flow:
 *   1. Auth JWT.
 *   2. Load N CT-e rows (all must be authorized + chave_cte populated).
 *   3. Load vehicle + driver.
 *   4. Derive municipios_carregamento from shipper.ibge of each CT-e's quote.
 *   5. Allocate (serie, numero) via next_mdfe_numero RPC.
 *   6. Build payload via mdfe-mapper.
 *   7. POST Focus /v2/mdfe.
 *   8. Persist mdfe_emissions + mdfe_cte_link.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { FocusClient, type FocusAmbiente } from '../_shared/focus-client.ts';
import type { VectraConfig } from '../_shared/cte-mapper.ts';
import {
  buildMdfePayload,
  type VehicleRow,
  type DriverRow,
  type CteRowForMdfe,
  type MunicipioCarregamento,
} from '../_shared/mdfe-mapper.ts';

function envOrThrow(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`[emit-mdfe] missing env: ${key}`);
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

  // Auth
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, cors);
  const userJwt = authHeader.slice('Bearer '.length);

  const supabaseUrl = envOrThrow('SUPABASE_URL');
  const serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = envOrThrow('SUPABASE_ANON_KEY');

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401, cors);
  const userId = userData.user.id;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }

  const cteIds: string[] = Array.isArray(body.cte_emission_ids)
    ? (body.cte_emission_ids as string[])
    : [];
  const vehicleId = String(body.vehicle_id ?? '');
  const driverId = String(body.driver_id ?? '');
  if (cteIds.length === 0) return json({ error: 'cte_emission_ids_required' }, 400, cors);
  if (!vehicleId) return json({ error: 'vehicle_id_required' }, 400, cors);
  if (!driverId) return json({ error: 'driver_id_required' }, 400, cors);

  // Load CT-es + their quotes + shippers (to derive municipios_carregamento)
  const { data: ctes, error: ctesErr } = await supabase
    .from('cte_emissions')
    .select('id, status, chave_cte, quote_id')
    .in('id', cteIds);
  if (ctesErr) return json({ error: 'cte_load_failed', detail: ctesErr.message }, 500, cors);
  if (!ctes || ctes.length !== cteIds.length) {
    return json(
      {
        error: 'some_ctes_not_found',
        detail: { requested: cteIds.length, found: ctes?.length ?? 0 },
      },
      404,
      cors
    );
  }
  const notAuthorized = ctes.filter((c: { status: string }) => c.status !== 'authorized');
  if (notAuthorized.length > 0) {
    return json(
      {
        error: 'cte_not_authorized',
        detail: { ids: notAuthorized.map((c: { id: string }) => c.id) },
      },
      422,
      cors
    );
  }
  const missingChave = ctes.filter((c: { chave_cte: string | null }) => !c.chave_cte);
  if (missingChave.length > 0) {
    return json(
      {
        error: 'cte_missing_chave',
        detail: { ids: missingChave.map((c: { id: string }) => c.id) },
      },
      422,
      cors
    );
  }

  // Load quotes for the CT-es (for cargo data, municipios, etc.)
  const quoteIds = ctes.map((c: { quote_id: string | null }) => c.quote_id).filter(Boolean);
  const { data: quotes, error: quotesErr } = await supabase
    .from('quotes')
    .select(
      'id, shipper_id, weight, cargo_value, destination_ibge, destination, destination_uf, origin_ibge, origin'
    )
    .in('id', quoteIds);
  if (quotesErr || !quotes) return json({ error: 'quotes_load_failed' }, 500, cors);
  const quoteById = new Map<string, any>(quotes.map((q: any) => [q.id, q]));

  // Load shippers (for municipios_carregamento)
  const shipperIds = Array.from(new Set(quotes.map((q: any) => q.shipper_id).filter(Boolean)));
  const { data: shippers, error: shipErr } = await supabase
    .from('shippers')
    .select('id, ibge_code, city, state')
    .in('id', shipperIds);
  if (shipErr || !shippers) return json({ error: 'shippers_load_failed' }, 500, cors);
  const shipperById = new Map<string, any>(shippers.map((s: any) => [s.id, s]));

  // Build CteRowForMdfe[] + municipios_carregamento[]
  const ctesForMdfe: CteRowForMdfe[] = [];
  const carregamentoMap = new Map<number, string>(); // ibge → nome
  for (const cte of ctes) {
    const quote = quoteById.get(cte.quote_id);
    if (!quote) continue;
    const shipper = shipperById.get(quote.shipper_id);
    if (shipper?.ibge_code) {
      carregamentoMap.set(shipper.ibge_code, shipper.city ?? 'SEM CIDADE');
    }
    ctesForMdfe.push({
      chave_cte: cte.chave_cte,
      municipio_destino_ibge: quote.destination_ibge ?? 0,
      municipio_destino_nome: quote.destination ?? 'SEM DESTINO',
      uf_destino: quote.destination_uf ?? '',
      valor_carga: Number(quote.cargo_value ?? 0),
      peso_kg: Number(quote.weight ?? 0),
    });
  }
  const municipiosCarregamento: MunicipioCarregamento[] = Array.from(carregamentoMap.entries()).map(
    ([codigo, nome]) => ({ codigo, nome })
  );

  // Load vehicle + driver
  const [{ data: vehicle, error: vErr }, { data: driver, error: dErr }] = await Promise.all([
    supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
    supabase.from('drivers').select('*').eq('id', driverId).single(),
  ]);
  if (vErr || !vehicle) return json({ error: 'vehicle_not_found' }, 404, cors);
  if (dErr || !driver) return json({ error: 'driver_not_found' }, 404, cors);

  // Seguro da carga: apólices ativas (RCTR-C / RC-DC). Responsável = emitente (Vectra).
  // nApol vem do `code` (dígitos); CNPJ da seguradora do metadata.insurer_cnpj
  // (fallback Berkley quando ausente — as 2 apólices emitidas não têm no metadata).
  const BERKLEY_CNPJ = '07021544000189';
  const { data: policies } = await supabase
    .from('risk_policies')
    .select('code, insurer, metadata')
    .eq('is_active', true);
  const seguros = (policies ?? [])
    .filter((pol: any) => (pol.metadata?.status ?? '') !== 'em_emissao')
    .map((pol: any) => {
      const apolice = String(pol.code ?? '').replace(/\D/g, '');
      const insurer = String(pol.insurer ?? '');
      const cnpjSeg =
        String(pol.metadata?.insurer_cnpj ?? '').replace(/\D/g, '') ||
        (/berkley/i.test(insurer) ? BERKLEY_CNPJ : '');
      return {
        responsavel_seguro: '1',
        nome_seguradora: insurer.slice(0, 30),
        ...(cnpjSeg ? { cnpj_seguradora: cnpjSeg } : {}),
        numero_apolice: apolice,
      };
    })
    .filter((s: any) => s.numero_apolice);

  // Vectra config + ambiente
  const ambiente = (Deno.env.get('FOCUS_NFE_AMBIENTE') as FocusAmbiente) ?? 'homolog';
  let vectra: VectraConfig;
  try {
    vectra = buildVectraConfig();
  } catch (err) {
    return json({ error: 'vectra_config_missing', detail: String(err) }, 500, cors);
  }

  // Allocate next numero (atomic)
  const { data: numeroData, error: numeroErr } = await supabase.rpc('next_mdfe_numero', {
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
    built = buildMdfePayload({
      ctes: ctesForMdfe,
      vehicle: vehicle as VehicleRow,
      driver: driver as DriverRow,
      serie,
      numero,
      vectra,
      municipiosCarregamento,
      seguros,
      percursoUfs: Array.isArray(body.percurso_ufs) ? (body.percurso_ufs as string[]) : undefined,
      produtoPredominante:
        typeof body.produto_predominante === 'object' && body.produto_predominante
          ? (body.produto_predominante as { descricao: string; ncm?: string; cean?: string })
          : undefined,
    });
  } catch (err) {
    return json({ error: 'mapper_failed', detail: String(err) }, 500, cors);
  }

  // Insert mdfe_emissions BEFORE Focus call
  const ufInicio = built.payload.uf_inicio as string;
  const ufFim = built.payload.uf_fim as string;
  const { data: emission, error: insErr } = await supabase
    .from('mdfe_emissions')
    .insert({
      ref: built.ref,
      ambiente,
      serie,
      numero,
      status: 'sent',
      vehicle_id: vehicleId,
      driver_id: driverId,
      uf_inicio: ufInicio,
      uf_fim: ufFim,
      payload_sent: built.payload,
      created_by: userId,
    })
    .select()
    .single();
  if (insErr || !emission) {
    return json({ error: 'persist_failed', detail: insErr?.message }, 500, cors);
  }

  // Link CT-es
  const linkRows = cteIds.map((cid) => ({ mdfe_id: emission.id, cte_emission_id: cid }));
  await supabase.from('mdfe_cte_link').insert(linkRows);

  // POST Focus
  let focusResp;
  try {
    const focus = new FocusClient({ ambiente });
    focusResp = await focus.emitMdfe(built.ref, built.payload);
  } catch (err) {
    await supabase
      .from('mdfe_emissions')
      .update({
        status: 'rejected',
        rejection_code: 'focus_network',
        rejection_msg: String(err),
        response_received: { error: String(err) },
      })
      .eq('id', emission.id);
    return json({ error: 'focus_unreachable', detail: String(err) }, 502, cors);
  }

  const focusStatus = String(focusResp.body.status ?? '');
  let newStatus = 'processing';
  if (focusResp.status === 202 || focusStatus === 'processando_autorizacao')
    newStatus = 'processing';
  else if (focusStatus === 'autorizado') newStatus = 'authorized';
  else if (focusStatus === 'cancelado') newStatus = 'cancelled';
  else if (focusStatus === 'erro_autorizacao' || focusResp.status === 422) newStatus = 'rejected';

  const isError = focusResp.status >= 400 && focusResp.status !== 409 && focusResp.status !== 422;

  await supabase
    .from('mdfe_emissions')
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
      cte_count: cteIds.length,
    },
    isError ? 502 : 200,
    cors
  );
});
