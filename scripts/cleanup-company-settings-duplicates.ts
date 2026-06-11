/**
 * Remove linhas duplicadas em company_settings (quebra .maybeSingle()).
 *
 *   npx tsx scripts/cleanup-company-settings-duplicates.ts --dry-run
 *   npx tsx scripts/cleanup-company-settings-duplicates.ts --keep-id 43cb5ed0-9a93-4a2c-8a8a-be86fa8ac40b
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { resolveServiceRoleKey } from './integration-health.ts';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = resolveServiceRoleKey();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const keepIdArg = arg('--keep-id');

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const sb = createClient(url, key);

const { data: rows, error } = await sb
  .from('company_settings')
  .select('id, legal_name, cnpj, updated_at, created_at')
  .order('updated_at', { ascending: false });

if (error) {
  console.error('[cleanup-company]', error.message);
  process.exit(1);
}

if (!rows?.length) {
  console.log('[cleanup-company] Nenhum registro.');
  process.exit(0);
}

if (rows.length === 1) {
  console.log('[cleanup-company] Apenas 1 registro — nada a fazer:', rows[0].id);
  process.exit(0);
}

console.log(`[cleanup-company] ${rows.length} registros encontrados:`);
for (const row of rows) {
  console.log(`  - ${row.id} | CNPJ ${row.cnpj} | updated ${row.updated_at ?? row.created_at}`);
}

const validCnpjRow = rows.find((r) => {
  const d = String(r.cnpj ?? '').replace(/\D/g, '');
  return d.length === 14 && !/^0+$/.test(d);
});
const keepId = keepIdArg ?? validCnpjRow?.id ?? rows[0].id;
const toDelete = rows.filter((r) => r.id !== keepId).map((r) => r.id);

console.log(`\n[cleanup-company] Manter: ${keepId}`);
console.log(`[cleanup-company] Remover: ${toDelete.join(', ') || '(nenhum)'}`);

if (toDelete.length === 0) {
  process.exit(0);
}

if (dryRun) {
  console.log('\n[cleanup-company] --dry-run: nenhuma alteração aplicada.');
  process.exit(0);
}

const keeper = rows.find((r) => r.id === keepId);
const normalizedCnpj = String(keeper?.cnpj ?? '').replace(/\D/g, '');
if (normalizedCnpj.length === 14 && keeper?.cnpj !== normalizedCnpj) {
  const { error: normErr } = await sb
    .from('company_settings')
    .update({ cnpj: normalizedCnpj })
    .eq('id', keepId);
  if (normErr) {
    console.warn('[cleanup-company] Aviso ao normalizar CNPJ:', normErr.message);
  } else {
    console.log(`[cleanup-company] CNPJ normalizado → ${normalizedCnpj}`);
  }
}

const { error: delErr } = await sb.from('company_settings').delete().in('id', toDelete);

if (delErr) {
  console.error('[cleanup-company] Erro ao deletar:', delErr.message);
  process.exit(1);
}

const { data: remaining } = await sb.from('company_settings').select('id, cnpj, legal_name');
console.log('\n[cleanup-company] Concluído. Restante:', remaining);
