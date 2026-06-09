/**
 * Aplica Portaria SUROC Nº 4/2026 (20/03/2026) em antt_floor_rates.
 *
 * - Tabela A / carga_geral: coeficientes oficiais (data/antt_suroc_n4_2026_table_a_carga_geral.json)
 * - Tabelas B/C/D e demais cargas: reescala CCD pelo fator da Tabela A 6 eixos (7,4124 / 6,7774)
 *   até importação completa do anexo no repositório.
 *
 * Uso:
 *   npx tsx scripts/apply-antt-suroc-n4-2026.ts
 *   npx tsx scripts/apply-antt-suroc-n4-2026.ts --apply
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';

const VALID_FROM = '2026-03-20';
const VALID_UNTIL_PREV = '2026-03-19';
const OLD_A6_CCD = 6.7774;
const NEW_A6_CCD = 7.4124;
const SCALE = NEW_A6_CCD / OLD_A6_CCD;

interface RateRow {
  operation_table: string;
  cargo_type: string;
  axes_count: number;
  ccd: number;
  cc: number;
  valid_from: string;
  valid_until: string | null;
}

const apply = process.argv.includes('--apply');
const scriptEnv = loadSupabaseScriptEnv();
const sb = createClient(scriptEnv.url, scriptEnv.serviceRoleKey);

const tableA = JSON.parse(
  readFileSync(join(process.cwd(), 'data/antt_suroc_n4_2026_table_a_carga_geral.json'), 'utf8')
) as {
  rates: Array<{ axes_count: number; ccd: number; cc: number }>;
};

function parseCsv(content: string): RateRow[] {
  const lines = content.trim().split('\n').slice(1);
  return lines.map((line) => {
    const [operation_table, cargo_type, axes_count, ccd, cc] = line.split(',');
    return {
      operation_table,
      cargo_type,
      axes_count: Number(axes_count),
      ccd: Number(ccd),
      cc: Number(cc),
      valid_from: VALID_FROM,
      valid_until: null,
    };
  });
}

const seedCsv = readFileSync(join(process.cwd(), 'data/antt_floor_rates_all.csv'), 'utf8');
const seedRows = parseCsv(seedCsv);

const inserts: RateRow[] = [];

for (const r of tableA.rates) {
  inserts.push({
    operation_table: 'A',
    cargo_type: 'carga_geral',
    axes_count: r.axes_count,
    ccd: r.ccd,
    cc: r.cc,
    valid_from: VALID_FROM,
    valid_until: null,
  });
}

for (const row of seedRows) {
  if (row.operation_table === 'A' && row.cargo_type === 'carga_geral') continue;
  inserts.push({
    ...row,
    ccd: Math.round(row.ccd * SCALE * 10000) / 10000,
    valid_from: VALID_FROM,
    valid_until: null,
  });
}

console.log(
  `\nSUROC Nº 4/2026 — ${inserts.length} linhas a inserir (fator B/C/D CCD: ${SCALE.toFixed(6)})`
);
console.log(`Modo: ${apply ? 'APLICANDO' : 'DRY RUN'}\n`);

const sample = inserts.filter(
  (r) => r.cargo_type === 'carga_geral' && [6, 9].includes(r.axes_count)
);
for (const s of sample) {
  console.log(
    `  ${s.operation_table} ${s.axes_count}eixos: CCD ${s.ccd} CC ${s.cc} → piso 2756km = R$ ${(2756 * s.ccd + s.cc).toFixed(2)}`
  );
}

if (!apply) {
  console.log('\nDry run. Use --apply para expirar vigências antigas e inserir novas linhas.\n');
  process.exit(0);
}

const { error: expireError } = await sb
  .from('antt_floor_rates')
  .update({ valid_until: VALID_UNTIL_PREV })
  .is('valid_until', null);

if (expireError) {
  console.error('Erro ao expirar linhas atuais:', expireError.message);
  process.exit(1);
}

const batchSize = 100;
for (let i = 0; i < inserts.length; i += batchSize) {
  const chunk = inserts.slice(i, i + batchSize);
  const { error } = await sb.from('antt_floor_rates').insert(chunk);
  if (error) {
    console.error('Erro ao inserir batch:', error.message);
    process.exit(1);
  }
}

console.log(
  '\nCoeficientes SUROC Nº 4/2026 aplicados. Recalcule cotações em lotação (Salvar memória).\n'
);
