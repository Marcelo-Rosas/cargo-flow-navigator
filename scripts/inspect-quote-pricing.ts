/**
 * Inspeciona pricing_breakdown de uma cotação por quote_code.
 *   npx tsx scripts/inspect-quote-pricing.ts COT-2026-06-0002
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const quoteCode = process.argv[2] ?? 'COT-2026-06-0002';
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SR_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SR_KEY no .env');
  process.exit(1);
}

const sb = createClient(url, key);
const { data: q, error } = await sb
  .from('quotes')
  .select(
    'id, quote_code, value, km_distance, weight, volume, cargo_value, freight_modality, payment_term_id, pricing_breakdown, toll_value'
  )
  .eq('quote_code', quoteCode)
  .maybeSingle();

if (error) {
  console.error(error.message);
  process.exit(1);
}
if (!q) {
  console.error(`Cotação não encontrada: ${quoteCode}`);
  process.exit(1);
}

const b = (q.pricing_breakdown ?? {}) as Record<string, unknown>;
const rates = b.rates as Record<string, unknown> | undefined;
const components = b.components as Record<string, unknown> | undefined;
const totals = b.totals as Record<string, unknown> | undefined;
const profitability = b.profitability as Record<string, unknown> | undefined;
const meta = b.meta as Record<string, unknown> | undefined;

console.log('=== Cotação ===');
console.log({
  quote_code: q.quote_code,
  value: q.value,
  km_distance: q.km_distance,
  weight: q.weight,
  cargo_value: q.cargo_value,
  freight_modality: q.freight_modality,
  toll_value: q.toll_value,
});

console.log('\n=== Rates (%) ===');
console.log({
  markupPercent: rates?.markupPercent,
  overheadPercent: rates?.overheadPercent,
  targetMarginPercent: rates?.targetMarginPercent,
  dasPercent: rates?.dasPercent,
  icmsPercent: rates?.icmsPercent,
  grisPercent: rates?.grisPercent,
  costValuePercent: rates?.costValuePercent,
});

console.log('\n=== Components (R$) ===');
console.log(components);

console.log('\n=== Totals (R$) ===');
console.log(totals);

console.log('\n=== Profitability (R$) ===');
console.log(profitability);

console.log('\n=== Meta ===');
console.log({
  kmBandLabel: meta?.kmBandLabel,
  marginPercent: meta?.marginPercent,
  marginStatus: meta?.marginStatus,
  antt: meta?.antt,
  ntcBase: meta?.ntcBase,
});

// Reconstruir gross-up teórico
const custosDiretos = Number(profitability?.custosDiretos ?? 0);
const overhead = Number(rates?.overheadPercent ?? 0);
const das = Number(rates?.dasPercent ?? 0);
const margin = Number(rates?.targetMarginPercent ?? profitability?.profitMarginTarget ?? 0);
const icms = Number(rates?.icmsPercent ?? 0);
const taxaBruta = (overhead + das + icms + margin) / 100;
const totalViaDivisor =
  taxaBruta < 1 ? Math.round((custosDiretos / (1 - taxaBruta)) * 100) / 100 : null;

console.log('\n=== Checagem gross-up (simplificado LP/sublimite) ===');
console.log({
  custosDiretos,
  taxaBrutaPct: (taxaBruta * 100).toFixed(2) + '%',
  totalClienteSalvo: totals?.totalCliente ?? q.value,
  totalRecalculadoDivisor: totalViaDivisor,
  markupAplicadoNoFretePeso: 'Edge: NÃO (ntc_mode); markup só em taxas condicionais %',
});
