// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FOCUS_WEBHOOK_SECRET = Deno.env.get('FOCUS_WEBHOOK_SECRET') ?? '';
const FOCUS_WEBHOOK_HEADER = Deno.env.get('FOCUS_WEBHOOK_HEADER') ?? 'X-Focus-Auth';
const VECTRA_CNPJ = Deno.env.get('VECTRA_CNPJ') ?? '';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Horário local Brasil (UTC-3 fixo) para timestamps de auditoria. */
function nowBrasilia(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString();
}

/**
 * Baixa um documento (XML/PDF) da URL do Focus e espelha para o bucket de storage.
 * Retorna `<bucket>/<filename>` (formato lido pela UI ao gerar signed URL) ou null.
 * Degrada sem lançar: falha de mirror não pode derrubar o webhook.
 */
async function mirror(
  supabase: ReturnType<typeof createClient>,
  url: string | undefined | null,
  bucket: string,
  filename: string,
  contentType: string
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[focus-webhook] mirror fetch failed', {
        bucket,
        filename,
        status: res.status,
      });
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, bytes, { contentType, upsert: true });
    if (error) {
      console.error('[focus-webhook] upload failed', { bucket, filename, error: error.message });
      return null;
    }
    return `${bucket}/${filename}`;
  } catch (e) {
    console.error('[focus-webhook] mirror error', { bucket, filename, error: String(e) });
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'GET') {
    return json({
      service: 'focus-webhook',
      status: 'alive',
      secret_configured: FOCUS_WEBHOOK_SECRET.length > 0,
      vectra_cnpj_configured: VECTRA_CNPJ.length === 14,
      header_name: FOCUS_WEBHOOK_HEADER,
    });
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (!FOCUS_WEBHOOK_SECRET) {
    console.error('[focus-webhook] FOCUS_WEBHOOK_SECRET not configured');
    return json({ error: 'server_misconfigured' }, 500);
  }

  const received = req.headers.get(FOCUS_WEBHOOK_HEADER) ?? '';
  if (!timingSafeEqual(received, FOCUS_WEBHOOK_SECRET)) {
    console.warn('[focus-webhook] auth failed', { header: FOCUS_WEBHOOK_HEADER });
    return json({ error: 'unauthorized' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (err) {
    console.error('[focus-webhook] invalid json', err);
    return json({ error: 'invalid_json' }, 400);
  }

  const p = payload as Record<string, string>;
  const modelo = p.modelo;
  // Inutilização (modelo 65) usa "cnpj"; CT-e (57) e MDF-e (58) usam "cnpj_emitente"
  const cnpj = modelo === '65' ? p.cnpj : p.cnpj_emitente;

  if (VECTRA_CNPJ && cnpj !== VECTRA_CNPJ) {
    console.warn('[focus-webhook] cnpj mismatch', { received: cnpj, expected: VECTRA_CNPJ });
    return json({ error: 'cnpj_mismatch' }, 403);
  }

  const docType =
    modelo === '57'
      ? 'cte'
      : modelo === '58'
        ? 'mdfe'
        : modelo === '65'
          ? 'inutilizacao'
          : 'unknown';

  // Inutilização e desconhecidos: só loga (sem linha em *_emissions para atualizar).
  if (docType !== 'cte' && docType !== 'mdfe') {
    console.log('[focus-webhook] ignored', { docType, ref: p.ref, status: p.status });
    return json({ ok: true, docType, ignored: true });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('[focus-webhook] supabase env missing');
    return json({ error: 'server_misconfigured' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const ref = p.ref;
  if (!ref) return json({ error: 'ref_missing' }, 400);

  const isCte = docType === 'cte';
  const table = isCte ? 'cte_emissions' : 'mdfe_emissions';

  const focusStatus = String(p.status ?? '');
  const newStatus =
    focusStatus === 'autorizado'
      ? 'authorized'
      : focusStatus === 'cancelado'
        ? 'cancelled'
        : focusStatus === 'erro_autorizacao'
          ? 'rejected'
          : focusStatus === 'processando_autorizacao'
            ? 'processing'
            : null;

  const update: Record<string, unknown> = {
    status_sefaz: p.status_sefaz ?? null,
    protocolo: p.protocolo ?? p.numero_protocolo ?? null,
    response_received: payload,
  };
  if (newStatus) update.status = newStatus;
  if (p.chave) update[isCte ? 'chave_cte' : 'chave_mdfe'] = p.chave;

  if (newStatus === 'authorized') {
    update.data_autorizacao = nowBrasilia();
    // Arquivamento fiscal: espelhar XML autorizado + DACTE/DAMDFE no storage próprio.
    const chave = String(p.chave ?? ref).replace(/\W/g, '');
    const xmlPath = await mirror(
      supabase,
      p.caminho_xml,
      isCte ? 'cte-documents' : 'mdfe-documents',
      `${chave}.xml`,
      'application/xml'
    );
    const pdfPath = await mirror(
      supabase,
      p.caminho_dacte ?? p.caminho_damdfe ?? p.caminho_pdf,
      isCte ? 'dacte-pdfs' : 'damdfe-pdfs',
      `${chave}.pdf`,
      'application/pdf'
    );
    if (xmlPath) update.xml_storage_path = xmlPath;
    if (pdfPath) update[isCte ? 'dacte_storage_path' : 'damdfe_storage_path'] = pdfPath;
  } else if (newStatus === 'rejected') {
    update.rejection_code = p.status_sefaz ?? null;
    update.rejection_msg = p.mensagem_sefaz ?? null;
  } else if (newStatus === 'cancelled') {
    update[isCte ? 'data_cancelamento' : 'cancelled_at'] = nowBrasilia();
  }

  const { error: upErr } = await supabase.from(table).update(update).eq('ref', ref);
  if (upErr) {
    console.error('[focus-webhook] db update failed', { ref, table, error: upErr.message });
    return json({ error: 'db_update_failed', detail: upErr.message }, 500);
  }

  console.log('[focus-webhook] persisted', {
    docType,
    ref,
    newStatus,
    mirrored: newStatus === 'authorized',
  });
  return json({ ok: true, docType, ref, status: newStatus ?? 'unchanged' });
});
