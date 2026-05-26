/**
 * Gera contrato PDF para uma cotação pelo quote_code (fluxo real: Edge Function + Storage).
 *
 *   npx tsx scripts/generate-contract-by-code.ts COT-2026-05-0006
 *   npx tsx scripts/generate-contract-by-code.ts COT-2026-05-0006 --force
 *   npx tsx scripts/generate-contract-by-code.ts COT-2026-05-0006 --local
 *
 * Env (.env):
 *   VITE_SUPABASE_URL ou SUPABASE_URL
 *   SUPABASE_SR_KEY (recomendado) OU VITE_SUPABASE_PUBLISHABLE_KEY + sessão não usada aqui
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const quoteCode = process.argv[2];
const forceRegenerate = process.argv.includes('--force');
const localOnly = process.argv.includes('--local');

if (!quoteCode) {
  console.error(
    'Uso: npx tsx scripts/generate-contract-by-code.ts <QUOTE_CODE> [--force] [--local]'
  );
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const srKey = process.env.SUPABASE_SR_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const key = srKey ?? anonKey;

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SR_KEY (ou VITE_SUPABASE_PUBLISHABLE_KEY) no .env');
  process.exit(1);
}

const sb = createClient(url, key);

const { data: quote, error: quoteErr } = await sb
  .from('quotes')
  .select('id, quote_code, stage, client_name, value')
  .eq('quote_code', quoteCode)
  .maybeSingle();

if (quoteErr) {
  console.error('[contract]', quoteErr.message);
  process.exit(1);
}
if (!quote) {
  console.error(`[contract] Cotação não encontrada: ${quoteCode}`);
  process.exit(1);
}

console.log(
  `[contract] ${quote.quote_code} | id=${quote.id} | stage=${quote.stage} | ${quote.client_name}`
);

if (quote.stage !== 'ganho') {
  console.warn(`[contract] Aviso: stage="${quote.stage}" — Edge Function exige "ganho"`);
}

if (localOnly) {
  const { data: fullQuote, error: loadErr } = await sb
    .from('quotes')
    .select(
      `
      id, quote_code, client_id, client_name, client_email,
      origin, destination, cargo_type, weight, volume,
      value, payment_term_id, estimated_loading_date, validity_date,
      advance_due_date, balance_due_date, stage,
      pricing_breakdown, conditional_fees_breakdown,
      payment_terms:payment_term_id (name, days, advance_percent),
      clients:client_id (
        name, cnpj, address, city, state, zip_code, zip_code_mask,
        state_registration, legal_representative_name,
        legal_representative_cpf, legal_representative_role,
        address_number, address_complement, address_neighborhood
      )
    `
    )
    .eq('id', quote.id)
    .single();

  if (loadErr || !fullQuote) {
    console.error('[contract] Falha ao carregar cotação completa:', loadErr?.message);
    process.exit(1);
  }

  const { data: company, error: companyErr } = await sb
    .from('company_settings')
    .select('*')
    .maybeSingle();
  if (companyErr || !company) {
    console.error('[contract] company_settings:', companyErr?.message ?? 'não configurado');
    process.exit(1);
  }

  console.log('[contract] Render local via Deno (rode o comando abaixo):');
  const payload = { quote: fullQuote, company, version: 1 };
  const payloadPath = resolve('tests/fixtures', `contract-payload-${quoteCode}.json`);
  mkdirSync(resolve('tests/fixtures'), { recursive: true });
  writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`  Payload: ${payloadPath}`);
  console.log(
    `  deno run -A --config supabase/functions/generate-contract-pdf/deno.json scripts/render-contract-from-payload.ts ${payloadPath}`
  );
  process.exit(0);
}

if (!srKey) {
  console.error(
    '[contract] Para invocar a Edge Function, defina SUPABASE_SR_KEY no .env.\n' +
      '  Alternativa: --local grava payload JSON e instrui render Deno.'
  );
  process.exit(1);
}

const fnUrl = `${url}/functions/v1/generate-contract-pdf`;
const res = await fetch(fnUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${srKey}`,
    apikey: srKey,
  },
  body: JSON.stringify({ quote_id: quote.id, force_regenerate: forceRegenerate }),
});

const text = await res.text();
let json: Record<string, unknown>;
try {
  json = JSON.parse(text) as Record<string, unknown>;
} catch {
  console.error('[contract] Resposta inválida:', res.status, text.slice(0, 500));
  process.exit(1);
}

if (!res.ok) {
  console.error('[contract] Erro', res.status, json.error ?? text);
  process.exit(1);
}

console.log('[contract] OK');
console.log(JSON.stringify(json, null, 2));

if (json.signed_url) {
  const outDir = resolve('tests/smoke/contract');
  mkdirSync(outDir, { recursive: true });
  const pdfRes = await fetch(String(json.signed_url));
  if (pdfRes.ok) {
    const buf = Buffer.from(await pdfRes.arrayBuffer());
    const safeName = quoteCode.replace(/[^\w-]/g, '_');
    const outPath = resolve(outDir, `${safeName}-contrato-v${json.version ?? 1}.pdf`);
    writeFileSync(outPath, buf);
    console.log(`[contract] PDF salvo: ${outPath} (${buf.byteLength} bytes)`);
  }
}
