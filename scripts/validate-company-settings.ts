/**
 * Valida company_settings: 1 linha, CNPJ válido, constraint singleton.
 *   npx tsx scripts/validate-company-settings.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { resolveServiceRoleKey } from './integration-health.ts';
import { isValidCompanyCnpj } from '../src/lib/company-settings-normalize.ts';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = resolveServiceRoleKey();

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key);
let failed = 0;

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
  failed++;
}

console.log('[validate-company-settings]');

const { data: rows, error: listErr } = await sb.from('company_settings').select('*');
if (listErr) {
  fail(`SELECT falhou: ${listErr.message}`);
  process.exit(1);
}

if (rows?.length === 1) {
  ok(`Exatamente 1 registro (${rows[0].id})`);
} else {
  fail(`Esperado 1 registro, encontrado ${rows?.length ?? 0}`);
}

const row = rows?.[0];
if (row && isValidCompanyCnpj(row.cnpj)) {
  ok(`CNPJ válido: ${row.cnpj} (${row.legal_name})`);
} else {
  fail(`CNPJ inválido ou placeholder: ${row?.cnpj ?? '—'}`);
}

const { error: dupErr } = await sb.from('company_settings').insert({
  legal_name: 'DUPLICATE TEST',
  trade_name: 'TEST',
  cnpj: '59650913000104',
  state_registration: '',
  address_street: 'Test',
  address_number: '1',
  address_neighborhood: '',
  address_city: 'Test',
  address_state: 'SC',
  address_zip: '88370000',
});

if (dupErr?.code === '23505') {
  ok('Constraint singleton bloqueia segundo INSERT (23505)');
} else if (dupErr) {
  ok(`Segundo INSERT rejeitado: ${dupErr.code ?? ''} ${dupErr.message}`);
} else {
  fail('Segundo INSERT deveria falhar — remova manualmente se criou linha teste');
  if (rows && rows.length > 1) {
    await sb.from('company_settings').delete().eq('legal_name', 'DUPLICATE TEST');
  }
}

const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (anonKey) {
  const anon = createClient(url, anonKey);
  const { data: anonRows, error: anonErr } = await anon
    .from('company_settings')
    .select('id')
    .limit(1);
  if (anonErr) {
    fail(`Leitura anon falhou: ${anonErr.message}`);
  } else if ((anonRows?.length ?? 0) === 0) {
    ok('RLS: anon não lê company_settings (esperado — só admin autenticado)');
  } else {
    ok(`Cliente anon lê ${anonRows?.length} registro(s)`);
  }
} else {
  console.log('  · Pulando teste anon (sem VITE_SUPABASE_PUBLISHABLE_KEY)');
}

console.log(
  failed === 0
    ? '\n[validate-company-settings] PASS'
    : `\n[validate-company-settings] FAIL (${failed})`
);
process.exit(failed === 0 ? 0 : 1);
