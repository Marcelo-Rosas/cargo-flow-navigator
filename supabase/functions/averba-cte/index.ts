// @ts-nocheck
/**
 * averba-cte: averba o seguro de carga de um CT-e autorizado via Averba/AT&M
 * (SOAP averbaCTe) e grava o resultado em `public.averbacoes`.
 *
 * Body: { cte_emission_id: string }
 *
 * Auth: JWT de usuário (RBAC via RLS em averbacoes: admin/financeiro) OU
 *       header `x-internal-token` == INTERNAL_AVERBA_TOKEN (trigger interno,
 *       ex.: focus-webhook após autorização).
 *
 * Fluxo:
 *  1. Carrega cte_emissions (status='authorized', chave_cte, xml_storage_path).
 *  2. Idempotência: se já existe averbação 'averbado' para o CT-e, retorna.
 *  3. Baixa o XML autorizado do storage → xmlCTe.
 *  4. Monta envelope averbaCTe + POST Averba.
 *  5. Parseia Retorno → insere em averbacoes.
 *
 * Segredos: AVERBA_USUARIO, AVERBA_SENHA, AVERBA_CODATM (nunca persistidos).
 * Opcional: AVERBA_URL (default webserver.averba.com.br/20/index.soap),
 *           INTERNAL_AVERBA_TOKEN.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  buildAverbaCteEnvelope,
  callAverba,
  parseAverbaRetorno,
} from '../_shared/averba-client.ts';

function envOrThrow(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`[averba-cte] missing env: ${key}`);
  return v;
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

  const supabaseUrl = envOrThrow('SUPABASE_URL');
  const serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Auth: internal token OR user JWT ────────────────────────────────────────
  const internalToken = Deno.env.get('INTERNAL_AVERBA_TOKEN');
  const isInternal = !!internalToken && req.headers.get('x-internal-token') === internalToken;

  let userId: string | null = null;
  if (!isInternal) {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, cors);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: 'unauthorized', detail: userErr?.message }, 401, cors);
    }
    userId = userData.user.id;
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, cors);
  }
  const cteEmissionId = typeof body.cte_emission_id === 'string' ? body.cte_emission_id : null;
  if (!cteEmissionId) return json({ error: 'cte_emission_id_required' }, 400, cors);

  // ── 1. Carrega CT-e ───────────────────────────────────────────────────────
  const { data: cte, error: cteErr } = await supabase
    .from('cte_emissions')
    .select('id, order_id, ambiente, serie, numero, status, chave_cte, xml_storage_path')
    .eq('id', cteEmissionId)
    .maybeSingle();
  if (cteErr) return json({ error: 'cte_lookup_failed', detail: cteErr.message }, 500, cors);
  if (!cte) return json({ error: 'cte_not_found' }, 404, cors);
  if (cte.status !== 'authorized') {
    return json({ error: 'cte_not_authorized', status: cte.status }, 409, cors);
  }
  if (!cte.chave_cte) return json({ error: 'cte_sem_chave' }, 422, cors);
  if (!cte.xml_storage_path) return json({ error: 'cte_sem_xml' }, 422, cors);

  // ── 2. Idempotência ──────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('averbacoes')
    .select('id, numero_averbacao, protocolo, status')
    .eq('cte_emission_id', cteEmissionId)
    .eq('status', 'averbado')
    .limit(1)
    .maybeSingle();
  if (existing) {
    return json({ ok: true, already_averbado: true, averbacao: existing }, 200, cors);
  }

  // ── 3. Baixa XML do storage (formato "bucket/filename") ─────────────────────
  const slash = String(cte.xml_storage_path).indexOf('/');
  if (slash < 1) return json({ error: 'xml_path_malformado' }, 500, cors);
  const bucket = String(cte.xml_storage_path).slice(0, slash);
  const filePath = String(cte.xml_storage_path).slice(slash + 1);
  const { data: xmlBlob, error: dlErr } = await supabase.storage.from(bucket).download(filePath);
  if (dlErr || !xmlBlob) {
    return json({ error: 'xml_download_failed', detail: dlErr?.message }, 500, cors);
  }
  const xmlCTe = await xmlBlob.text();

  // ── 4. Chama Averba ─────────────────────────────────────────────────────────
  const creds = {
    usuario: envOrThrow('AVERBA_USUARIO'),
    senha: envOrThrow('AVERBA_SENHA'),
    codatm: envOrThrow('AVERBA_CODATM'),
  };
  const url = Deno.env.get('AVERBA_URL') ?? undefined;
  const envelope = buildAverbaCteEnvelope(creds, xmlCTe);

  let httpStatus: number;
  let respBody: string;
  try {
    const r = await callAverba('averbaCTe', envelope, url);
    httpStatus = r.httpStatus;
    respBody = r.body;
  } catch (err) {
    // Falha de rede: registra tentativa como erro (auditoria) e retorna 502
    await supabase.from('averbacoes').insert({
      doc_type: 'cte',
      cte_emission_id: cte.id,
      order_id: cte.order_id,
      ambiente: cte.ambiente,
      operacao: 'averbaCTe',
      status: 'erro',
      chave: cte.chave_cte,
      doc_numero: String(cte.numero),
      doc_serie: String(cte.serie),
      erro_codigo: 'network',
      erro_descricao: String(err),
      request_sent: { operacao: 'averbaCTe', chave: cte.chave_cte, xml_bytes: xmlCTe.length },
      response_received: { error: String(err) },
      created_by: userId,
    });
    return json({ error: 'averba_unreachable', detail: String(err) }, 502, cors);
  }

  // ── 5. Parseia + persiste ────────────────────────────────────────────────
  let retorno;
  try {
    retorno = parseAverbaRetorno(respBody);
  } catch (err) {
    return json({ error: 'parse_failed', detail: String(err), http_status: httpStatus }, 502, cors);
  }

  const ds0 = retorno.dados_seguro[0] ?? null;
  const err0 = retorno.erros[0] ?? null;
  const status = retorno.averbado && ds0?.numero_averbacao ? 'averbado' : 'erro';

  const row = {
    doc_type: 'cte',
    cte_emission_id: cte.id,
    order_id: cte.order_id,
    ambiente: cte.ambiente,
    operacao: 'averbaCTe',
    status,
    chave: cte.chave_cte,
    doc_numero: String(cte.numero),
    doc_serie: String(cte.serie),
    numero_averbacao: ds0?.numero_averbacao ?? null,
    protocolo: retorno.protocolo,
    dh_averbacao: retorno.dh_averbacao,
    cnpj_seguradora: ds0?.cnpj_seguradora ?? null,
    nome_seguradora: ds0?.nome_seguradora ?? null,
    num_apolice: ds0?.num_apolice ?? null,
    valor_averbado: ds0?.valor_averbado ?? null,
    ramo_averbado: ds0?.ramo_averbado ?? null,
    tp_mov: ds0?.tp_mov ?? null,
    tp_ddr: ds0?.tp_ddr ?? null,
    dados_seguro: retorno.dados_seguro.length ? retorno.dados_seguro : null,
    protocolo_rcv: retorno.rcv?.protocolo ?? null,
    id_viagem: retorno.rcv?.id_viagem ?? null,
    rcv_erro_codigo: retorno.rcv_erro?.codigo ?? null,
    rcv_erro_descricao: retorno.rcv_erro?.descricao ?? null,
    erro_codigo: err0?.codigo ?? null,
    erro_descricao: err0?.descricao ?? null,
    erros: retorno.erros.length ? retorno.erros : null,
    infos: retorno.infos.length ? retorno.infos : null,
    request_sent: { operacao: 'averbaCTe', chave: cte.chave_cte, xml_bytes: xmlCTe.length },
    response_received: { http_status: httpStatus, raw: respBody },
    created_by: userId,
  };

  const { data: inserted, error: insErr } = await supabase
    .from('averbacoes')
    .insert(row)
    .select('id, status, numero_averbacao, protocolo, id_viagem')
    .single();
  if (insErr) {
    return json({ error: 'persist_failed', detail: insErr.message, parsed: retorno }, 500, cors);
  }

  return json(
    {
      ok: status === 'averbado',
      averbacao_id: inserted.id,
      status,
      numero_averbacao: inserted.numero_averbacao,
      protocolo: inserted.protocolo,
      id_viagem: inserted.id_viagem,
      erros: retorno.erros,
    },
    status === 'averbado' ? 200 : 422,
    cors
  );
});
