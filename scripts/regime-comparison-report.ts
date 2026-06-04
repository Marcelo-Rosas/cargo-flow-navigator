#!/usr/bin/env npx tsx
/**
 * Cargo Flow Navigator — Relatório Comparativo de Regime Tributário (Dados Reais)
 *
 * Compara períodos Simples Nacional (2025) vs Lucro Presumido (a partir de abr/2026).
 * Fonte: view v_dre_regime_comparison no Supabase.
 *
 * Uso:
 *   npx tsx scripts/regime-comparison-report.ts
 * Gera: regime-comparison-report.md
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

// ─── Env ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Variáveis de ambente necessárias: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY\n' +
      'Exemplo: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/regime-comparison-report.ts'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Types ──────────────────────────────────────────────────
interface RegimeMonthRow {
  month_label: string;
  regime_fiscal: string;
  cot_count: number;
  os_count: number;
  receita_bruta: number;
  das: number;
  icms: number;
  pis: number;
  cofins: number;
  csll: number;
  irpj: number;
  total_impostos: number;
  carga_tributaria_pct: number;
  resultado_liquido: number;
  margem_liquida_avg: number;
}

// ─── Helpers ────────────────────────────────────────────────
function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeRegimeByDate(monthLabel: string): string {
  // Transição de regime: até mar/2026 = Simples Nacional; a partir de abr/2026 = Lucro Presumido
  if (monthLabel < '2026-04') return 'simples_nacional';
  return 'lucro_presumido';
}

function section(title: string, lines: string[]) {
  return [`\n## ${title}\n`, ...lines].join('\n');
}

function table(headers: string[], rows: string[][]): string {
  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return [header, sep, body].join('\n');
}

// ─── Fetch ──────────────────────────────────────────────────
async function fetchRegimeData(): Promise<RegimeMonthRow[]> {
  const { data, error } = await supabase
    .from('v_dre_regime_comparison')
    .select('*')
    .order('month_label', { ascending: true });

  if (error) {
    console.error('Erro ao buscar dados da view v_dre_regime_comparison:', error.message);
    process.exit(1);
  }

  // Normaliza regime_fiscal pela data de transição (independente do valor da view)
  return ((data ?? []) as RegimeMonthRow[]).map((r) => ({
    ...r,
    regime_fiscal: normalizeRegimeByDate(r.month_label),
  }));
}

// ─── Report Builder ─────────────────────────────────────────
function buildReport(data: RegimeMonthRow[]): string {
  const report: string[] = [];
  report.push('# Relatório Comparativo — Regime Tributário\n');
  report.push(`**Gerado em:** ${new Date().toLocaleDateString('pt-BR')}`);
  report.push(`**Fonte:** view \`v_dre_regime_comparison\` (Supabase)\n`);

  if (data.length === 0) {
    report.push(
      '⚠️ **Nenhum dado encontrado.** Verifique se a view está aplicada no banco e se existem COTs ganhas com pricing_breakdown válido.\n'
    );
    return report.join('\n');
  }

  report.push(
    `**Período analisado:** ${data[0]?.month_label} a ${data[data.length - 1]?.month_label}\n`
  );

  // ---- 1. Evolução Mensal ----
  report.push(section('1. Evolução Mensal por Regime', []));
  report.push(
    table(
      [
        'Mês',
        'Regime',
        'COTs',
        'Receita Bruta',
        'DAS',
        'ICMS',
        'PIS',
        'COFINS',
        'CSLL',
        'IRPJ',
        'Total Impostos',
        'Carga Tributária',
        'Margem Líq.',
      ],
      data.map((r) => [
        r.month_label,
        r.regime_fiscal === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido',
        String(r.cot_count),
        `R$ ${formatBrl(r.receita_bruta)}`,
        `R$ ${formatBrl(r.das)}`,
        `R$ ${formatBrl(r.icms)}`,
        `R$ ${formatBrl(r.pis)}`,
        `R$ ${formatBrl(r.cofins)}`,
        `R$ ${formatBrl(r.csll)}`,
        `R$ ${formatBrl(r.irpj)}`,
        `R$ ${formatBrl(r.total_impostos)}`,
        `${formatBrl(r.carga_tributaria_pct)}%`,
        `${formatBrl(r.margem_liquida_avg)}%`,
      ])
    )
  );

  // ---- 2. Totais por Regime ----
  const byRegime = new Map<string, RegimeMonthRow[]>();
  for (const r of data) {
    const list = byRegime.get(r.regime_fiscal) ?? [];
    list.push(r);
    byRegime.set(r.regime_fiscal, list);
  }

  report.push(section('2. Totais por Regime', []));
  const regimeRows: string[][] = [];
  for (const [regime, rows] of byRegime) {
    const receita = rows.reduce((s, r) => s + r.receita_bruta, 0);
    const impostos = rows.reduce((s, r) => s + r.total_impostos, 0);
    const resultado = rows.reduce((s, r) => s + r.resultado_liquido, 0);
    const carga = receita > 0 ? (impostos / receita) * 100 : 0;
    const margem =
      rows.length > 0 ? rows.reduce((s, r) => s + r.margem_liquida_avg, 0) / rows.length : 0;
    regimeRows.push([
      regime === 'simples_nacional' ? 'Simples Nacional' : 'Lucro Presumido',
      String(rows.reduce((s, r) => s + r.cot_count, 0)),
      `R$ ${formatBrl(receita)}`,
      `R$ ${formatBrl(impostos)}`,
      `${formatBrl(carga)}%`,
      `R$ ${formatBrl(resultado)}`,
      `${formatBrl(margem)}%`,
    ]);
  }
  report.push(
    table(
      [
        'Regime',
        'Total COTs',
        'Receita Bruta',
        'Total Impostos',
        'Carga Tributária',
        'Resultado Líquido',
        'Margem Média',
      ],
      regimeRows
    )
  );

  // ---- 3. Impacto da Transição ----
  const simples = byRegime.get('simples_nacional') ?? [];
  const lp = byRegime.get('lucro_presumido') ?? [];
  let deltaCarga = 0;
  let deltaMargem = 0;
  let avgCargaSimples = 0;
  let avgCargaLP = 0;
  let avgMargemSimples = 0;
  let avgMargemLP = 0;

  if (simples.length > 0 && lp.length > 0) {
    avgCargaSimples = simples.reduce((s, r) => s + r.carga_tributaria_pct, 0) / simples.length;
    avgCargaLP = lp.reduce((s, r) => s + r.carga_tributaria_pct, 0) / lp.length;
    deltaCarga = avgCargaLP - avgCargaSimples;

    avgMargemSimples = simples.reduce((s, r) => s + r.margem_liquida_avg, 0) / simples.length;
    avgMargemLP = lp.reduce((s, r) => s + r.margem_liquida_avg, 0) / lp.length;
    deltaMargem = avgMargemLP - avgMargemSimples;

    report.push(section('3. Impacto da Transição (Simples → Lucro Presumido)', []));
    report.push(`- **Carga tributária média — Simples Nacional:** ${formatBrl(avgCargaSimples)}%`);
    report.push(`- **Carga tributária média — Lucro Presumido:** ${formatBrl(avgCargaLP)}%`);
    report.push(`- **Aumento da carga tributária:** ${formatBrl(deltaCarga)} p.p. 🔴`);
    report.push(`- **Margem líquida média — Simples Nacional:** ${formatBrl(avgMargemSimples)}%`);
    report.push(`- **Margem líquida média — Lucro Presumido:** ${formatBrl(avgMargemLP)}%`);
    report.push(`- **Redução da margem:** ${formatBrl(Math.abs(deltaMargem))} p.p. 🔴\n`);

    // ---- 4. Ranking de Impacto por Imposto ----
    const lastSimples = simples[simples.length - 1];
    const firstLP = lp[0];
    if (lastSimples && firstLP) {
      const impostosLP = [
        { name: 'ICMS', value: firstLP.icms },
        { name: 'COFINS', value: firstLP.cofins },
        { name: 'IRPJ', value: firstLP.irpj },
        { name: 'CSLL', value: firstLP.csll },
        { name: 'PIS', value: firstLP.pis },
      ].sort((a, b) => b.value - a.value);

      report.push(section('4. Ranking de Impacto por Imposto (Lucro Presumido)', []));
      report.push(
        `Comparativo do primeiro mês LP (${firstLP.month_label}) vs último mês Simples (${lastSimples.month_label}):\n`
      );
      report.push(
        table(
          ['Imposto', 'Valor LP', '% da Receita LP'],
          impostosLP.map((i) => [
            i.name,
            `R$ ${formatBrl(i.value)}`,
            `${formatBrl(firstLP.receita_bruta > 0 ? (i.value / firstLP.receita_bruta) * 100 : 0)}%`,
          ])
        )
      );
      report.push(
        `\n**Conclusão:** O imposto que mais pesou no regime Lucro Presumido foi **${impostosLP[0]?.name}**, representando ${formatBrl(firstLP.receita_bruta > 0 ? (impostosLP[0].value / firstLP.receita_bruta) * 100 : 0)}% da receita bruta.`
      );
    }
  } else {
    report.push(section('3. Impacto da Transição', []));
    report.push(
      '⚠️ Dados insuficientes para comparar os dois regimes (necessário pelo menos 1 mês de cada).\n'
    );
  }

  // ---- 5. Recomendações ----
  report.push(section('5. Recomendações', []));
  if (deltaCarga > 0) {
    report.push(
      `1. **Revisar precificação:** A transição para Lucro Presumido elevou a carga tributária em ~${formatBrl(deltaCarga)} p.p. As tabelas de preço devem refletir esse aumento.`
    );
    report.push(
      `2. **Monitorar margem:** A margem líquida caiu de ~${formatBrl(avgMargemSimples)}% para ~${formatBrl(avgMargemLP)}%. Verificar se o markup atual cobre o novo custo fiscal.`
    );
    report.push(
      `3. **Alíquota efetiva:** Avaliar se a alíquota de ICMS está otimizada para o perfil de rotas (km por UF).`
    );
    report.push(
      `4. **DRE por OS:** Use a DRE Comparativa por OS para identificar quais operações ficaram inviáveis após a mudança de regime.\n`
    );
  } else {
    report.push(
      '1. **Verificar dados:** Com mais meses de Lucro Presumido, o relatório mostrará o impacto real da transição.'
    );
    report.push(
      '2. **Acompanhar COTs:** Monitore se COTs antigas (Simples) ainda em aberto não geram distorção quando fecharem com OS no novo regime.\n'
    );
  }

  return report.join('\n');
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log('🔌 Conectando ao Supabase...');
  const data = await fetchRegimeData();
  console.log(`📊 ${data.length} registros encontrados.\n`);

  const reportContent = buildReport(data);
  writeFileSync('regime-comparison-report.md', reportContent);

  console.log(reportContent);
  console.log('\n📄 Relatório salvo em regime-comparison-report.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
