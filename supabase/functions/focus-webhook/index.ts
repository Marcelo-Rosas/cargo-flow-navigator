// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

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

  console.log('[focus-webhook] received', {
    docType,
    modelo,
    ref: p.ref,
    status: p.status,
    status_sefaz: p.status_sefaz,
    chave: p.chave?.slice(0, 8) + '...',
    numero_inicial: p.numero_inicial,
    numero_final: p.numero_final,
    focus_id: p.id,
  });

  // TODO F1.9 (pós F1.1 migration): upsert cte_emissions/mdfe_emissions + mirror XML/PDF para storage.
  // Stub atual apenas valida auth + CNPJ + loga payload.

  return json({
    ok: true,
    docType,
    received: {
      ref: p.ref,
      modelo,
      status: p.status,
      numero_inicial: p.numero_inicial,
      numero_final: p.numero_final,
    },
  });
});
