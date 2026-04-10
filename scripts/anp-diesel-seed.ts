/**
 * Script: ANP Diesel Historical Seed
 * Reads ANP weekly Excel (semanal-estados-desde-2013.xlsx) and generates
 * SQL INSERT for petrobras_diesel_prices table.
 *
 * Usage: npx tsx scripts/anp-diesel-seed.ts [--from 2025-01-01] [--to 2026-03-31] [--apply]
 *   --from   Start date (default: 2025-01-01)
 *   --to     End date   (default: 2026-03-31)
 *   --apply  Apply directly to Supabase instead of printing SQL
 */

import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const EXCEL_PATH = path.join(
  'C:/Users/marce/Diesel_Serie_Historica/semanal-estados-desde-2013.xlsx'
);

const PRODUTO_TARGET = 'OLEO DIESEL S10'; // ANP name for Diesel S-10

const ESTADO_TO_UF: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  GOIAS: 'GO',
  MARANHAO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARA: 'PA',
  PARAIBA: 'PB',
  PARANA: 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDONIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

// Excel serial → JS Date
function excelDateToISO(serial: number): string {
  const date = XLSX.SSF.parse_date_code(serial);
  const y = date.y;
  const m = String(date.m).padStart(2, '0');
  const d = String(date.d).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeEstado(raw: string): string {
  return raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const fromArg = args.find((a) => a.startsWith('--from='))?.split('=')[1] ?? '2025-01-01';
const toArg = args.find((a) => a.startsWith('--to='))?.split('=')[1] ?? '2026-03-31';
const applyMode = args.includes('--apply');

const fromDate = new Date(fromArg);
const toDate = new Date(toArg);

console.log(`📂 Reading: ${EXCEL_PATH}`);
console.log(`📅 Period:  ${fromArg} → ${toArg}`);
console.log(`⛽ Product: ${PRODUTO_TARGET}`);
console.log('');

const wb = XLSX.readFile(EXCEL_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref']!);

// Header is on row 17 (0-indexed)
// Columns: 0=DATA INICIAL, 1=DATA FINAL, 2=REGIÃO, 3=ESTADO, 4=PRODUTO,
//          5=Nº POSTOS, 6=UNIDADE, 7=PREÇO MÉDIO REVENDA, ...

interface Row {
  uf: string;
  periodo_coleta: string; // ISO date of DATA INICIAL (week start)
  preco_medio: number;
}

const rows: Row[] = [];
const skipped: string[] = [];

for (let r = 18; r <= range.e.r; r++) {
  const getCell = (c: number) => ws[XLSX.utils.encode_cell({ r, c })];

  const dataInicialCell = getCell(0);
  const estadoCell = getCell(3);
  const produtoCell = getCell(4);
  const precoCell = getCell(7);

  if (!dataInicialCell || !estadoCell || !produtoCell || !precoCell) continue;

  const produto = String(produtoCell.v).trim().toUpperCase();
  if (produto !== PRODUTO_TARGET) continue;

  // Parse date
  let periodoColeta: string;
  if (typeof dataInicialCell.v === 'number') {
    periodoColeta = excelDateToISO(dataInicialCell.v);
  } else {
    // Sometimes stored as string "dd/mm/yyyy"
    const parts = String(dataInicialCell.v).split('/');
    if (parts.length === 3) {
      periodoColeta = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else {
      periodoColeta = String(dataInicialCell.v).split(' ')[0];
    }
  }

  const rowDate = new Date(periodoColeta);
  if (rowDate < fromDate || rowDate > toDate) continue;

  const estadoRaw = normalizeEstado(String(estadoCell.v));
  const uf = ESTADO_TO_UF[estadoRaw];
  if (!uf) {
    if (!skipped.includes(estadoRaw)) skipped.push(estadoRaw);
    continue;
  }

  const preco = parseFloat(String(precoCell.v));
  if (isNaN(preco) || preco <= 0) continue;

  rows.push({ uf, periodo_coleta: periodoColeta, preco_medio: preco });
}

console.log(`✅ Rows extracted: ${rows.length}`);
if (skipped.length) console.log(`⚠️  Unmapped states: ${skipped.join(', ')}`);
console.log('');

// ─── Summary ──────────────────────────────────────────────────────────────────

const ufs = [...new Set(rows.map((r) => r.uf))].sort();
const weeks = [...new Set(rows.map((r) => r.periodo_coleta))].sort();
console.log(`📊 UFs: ${ufs.length} (${ufs.join(', ')})`);
console.log(`📆 Weeks: ${weeks.length} (${weeks[0]} → ${weeks[weeks.length - 1]})`);
console.log('');

// ─── Output ───────────────────────────────────────────────────────────────────

if (applyMode) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
    process.exit(1);
  }
  // createClient without type params returns SupabaseClient<any> — no cast needed
  const supabase = createClient(supabaseUrl, serviceKey);
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({
      uf: r.uf.toUpperCase(),
      preco_medio: r.preco_medio,
      periodo_coleta: r.periodo_coleta,
      fetched_at: r.periodo_coleta + 'T00:00:00Z',
      source: 'anp',
    }));
    const { error } = await supabase
      .from('petrobras_diesel_prices')
      .upsert(chunk, { onConflict: 'uf,periodo_coleta', ignoreDuplicates: true });
    if (error) {
      console.error('❌ Upsert error:', error.message);
      process.exit(1);
    }
    inserted += chunk.length;
    process.stdout.write(`\r  Inserting... ${inserted}/${rows.length}`);
  }
  console.log(`\n✅ Done — ${inserted} records upserted.`);
} else {
  // Print SQL
  const sqlPath = path.join('scripts', 'anp-diesel-seed.sql');
  const lines: string[] = [
    '-- ANP Diesel S-10 Historical Prices',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Period: ${fromArg} → ${toArg}`,
    `-- Rows: ${rows.length}`,
    '',
    'INSERT INTO petrobras_diesel_prices',
    '  (uf, preco_medio, periodo_coleta, fetched_at)',
    'VALUES',
  ];

  rows.forEach((r, i) => {
    const comma = i < rows.length - 1 ? ',' : '';
    lines.push(
      `  ('${r.uf}', ${r.preco_medio.toFixed(3)}, '${r.periodo_coleta}', '${r.periodo_coleta}T00:00:00Z')${comma}`
    );
  });

  lines.push('ON CONFLICT (uf, periodo_coleta) DO NOTHING;');

  fs.writeFileSync(sqlPath, lines.join('\n'), 'utf8');
  console.log(`📄 SQL written to: ${sqlPath}`);
  console.log(`   ${rows.length} INSERT rows`);
}
