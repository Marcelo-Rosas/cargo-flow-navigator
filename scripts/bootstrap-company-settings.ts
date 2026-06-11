/**
 * Cria linha inicial em company_settings se não existir (service role).
 *
 *   npx tsx scripts/bootstrap-company-settings.ts
 *   npx tsx scripts/bootstrap-company-settings.ts --cnpj 12345678000199 --legal-name "VECTRA CARGO LTDA"
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

const cnpj = (arg('--cnpj') ?? process.env.VECTRA_CNPJ ?? '').replace(/\D/g, '');
const legalName = arg('--legal-name') ?? process.env.VECTRA_LEGAL_NAME ?? 'VECTRA CARGO LTDA';
const tradeName = arg('--trade-name') ?? process.env.VECTRA_TRADE_NAME ?? 'Vectra Cargo';

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

if (cnpj.length !== 14) {
  console.error('CNPJ inválido. Use --cnpj 14digitos ou VECTRA_CNPJ no .env');
  process.exit(1);
}

const sb = createClient(url, key);

const { data: existingRows } = await sb
  .from('company_settings')
  .select('id, legal_name, cnpj')
  .order('updated_at', { ascending: false })
  .limit(1);
const existing = existingRows?.[0];
if (existing) {
  console.log('[bootstrap-company] Já existe:', existing.legal_name, existing.cnpj);
  process.exit(0);
}

const row = {
  legal_name: legalName,
  trade_name: tradeName,
  cnpj,
  state_registration: '',
  address_street: 'A definir',
  address_number: 'S/N',
  address_neighborhood: '',
  address_city: 'Navegantes',
  address_state: 'SC',
  address_zip: '88370000',
  default_jurisdiction: 'Navegantes/SC',
  signature_city: 'Navegantes',
};

const { data, error } = await sb.from('company_settings').insert(row).select().single();

if (error) {
  console.error('[bootstrap-company] Erro:', error.message);
  process.exit(1);
}

console.log('[bootstrap-company] Criado:', data.legal_name, '| CNPJ', data.cnpj);
console.log('Edite endereço completo em /configuracoes-empresa');
