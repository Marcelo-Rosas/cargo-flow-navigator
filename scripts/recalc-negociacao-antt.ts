/**
 * Script: recalc-negociacao-antt.ts
 *
 * Recalcula pricing_breakdown de cotações em negociação após reajuste ANTT.
 * Preserva o campo `value` (preço negociado) — atualiza apenas `pricing_breakdown`.
 *
 * Uso:
 *   npx tsx scripts/recalc-negociacao-antt.ts           # dry-run (mostra diff sem gravar)
 *   npx tsx scripts/recalc-negociacao-antt.ts --apply    # grava no banco
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Variáveis de ambiente necessárias: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY\n' +
      'Exemplo: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/recalc-negociacao-antt.ts'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const dryRun = !process.argv.includes('--apply');

interface QuoteRow {
  id: string;
  quote_code: string | null;
  stage: string;
  value: number;
  origin: string;
  destination: string;
  km_distance: number | null;
  weight: number | null;
  volume: number | null;
  cargo_value: number | null;
  toll_value: number | null;
  vehicle_type_code: string | null;
  payment_term_code: string | null;
  price_table_id: string | null;
  pricing_breakdown: Record<string, unknown> | null;
}

async function main() {
  console.log(`\n=== Recálculo ANTT — ${dryRun ? 'DRY RUN' : 'APLICANDO'} ===\n`);

  // 1. Buscar cotações em negociação
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(
      'id, quote_code, stage, value, origin, destination, km_distance, weight, volume, cargo_value, toll_value, vehicle_type_code, payment_term_code, price_table_id, pricing_breakdown'
    )
    .eq('stage', 'negociacao')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar cotações:', error.message);
    process.exit(1);
  }

  if (!quotes || quotes.length === 0) {
    console.log('Nenhuma cotação em negociação encontrada.');
    return;
  }

  console.log(`Encontradas ${quotes.length} cotações em negociação:\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const quote of quotes as QuoteRow[]) {
    const code = quote.quote_code || quote.id.slice(0, 8);
    const oldAntt = (quote.pricing_breakdown as Record<string, unknown>)?.meta as
      | Record<string, unknown>
      | undefined;
    const oldCcd = (oldAntt?.antt as Record<string, unknown>)?.ccd;

    // Reconstruct input for calculate-freight
    const input = {
      origin: quote.origin || '',
      destination: quote.destination || '',
      km_distance: Number(quote.km_distance) || 0,
      weight_kg: Number(quote.weight) || 0,
      volume_m3: Number(quote.volume) || 0,
      cargo_value: Number(quote.cargo_value) || 0,
      toll_value: Number(quote.toll_value) || 0,
      price_table_id: quote.price_table_id || undefined,
      vehicle_type_code: quote.vehicle_type_code || undefined,
      payment_term_code: quote.payment_term_code || undefined,
    };

    if (!input.km_distance || !input.origin || !input.destination) {
      console.log(`  [SKIP] ${code}: dados insuficientes (km=${input.km_distance})`);
      skippedCount++;
      continue;
    }

    try {
      // Call calculate-freight Edge Function (using service role — no JWT needed)
      const { data: result, error: calcError } = await supabase.functions.invoke(
        'calculate-freight',
        { body: input }
      );

      if (calcError || !result?.success) {
        console.log(
          `  [ERROR] ${code}: ${calcError?.message || result?.errors?.join(', ') || 'unknown'}`
        );
        errorCount++;
        continue;
      }

      const newBreakdown = result.breakdown;
      const newCcd = newBreakdown?.meta?.antt?.ccd;

      console.log(
        `  ${code}: CCD ${oldCcd ?? '?'} → ${newCcd ?? '?'} | ` +
          `valor preservado R$ ${Number(quote.value).toFixed(2)}`
      );

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('quotes')
          .update({ pricing_breakdown: newBreakdown })
          .eq('id', quote.id);

        if (updateError) {
          console.log(`  [ERROR] ${code}: falha ao atualizar — ${updateError.message}`);
          errorCount++;
          continue;
        }
      }

      updatedCount++;
    } catch (err) {
      console.log(`  [ERROR] ${code}: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      errorCount++;
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`  Atualizadas: ${updatedCount}`);
  console.log(`  Puladas: ${skippedCount}`);
  console.log(`  Erros: ${errorCount}`);
  if (dryRun) {
    console.log(`\n  (DRY RUN — nada foi gravado. Use --apply para aplicar)`);
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
