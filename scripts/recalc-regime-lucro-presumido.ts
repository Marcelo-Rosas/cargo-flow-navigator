/**
 * Script: recalc-regime-lucro-presumido.ts
 *
 * Recalcula pricing_breakdown de cotações em negociação/enviado/precificação
 * após migração Simples Nacional → Lucro Presumido.
 *
 * Gera relatório de impacto: antes/depois de cada cotação.
 * Preserva o campo `value` (preço negociado) — atualiza apenas `pricing_breakdown`.
 *
 * Uso:
 *   npx tsx scripts/recalc-regime-lucro-presumido.ts           # dry-run (relatório)
 *   npx tsx scripts/recalc-regime-lucro-presumido.ts --apply    # grava no banco
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Variáveis de ambiente necessárias: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY\n' +
      'Exemplo: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/recalc-regime-lucro-presumido.ts'
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

function fmt(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  RECÁLCULO REGIME: Simples Nacional → Lucro Presumido`);
  console.log(`  Modo: ${dryRun ? 'DRY RUN (nada será gravado)' : 'APLICANDO ALTERAÇÕES'}`);
  console.log(`${'='.repeat(70)}\n`);

  // 1. Buscar cotações ativas de 2026
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(
      'id, quote_code, stage, value, origin, destination, km_distance, weight, volume, cargo_value, toll_value, vehicle_type_code, payment_term_code, price_table_id, pricing_breakdown'
    )
    .in('stage', ['negociacao', 'enviado', 'precificacao'])
    .gte('created_at', '2026-01-01')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar cotações:', error.message);
    process.exit(1);
  }

  if (!quotes || quotes.length === 0) {
    console.log('Nenhuma cotação encontrada nos estágios negociação/enviado/precificação.');
    return;
  }

  console.log(`Encontradas ${quotes.length} cotações para recalcular.\n`);

  // Report header
  console.log(
    'COT'.padEnd(20) +
      'Rota'.padEnd(12) +
      'Total Antigo'.padEnd(16) +
      'Total Novo'.padEnd(16) +
      'Delta'.padEnd(10) +
      'Regime Ant.'.padEnd(18) +
      'Regime Novo'.padEnd(18) +
      'Margem Ant.'.padEnd(12) +
      'Margem Nova'.padEnd(12)
  );
  console.log('-'.repeat(124));

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const quote of quotes as QuoteRow[]) {
    const code = quote.quote_code || quote.id.slice(0, 8);

    // Extract old values
    const oldBreakdown = quote.pricing_breakdown as Record<string, unknown> | null;
    const oldTotals = oldBreakdown?.totals as Record<string, number> | undefined;
    const oldProfit = oldBreakdown?.profitability as Record<string, unknown> | undefined;
    const oldRates = oldBreakdown?.rates as Record<string, number> | undefined;
    const oldTotalCliente = oldTotals?.totalCliente ?? 0;
    const oldRegime = (oldProfit?.regimeFiscal as string) ?? 'unknown';
    const oldMargemPct = (oldProfit?.margemPercent as number) ?? 0;
    const oldDas = oldTotals?.das ?? 0;
    const oldIcms = oldTotals?.icms ?? 0;

    // Extract UF labels
    const originUf =
      (quote.origin || '').match(/[,-]\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase() ?? '??';
    const destUf =
      (quote.destination || '').match(/[,-]\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase() ?? '??';
    const routeLabel = `${originUf}→${destUf}`;

    // Reconstruct input
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
      console.log(`  [SKIP] ${code}: dados insuficientes`);
      skippedCount++;
      continue;
    }

    try {
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

      const newTotalCliente = result.totals?.total_cliente ?? 0;
      const newRegime = result.profitability?.regime_fiscal ?? 'unknown';
      const newMargemPct = result.profitability?.margem_percent ?? 0;
      const delta =
        oldTotalCliente > 0 ? ((newTotalCliente - oldTotalCliente) / oldTotalCliente) * 100 : 0;
      const deltaStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;

      console.log(
        code.padEnd(20) +
          routeLabel.padEnd(12) +
          fmt(oldTotalCliente).padEnd(16) +
          fmt(newTotalCliente).padEnd(16) +
          deltaStr.padEnd(10) +
          oldRegime.padEnd(18) +
          newRegime.padEnd(18) +
          pct(oldMargemPct).padEnd(12) +
          pct(newMargemPct).padEnd(12)
      );

      if (!dryRun) {
        const newBreakdown = result.breakdown ?? result;
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

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  RESULTADO`);
  console.log(`  Recalculadas: ${updatedCount}`);
  console.log(`  Puladas: ${skippedCount}`);
  console.log(`  Erros: ${errorCount}`);
  if (dryRun) {
    console.log(`\n  DRY RUN — nada foi gravado. Use --apply para aplicar.`);
  } else {
    console.log(`\n  Alterações gravadas com sucesso.`);
    console.log(`  NOTA: O campo "value" (preço negociado) NÃO foi alterado.`);
  }
  console.log(`${'='.repeat(70)}\n`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
