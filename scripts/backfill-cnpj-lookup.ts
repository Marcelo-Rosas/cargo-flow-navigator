/**
 * Script: backfill-cnpj-lookup.ts
 *
 * Sincroniza cadastros de clients/shippers com o cartão CNPJ da Receita
 * Federal (via BrasilAPI). Popula os 14+ campos novos da migration
 * 20260714000003 (trade_name, legal_nature*, cnae_*, partners, etc.) e
 * separa bairro/número/complemento que estavam concatenados em address.
 *
 * Uso:
 *   npx tsx scripts/backfill-cnpj-lookup.ts                      # dry-run (default)
 *   npx tsx scripts/backfill-cnpj-lookup.ts --apply              # commit no banco
 *   npx tsx scripts/backfill-cnpj-lookup.ts --apply --only=clients
 *   npx tsx scripts/backfill-cnpj-lookup.ts --apply --only=shippers
 *
 * Variáveis de ambiente necessárias (lidas de .env / .env.local):
 *   - VITE_SUPABASE_URL ou SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (RLS bypass — coloque no .env.local, NÃO no .env)
 *
 * Política de overwrite (híbrida):
 *   - HARD overwrite (Receita é fonte da verdade):
 *       trade_name, legal_nature*, company_size, cnae_*, opening_date,
 *       registration_*, efr, share_capital, partners,
 *       address_number, address_complement, address_neighborhood,
 *       cnpj_lookup_at
 *       + (shippers/clients) legal_representative_* via pickLegalRepresentative
 *   - FILL-ONLY se NULL (operador pode ter ajustado):
 *       address (logradouro), zip_code, city, state, email, phone
 *   - NUNCA toca: name (razão social — pode estar customizada)
 *
 * Filtro: apenas registros com cnpj NOT NULL e cnpj_lookup_at IS NULL
 *         (idempotente — re-rodar não duplica).
 *
 * Rate limit: sequencial, 400ms entre chamadas (BrasilAPI = 3 req/s).
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  CnpjLookupError,
  lookupCnpj,
  pickLegalRepresentative,
  type CnpjLookupResult,
} from '../src/lib/cnpjLookup';

// Carrega .env, .env.local e .env.e2e (este último guarda o
// SUPABASE_SERVICE_ROLE_KEY no projeto). Override nessa ordem.
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
loadEnv({ path: '.env.e2e', override: false }); // só preenche o que faltar

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    '\n  Variáveis necessárias:\n' +
      '   - VITE_SUPABASE_URL (ou SUPABASE_URL)\n' +
      '   - SUPABASE_SERVICE_ROLE_KEY\n\n' +
      '  Coloque o service_role_key no .env.local (não commitar) e re-execute.\n'
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const dryRun = !argv.includes('--apply');
const onlyArg = argv.find((a) => a.startsWith('--only='))?.split('=')[1] as
  | 'clients'
  | 'shippers'
  | undefined;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TableName = 'clients' | 'shippers';

interface BackfillRow {
  id: string;
  name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  cnpj_lookup_at: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sanitize = (v: string) => v.replace(/\D/g, '');
const fillIfNull = <T>(current: T | null | undefined, incoming: T | null): T | null =>
  current != null && (typeof current !== 'string' || current.trim().length > 0)
    ? (current as T)
    : (incoming ?? null);

function buildUpdatePayload(
  current: BackfillRow,
  result: CnpjLookupResult,
  table: TableName
): Record<string, unknown> {
  const rep = pickLegalRepresentative(result.partners);

  const payload: Record<string, unknown> = {
    // HARD overwrite — campos novos da Receita
    trade_name: result.trade_name,
    legal_nature: result.legal_nature,
    legal_nature_code: result.legal_nature_code,
    company_size: result.company_size,
    cnae_main_code: result.cnae_main_code,
    cnae_main_description: result.cnae_main_description,
    cnaes_secondary: result.cnaes_secondary,
    opening_date: result.opening_date,
    registration_status: result.registration_status,
    registration_status_date: result.registration_status_date,
    registration_status_reason: result.registration_status_reason,
    efr: result.efr,
    share_capital: result.share_capital,
    partners: result.partners,

    // HARD overwrite — endereço estruturado (Receita é fonte da verdade)
    address_number: result.address_number,
    address_complement: result.address_complement,
    address_neighborhood: result.address_neighborhood,

    // FILL-ONLY se NULL — operador pode ter ajustado
    address: fillIfNull(current.address, result.address),
    zip_code: fillIfNull(current.zip_code, result.zip_code),
    city: fillIfNull(current.city, result.city),
    state: fillIfNull(current.state, result.state),
    email: fillIfNull(current.email, result.email),
    phone: fillIfNull(current.phone, result.phone),

    // Marca a sincronia
    cnpj_lookup_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Representante legal (ambas tabelas têm os campos)
  if (rep) {
    payload.legal_representative_name = rep.name || null;
    payload.legal_representative_role = rep.role ?? null;
    payload.legal_representative_cpf = rep.document ?? null;
  }

  // Suprime keys não aplicáveis (defesa — payload é simétrico hoje)
  void table;
  return payload;
}

async function processTable(table: TableName): Promise<{
  total: number;
  applied: number;
  skipped: number;
  errors: number;
}> {
  console.log(`\n=== ${table.toUpperCase()} ===`);

  const { data, error } = await supabase
    .from(table)
    .select('id, name, cnpj, email, phone, address, city, state, zip_code, cnpj_lookup_at')
    .not('cnpj', 'is', null)
    .is('cnpj_lookup_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error(`  ✗ erro ao buscar ${table}:`, error.message);
    return { total: 0, applied: 0, skipped: 0, errors: 1 };
  }

  const rows = (data ?? []) as BackfillRow[];
  console.log(`  ${rows.length} candidato(s) com cnpj_lookup_at IS NULL\n`);

  let applied = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const cnpj = sanitize(row.cnpj ?? '');
    const label = `${row.name ?? '(sem nome)'} [${row.cnpj}]`;

    if (cnpj.length !== 14) {
      console.log(`  ⊘ ${label} → CNPJ inválido (skip)`);
      skipped++;
      continue;
    }

    try {
      const result = await lookupCnpj(cnpj);
      const payload = buildUpdatePayload(row, result, table);

      if (dryRun) {
        const newKeys = Object.keys(payload).filter((k) => k !== 'updated_at');
        console.log(`  ✓ ${label} → ${newKeys.length} campos prontos (DRY RUN)`);
      } else {
        const { error: upErr } = await supabase.from(table).update(payload).eq('id', row.id);
        if (upErr) {
          console.log(`  ✗ ${label} → erro ao gravar: ${upErr.message}`);
          errors++;
        } else {
          console.log(`  ✓ ${label} → atualizado`);
          applied++;
        }
      }
    } catch (e) {
      if (e instanceof CnpjLookupError) {
        console.log(`  ✗ ${label} → ${e.code}: ${e.message}`);
      } else {
        console.log(`  ✗ ${label} → erro: ${(e as Error).message}`);
      }
      errors++;
    }

    await sleep(400); // BrasilAPI: 3 req/s
  }

  return { total: rows.length, applied, skipped, errors };
}

async function main() {
  console.log(`\n  Backfill CNPJ Lookup — ${dryRun ? 'DRY RUN' : 'APLICANDO'}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  if (onlyArg) console.log(`  Filtro: --only=${onlyArg}`);

  const tables: TableName[] = onlyArg ? [onlyArg] : ['clients', 'shippers'];

  const summary: Record<
    TableName,
    { total: number; applied: number; skipped: number; errors: number }
  > = {
    clients: { total: 0, applied: 0, skipped: 0, errors: 0 },
    shippers: { total: 0, applied: 0, skipped: 0, errors: 0 },
  };

  for (const t of tables) {
    summary[t] = await processTable(t);
  }

  console.log('\n=== SUMMARY ===');
  for (const t of tables) {
    const s = summary[t];
    console.log(
      `  ${t.padEnd(8)} total=${s.total}  applied=${s.applied}  skipped=${s.skipped}  errors=${s.errors}`
    );
  }
  if (dryRun) {
    console.log('\n  Dry-run — nada foi gravado. Re-rode com --apply para commitar.\n');
  } else {
    console.log('');
  }
}

main().catch((err) => {
  console.error('\n[backfill] FALHOU:', err);
  process.exitCode = 1;
});
