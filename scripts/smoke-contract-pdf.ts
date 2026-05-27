/**
 * Smoke: gera PDF de contrato localmente (Deno).
 *   deno run -A --config supabase/functions/generate-contract-pdf/deno.json scripts/smoke-contract-pdf.ts
 *   deno run -A --config ... scripts/smoke-contract-pdf.ts --real
 *     (requer tests/fixtures/company-settings.json via fetch-company-settings-fixture.ts)
 */
/// <reference path="./deno-cli.d.ts" />
import { renderContractPdf } from '../supabase/functions/generate-contract-pdf/contract-renderer.ts';

const mockQuote = {
  quote_code: 'SMOKE-CONTRACT-001',
  client_name: 'Cliente Teste LTDA',
  value: 1500,
  advance_due_date: '2026-06-10',
  balance_due_date: '2026-06-25',
  pricing_breakdown: {
    components: { toll: 120, aluguelMaquinas: 350, waitingTimeCost: 0 },
    profitability: { custosDescarga: 280 },
    meta: {
      unloadingCost: [
        {
          name: 'Mão de Obra',
          code: 'mao_de_obra',
          quantity: 2,
          unitValue: 80,
          total: 160,
        },
        {
          name: 'Descarga com empilhadeira',
          code: 'descarga_emp',
          quantity: 1,
          unitValue: 120,
          total: 120,
        },
      ],
      equipmentRental: [
        {
          name: 'Aluguel de Máquinas',
          code: 'empilhadeira',
          selected: true,
          quantity: 1,
          unitValue: 350,
          total: 350,
        },
      ],
    },
  },
  clients: {
    name: 'Cliente Teste LTDA',
    cnpj: '12.345.678/0001-90',
    address: 'Rua Exemplo',
    address_number: '100',
    city: 'Navegantes',
    state: 'SC',
    zip_code: '88370000',
    legal_representative_name: 'Fulano de Tal',
  },
  payment_terms: { name: '50/50', days: 30, advance_percent: 50 },
};

const useReal = Deno.args.includes('--real');
const fixtureUrl = new URL('../tests/fixtures/company-settings.json', import.meta.url);

let mockCompany: Record<string, unknown> = {
  legal_name: 'Vectra Cargo LTDA',
  cnpj: '00000000000100',
  address_street: 'Av. Principal',
  address_number: '495',
  address_city: 'Navegantes',
  address_state: 'SC',
  address_zip: '88370053',
  bank_name: 'Banco Exemplo',
  bank_agency: '0001',
  bank_account: '12345-6',
  bank_pix_key: 'contato@vectracargo.com.br',
  default_jurisdiction: 'Navegantes/SC',
  signature_city: 'Navegantes',
  legal_representative_name: 'Representante Legal',
};

if (useReal) {
  try {
    const raw = await Deno.readTextFile(fixtureUrl);
    mockCompany = JSON.parse(raw) as Record<string, unknown>;
    console.log(`[smoke] company_settings real: ${mockCompany.legal_name}`);
  } catch {
    console.error(
      '[smoke] --real requer tests/fixtures/company-settings.json — rode: npx tsx scripts/fetch-company-settings-fixture.ts'
    );
    Deno.exit(1);
  }
}

const bytes = await renderContractPdf({ quote: mockQuote, company: mockCompany, version: 1 });
const outDir = new URL('../tests/smoke/contract/', import.meta.url);
const outPath = new URL('contract-smoke.pdf', outDir);
await Deno.mkdir(outDir, { recursive: true });
await Deno.writeFile(outPath, bytes);
console.log(`[smoke] OK — ${bytes.byteLength} bytes → ${outPath.href}`);
