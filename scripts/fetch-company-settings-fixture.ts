/**
 * Grava snapshot de company_settings para smoke de contrato com dados reais.
 * Requer SUPABASE_URL + service role no .env (SUPABASE_SR_KEY ou SUPABASE_SERVICE_ROLE_KEY).
 *
 *   npx tsx scripts/fetch-company-settings-fixture.ts
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fetchLatestCompanySettings } from '../src/lib/company-settings-query.ts';
import { resolveServiceRoleKey } from './integration-health.ts';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = resolveServiceRoleKey();

if (!url || !key) {
  console.error(
    '[fetch-company] Defina SUPABASE_URL e SUPABASE_SR_KEY (ou SUPABASE_SERVICE_ROLE_KEY) no .env'
  );
  process.exit(1);
}

const sb = createClient(url, key);
const data = await fetchLatestCompanySettings(sb);
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
