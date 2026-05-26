/**
 * Grava snapshot de company_settings para smoke de contrato com dados reais.
 * Requer SUPABASE_URL + SUPABASE_SR_KEY no .env (service role bypassa RLS).
 *
 *   npx tsx scripts/fetch-company-settings-fixture.ts
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SR_KEY;

if (!url || !key) {
  console.error('[fetch-company] Defina SUPABASE_URL e SUPABASE_SR_KEY no .env');
  process.exit(1);
}

const sb = createClient(url, key);
const { data, error } = await sb.from('company_settings').select('*').maybeSingle();

if (error) {
  console.error('[fetch-company]', error.message);
  process.exit(1);
}
if (!data) {
  console.error('[fetch-company] Nenhum registro em company_settings');
  process.exit(1);
}

const outDir = resolve('tests/fixtures');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'company-settings.json');
writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`[fetch-company] OK → ${outPath}`);
console.log(`  ${data.legal_name} | CNPJ ${data.cnpj}`);
