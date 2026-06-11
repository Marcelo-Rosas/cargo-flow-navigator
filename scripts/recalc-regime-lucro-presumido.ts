/**
 * Script: recalc-regime-lucro-presumido.ts
 *
 * Recalcula pricing_breakdown de cotações ativas após mudança de regime tributário.
 * Usa calculate-freight + buildStoredBreakdownFromEdgeResponse (paridade com o modal).
 * Preserva quote.value quando menor que totalCliente (desconto comercial).
 *
 * Uso (lê .env, .env.local, .env.e2e):
 *   npx tsx scripts/recalc-regime-lucro-presumido.ts
 *   npx tsx scripts/recalc-regime-lucro-presumido.ts --apply
 *   npx tsx scripts/recalc-regime-lucro-presumido.ts --quote-code COT-2026-06-0003
 *   npx tsx scripts/recalc-regime-lucro-presumido.ts --only-stale --apply
 *
 * Variáveis:
 *   SUPABASE_URL ou VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (gravação no banco)
 *   VITE_SUPABASE_PUBLISHABLE_KEY (login para Edge)
 *   PW_TEST_USER / PW_TEST_PASSWORD (login para calculate-freight)
 */

import { createClient } from '@supabase/supabase-js';
import { invokeCalculateFreightAsUser, loadSupabaseScriptEnv } from './lib/load-supabase-env';
import type { CalculateFreightResponse } from '../src/types/freight';
import type { StoredPricingBreakdown } from '../src/lib/freightCalculator';
import {
  buildCalculateFreightPayload,
  finalizeStoredBreakdown,
  hasCliFlag,
  isRegimeStaleInBreakdown,
  parseCliFlag,
  type QuoteRecalcRow,
} from './lib/recalc-quote-pricing';

const scriptEnv = loadSupabaseScriptEnv();
const supabase = createClient(scriptEnv.url, scriptEnv.serviceRoleKey);
const dryRun = !hasCliFlag('--apply');
const quoteCodeFilter = parseCliFlag('--quote-code');
const onlyStale = hasCliFlag('--only-stale');

function fmt(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

async function loadGlobalRegime(): Promise<{ lucroPresumido: boolean; simplesNacional: boolean }> {
  const { data, error } = await supabase
    .from('pricing_rules_config')
    .select('key, value, vehicle_type_id')
    .eq('is_active', true)
    .in('key', [
      'regime_lucro_presumido',
      'regime_simples_nacional',
      'pis_percent',
      'cofins_percent',
    ]);

  if (error) {
    console.warn('Aviso: não foi possível ler pricing_rules_config:', error.message);
    return { lucroPresumido: true, simplesNacional: false };
  }

  const global = (data ?? []).filter((r) => !r.vehicle_type_id);
  const get = (ruleKey: string) => Number(global.find((r) => r.key === ruleKey)?.value ?? 0);

  const pis = get('pis_percent');
  const cofins = get('cofins_percent');
  let lucroPresumido = get('regime_lucro_presumido') === 1;
  const simplesRaw = get('regime_simples_nacional') === 1;
  if (!lucroPresumido && !simplesRaw && (pis > 0 || cofins > 0)) {
    lucroPresumido = true;
  }
  return {
    lucroPresumido,
    simplesNacional: lucroPresumido ? false : simplesRaw,
  };
}

async function main() {
  const expectedRegime = await loadGlobalRegime();

  console.log(`\n${'='.repeat(70)}`);
  console.log('  RECÁLCULO MEMÓRIA DE PRECIFICAÇÃO (regime / DRE)');
  console.log(`  Modo: ${dryRun ? 'DRY RUN' : 'APLICANDO'}`);
  if (quoteCodeFilter) console.log(`  Filtro: ${quoteCodeFilter}`);
  if (onlyStale) console.log('  Filtro: apenas cotações com regime desatualizado');
  console.log(
    `  Regras globais: LP=${expectedRegime.lucroPresumido} Simples=${expectedRegime.simplesNacional}`
  );
  console.log(`${'='.repeat(70)}\n`);

  let query = supabase
    .from('quotes')
    .select(
      `id, quote_code, stage, value, origin, destination, km_distance, weight, volume, cargo_value, toll_value, cargo_type,
       vehicle_type_id, payment_term_id, price_table_id, freight_modality, pricing_breakdown,
       vehicle_types ( code ),
       payment_terms ( code )`
    )
    .order('created_at', { ascending: false });

  if (quoteCodeFilter) {
    query = query.eq('quote_code', quoteCodeFilter);
  } else {
    query = query
      .in('stage', ['negociacao', 'enviado', 'precificacao'])
      .gte('created_at', '2026-01-01');
  }

  const { data: quotes, error } = await query;

  if (error) {
    console.error('Erro ao buscar cotações:', error.message);
    process.exit(1);
  }

  if (!quotes?.length) {
    console.log('Nenhuma cotação encontrada para os filtros informados.');
    return;
  }

  const rows = quotes as QuoteRecalcRow[];
  const toProcess = onlyStale
    ? rows.filter((q) =>
        isRegimeStaleInBreakdown(
          q.pricing_breakdown as StoredPricingBreakdown | null,
          expectedRegime
        )
      )
    : rows;

  console.log(`Encontradas ${rows.length} cotações; processando ${toProcess.length}.\n`);

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

  for (const quote of toProcess) {
    const code = quote.quote_code || quote.id.slice(0, 8);
    const oldBreakdown = quote.pricing_breakdown as StoredPricingBreakdown | null;
    const oldTotals = oldBreakdown?.totals;
    const oldProfit = oldBreakdown?.profitability;
    const oldTotalCliente = oldTotals?.totalCliente ?? 0;
    const oldRegime = oldProfit?.regimeFiscal ?? 'unknown';
    const oldMargemPct = oldProfit?.margemPercent ?? 0;

    const originUf =
      (quote.origin || '').match(/[,-]\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase() ?? '??';
    const destUf =
      (quote.destination || '').match(/[,-]\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase() ?? '??';
    const routeLabel = `${originUf}→${destUf}`;

    const input = buildCalculateFreightPayload(quote);
    if (!input) {
      console.log(`  [SKIP] ${code}: dados insuficientes`);
      skippedCount++;
      continue;
    }

    try {
      const { data: result, errorMessage } = await invokeCalculateFreightAsUser(scriptEnv, input);

      const response = result as CalculateFreightResponse | null;
      if (errorMessage || !response?.success) {
        const detail =
          errorMessage ||
          response?.errors?.join(', ') ||
          response?.error ||
          (typeof result === 'object' && result !== null
            ? JSON.stringify(result).slice(0, 400)
            : 'unknown');
        console.log(`  [ERROR] ${code}: ${detail}`);
        errorCount++;
        continue;
      }

      const newBreakdown = finalizeStoredBreakdown(quote, response);
      const newTotalCliente = newBreakdown.totals?.totalCliente ?? 0;
      const newRegime = newBreakdown.profitability?.regimeFiscal ?? 'unknown';
      const newMargemPct = newBreakdown.profitability?.margemPercent ?? 0;
      const delta =
        oldTotalCliente > 0 ? ((newTotalCliente - oldTotalCliente) / oldTotalCliente) * 100 : 0;
      const deltaStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;

      console.log(
        code.padEnd(20) +
          routeLabel.padEnd(12) +
          fmt(oldTotalCliente).padEnd(16) +
          fmt(newTotalCliente).padEnd(16) +
          deltaStr.padEnd(10) +
          String(oldRegime).padEnd(18) +
          String(newRegime).padEnd(18) +
          pct(oldMargemPct).padEnd(12) +
          pct(newMargemPct).padEnd(12)
      );

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('quotes')
          .update({ pricing_breakdown: newBreakdown as unknown as Record<string, unknown> })
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
  console.log(`  Recalculadas: ${updatedCount}`);
  console.log(`  Puladas: ${skippedCount}`);
  console.log(`  Erros: ${errorCount}`);
  if (dryRun) {
    console.log('\n  DRY RUN — use --apply para gravar. Campo value não é alterado.');
  } else {
    console.log('\n  Gravado. Campo value (preço negociado) preservado.');
  }
  console.log(`${'='.repeat(70)}\n`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
