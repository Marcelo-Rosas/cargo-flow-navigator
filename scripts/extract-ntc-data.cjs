/**
 * Script to extract NTC data from Excel files and generate SQL + CSV.
 * Usage: node scripts/extract-ntc-data.cjs
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'ntc');
const OUT_DIR = path.join(__dirname, '..', 'data');

/** Resolve cell value — handles ExcelJS formula objects */
function cellVal(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    // Formula cell: { formula, result }
    if ('result' in v) return v.result;
    if ('sharedFormula' in v) return v.result ?? null;
    // Rich text
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    // Hyperlink
    if ('text' in v) return v.text;
    return null;
  }
  return v;
}

function numVal(cell) {
  const v = cellVal(cell);
  if (v === null || v === undefined || v === '-' || v === '' || v === 0) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Month parser ─────────────────────────────────────────────────────────
const MONTH_MAP = {
  JANEIRO: '01',
  FEVEREIRO: '02',
  MARÇO: '03',
  MARCO: '03',
  ABRIL: '04',
  MAIO: '05',
  JUNHO: '06',
  JULHO: '07',
  AGOSTO: '08',
  SETEMBRO: '09',
  OUTUBRO: '10',
  NOVEMBRO: '11',
  DEZEMBRO: '12',
};

function parsePeriod(periodStr) {
  if (!periodStr || typeof periodStr !== 'string') return null;
  // Format: "JANEIRO|26" or "JUNHO|94"
  const match = periodStr.trim().match(/^([A-ZÇ]+)\|(\d{2})$/);
  if (!match) return null;
  const month = MONTH_MAP[match[1]];
  if (!month) return null;
  let year = parseInt(match[2]);
  // 94-99 → 1994-1999, 00-30 → 2000-2030
  year = year >= 90 ? 1900 + year : 2000 + year;
  return `${year}-${month}-01`;
}

// ── ANTT Floor Rates ─────────────────────────────────────────────────────

const CARGO_TYPE_MAP = {
  'Granel sólido': 'granel_solido',
  'Granel Sólido': 'granel_solido',
  'Granel líquido': 'granel_liquido',
  'Granel Líquido': 'granel_liquido',
  'Frigorificada ou Aquecida': 'frigorificada',
  Frigorificada: 'frigorificada',
  Conteinerizada: 'conteinerizada',
  'Carga Geral': 'carga_geral',
  Neogranel: 'neogranel',
  'Perigosa (Granel Sólido)': 'perigosa_granel_solido',
  'Perigosa (Granel sólido)': 'perigosa_granel_solido',
  'Perigosa (granel sólido)': 'perigosa_granel_solido',
  'Perigosa (Granel Líquido)': 'perigosa_granel_liquido',
  'Perigosa (Granel líquido)': 'perigosa_granel_liquido',
  'Perigosa (granel líquido)': 'perigosa_granel_liquido',
  'Perigosa (Frigorificada)': 'perigosa_frigorificada',
  'Perigosa (frigorificada ou aquecida)': 'perigosa_frigorificada',
  'Perigosa (Conteinerizada)': 'perigosa_conteinerizada',
  'Perigosa (conteinerizada)': 'perigosa_conteinerizada',
  'Perigosa (Carga Geral)': 'perigosa_carga_geral',
  'Perigosa (carga geral)': 'perigosa_carga_geral',
  'Perigosa (Neogranel)': 'perigosa_neogranel',
  Pressurizada: 'pressurizada',
  'Carga Granel Pressurizada': 'pressurizada',
};

async function extractAnttFloorRates() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(DATA_DIR, 'Calc_Piso_Minimo_TRC-4.xlsx'));

  const allRows = [];
  const tables = ['Tabela A', 'Tabela B', 'Tabela C', 'Tabela D'];
  const tableLetters = { 'Tabela A': 'A', 'Tabela B': 'B', 'Tabela C': 'C', 'Tabela D': 'D' };

  // Structure (same for all tables):
  //   Row 3: col 2="Tipo de carga", cols 3-9 = axes (2,3,4,5,6,7,9) for CCD, cols 11-17 = same axes for CC
  //   Row 4+: data rows

  const AXES_CCD_COLS = { 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 9 };

  for (const tableName of tables) {
    const ws = wb.getWorksheet(tableName);
    if (!ws) continue;
    const opTable = tableLetters[tableName];

    // Data starts at row 4 (row 3 = axes header)
    for (let r = 4; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cargoTypeRaw = String(cellVal(row.getCell(2)) || '').trim();
      if (!cargoTypeRaw) continue;

      const cargoType = CARGO_TYPE_MAP[cargoTypeRaw];
      if (!cargoType) {
        console.warn(`  Unknown cargo type: "${cargoTypeRaw}" in ${tableName} row ${r}`);
        continue;
      }

      for (const [ccdColStr, axes] of Object.entries(AXES_CCD_COLS)) {
        const ccdCol = parseInt(ccdColStr);
        const ccCol = ccdCol + 8; // CC cols are 8 positions after CCD cols

        const ccd = numVal(row.getCell(ccdCol));
        const cc = numVal(row.getCell(ccCol));

        if (ccd === null && cc === null) continue; // "-" means not applicable

        allRows.push({
          operation_table: opTable,
          cargo_type: cargoType,
          axes_count: axes,
          ccd: ccd || 0,
          cc: cc || 0,
        });
      }
    }
  }

  // Write CSV
  const csvLines = ['operation_table,cargo_type,axes_count,ccd,cc,valid_from,valid_until'];
  for (const r of allRows) {
    csvLines.push(`${r.operation_table},${r.cargo_type},${r.axes_count},${r.ccd},${r.cc},,`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'antt_floor_rates_all.csv'), csvLines.join('\n') + '\n');
  console.log(`ANTT Floor Rates: ${allRows.length} rows written to data/antt_floor_rates_all.csv`);

  // Write SQL INSERT
  const sqlLines = [
    '-- ANTT Floor Rates — All Tables (A/B/C/D) × All Cargo Types',
    '-- Source: Calc_Piso_Minimo_TRC-4.xlsx (Resolução ANTT nº 6.076/2026)',
    '-- Generated by scripts/extract-ntc-data.cjs',
    '',
    'DELETE FROM public.antt_floor_rates;',
    '',
    'INSERT INTO public.antt_floor_rates (operation_table, cargo_type, axes_count, ccd, cc) VALUES',
  ];
  const valueLines = allRows.map(
    (r) => `  ('${r.operation_table}', '${r.cargo_type}', ${r.axes_count}, ${r.ccd}, ${r.cc})`
  );
  sqlLines.push(valueLines.join(',\n') + ';');
  fs.writeFileSync(path.join(OUT_DIR, 'antt_floor_rates_all.sql'), sqlLines.join('\n') + '\n');
  console.log(`  SQL written to data/antt_floor_rates_all.sql`);

  return allRows;
}

// ── INCTL Index ──────────────────────────────────────────────────────────

async function extractINCTL() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(DATA_DIR, 'INCTL_0126.xlsx'));

  // Sheet "INCTL": col 2=period, cols 3-7=R$/Ton by distance (50, 400, 800, 2400, 6000 km)
  const ws = wb.getWorksheet('INCTL');
  if (!ws) {
    console.error('INCTL sheet not found');
    return [];
  }

  const distances = [50, 400, 800, 2400, 6000];
  const allRows = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const periodStr = String(cellVal(row.getCell(2)) || '').trim();
    const period = parsePeriod(periodStr);
    if (!period) continue;

    for (let i = 0; i < distances.length; i++) {
      const val = numVal(row.getCell(3 + i));
      if (val === null || val === 0) continue;
      allRows.push({
        index_type: 'INCTL',
        period,
        distance_km: distances[i],
        pickup_km: null,
        index_value: Math.round(val * 10000) / 10000,
      });
    }
  }

  // Also extract Série Histórica for index numbers
  const wsSH = wb.getWorksheet('Série Histórica');
  const shRows = [];
  if (wsSH) {
    // Row 4-5 = headers, data from row 6
    // Cols: 2=Period, 3-7 = index by distance (50, 400, 800, 2400, 6000)
    for (let r = 6; r <= wsSH.rowCount; r++) {
      const row = wsSH.getRow(r);
      const periodStr = String(cellVal(row.getCell(2)) || '').trim();
      const period = parsePeriod(periodStr);
      if (!period) continue;

      for (let i = 0; i < distances.length; i++) {
        const val = numVal(row.getCell(3 + i));
        if (val === null) continue;
        shRows.push({
          index_type: 'INCTL_INDEX',
          period,
          distance_km: distances[i],
          pickup_km: null,
          index_value: Math.round(val * 10000) / 10000,
        });
      }
    }
  }

  // Also extract Resumo for current summary
  const wsRes = wb.getWorksheet('Resumo');
  const resumoRows = [];
  if (wsRes) {
    // Row 5 = header, Rows 6-10 = 5 distance bands
    for (let r = 6; r <= 10; r++) {
      const row = wsRes.getRow(r);
      const distKm = numVal(row.getCell(3));
      const indexVal = numVal(row.getCell(4));
      const var60m = numVal(row.getCell(5));
      const var48m = numVal(row.getCell(6));
      const var36m = numVal(row.getCell(7));
      const var24m = numVal(row.getCell(8));
      const var12m = numVal(row.getCell(9));
      const varAnual = numVal(row.getCell(10));
      const varMensal = numVal(row.getCell(11));

      resumoRows.push({
        distance_km: distKm,
        index_value: indexVal,
        var_60m: var60m,
        var_48m: var48m,
        var_36m: var36m,
        var_24m: var24m,
        var_12m: var12m,
        var_anual: varAnual,
        var_mensal: varMensal,
      });
    }
    console.log('\nINCTL Resumo (Jan/2026):');
    console.table(resumoRows);
  }

  console.log(`INCTL: ${allRows.length} R$/Ton rows + ${shRows.length} index rows extracted`);

  // Write CSV for main R$/Ton series
  const csvLines = ['index_type,period,distance_km,pickup_km,index_value'];
  for (const r of allRows) {
    csvLines.push(
      `${r.index_type},${r.period},${r.distance_km},${r.pickup_km ?? ''},${r.index_value}`
    );
  }
  for (const r of shRows) {
    csvLines.push(
      `${r.index_type},${r.period},${r.distance_km},${r.pickup_km ?? ''},${r.index_value}`
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, 'ntc_inctl_series.csv'), csvLines.join('\n') + '\n');
  console.log(`  CSV written to data/ntc_inctl_series.csv`);

  return { rsTon: allRows, index: shRows, resumo: resumoRows };
}

// ── INCTF Index ──────────────────────────────────────────────────────────

async function extractINCTF() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(DATA_DIR, 'INCTF_0126.xlsx'));

  // Sheet "INCTFR": col 2=period, col 3=general index (all distances)
  const ws = wb.getWorksheet('INCTFR');
  if (!ws) {
    console.error('INCTFR sheet not found');
    return [];
  }

  const generalRows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const periodStr = String(cellVal(row.getCell(2)) || '').trim();
    const period = parsePeriod(periodStr);
    if (!period) continue;

    const val = numVal(row.getCell(3));
    if (val === null) continue;

    generalRows.push({
      index_type: 'INCTF',
      period,
      distance_km: null,
      pickup_km: null,
      index_value: Math.round(val * 10000) / 10000,
    });
  }

  // Sheet "Série Histórica": 15 columns (5 dist × 3 pickup)
  // Row 4: headers: Mês, 50x10 km, 50x40 km, 50x90 km, 400x10 km, ... 6000x90 km
  const wsSH = wb.getWorksheet('Série Histórica');
  const detailRows = [];
  if (wsSH) {
    const colMap = [
      // col → {distance, pickup}
      { col: 3, dist: 50, pickup: 10 },
      { col: 4, dist: 50, pickup: 40 },
      { col: 5, dist: 50, pickup: 90 },
      { col: 6, dist: 400, pickup: 10 },
      { col: 7, dist: 400, pickup: 40 },
      { col: 8, dist: 400, pickup: 90 },
      { col: 9, dist: 800, pickup: 10 },
      { col: 10, dist: 800, pickup: 40 },
      { col: 11, dist: 800, pickup: 90 },
      { col: 12, dist: 2400, pickup: 10 },
      { col: 13, dist: 2400, pickup: 40 },
      { col: 14, dist: 2400, pickup: 90 },
      { col: 15, dist: 6000, pickup: 10 },
      { col: 16, dist: 6000, pickup: 40 },
      { col: 17, dist: 6000, pickup: 90 },
    ];

    for (let r = 5; r <= wsSH.rowCount; r++) {
      const row = wsSH.getRow(r);
      const periodStr = String(cellVal(row.getCell(2)) || '').trim();
      const period = parsePeriod(periodStr);
      if (!period) continue;

      for (const { col, dist, pickup } of colMap) {
        const val = numVal(row.getCell(col));
        if (val === null) continue;
        detailRows.push({
          index_type: 'INCTF_DETAIL',
          period,
          distance_km: dist,
          pickup_km: pickup,
          index_value: Math.round(val * 10000) / 10000,
        });
      }
    }
  }

  // Resumo
  const wsRes = wb.getWorksheet('Resumo');
  const resumoRows = [];
  if (wsRes) {
    // Row 5 = header, Rows 6-20 = 15 scenarios (5 dist × 3 pickup within each)
    // Actually structure: rows 6-10 have 5 distance bands
    for (let r = 6; r <= 10; r++) {
      const row = wsRes.getRow(r);
      const distKm = numVal(row.getCell(3));
      const indexVal = numVal(row.getCell(4));
      const varSince94 = numVal(row.getCell(5));
      const var36m = numVal(row.getCell(6));
      const var24m = numVal(row.getCell(7));
      const var12m = numVal(row.getCell(8));
      const varAnual = numVal(row.getCell(9));
      const varMensal = numVal(row.getCell(10));

      resumoRows.push({
        distance_km: distKm,
        index_value: indexVal,
        var_since_94: varSince94,
        var_36m: var36m,
        var_24m: var24m,
        var_12m: var12m,
        var_anual: varAnual,
        var_mensal: varMensal,
      });
    }
    console.log('\nINCTF Resumo (Jan/2026):');
    console.table(resumoRows);
  }

  console.log(`INCTF: ${generalRows.length} general + ${detailRows.length} detail rows extracted`);

  // Write CSV
  const csvLines = ['index_type,period,distance_km,pickup_km,index_value'];
  for (const r of generalRows) {
    csvLines.push(
      `${r.index_type},${r.period},${r.distance_km ?? ''},${r.pickup_km ?? ''},${r.index_value}`
    );
  }
  for (const r of detailRows) {
    csvLines.push(`${r.index_type},${r.period},${r.distance_km},${r.pickup_km},${r.index_value}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'ntc_inctf_series.csv'), csvLines.join('\n') + '\n');
  console.log(`  CSV written to data/ntc_inctf_series.csv`);

  return { general: generalRows, detail: detailRows, resumo: resumoRows };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== NTC Data Extraction ===\n');

  const anttRates = await extractAnttFloorRates();

  const inctl = await extractINCTL();

  const inctf = await extractINCTF();

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`ANTT Floor Rates: ${anttRates.length} rows`);
  console.log(`INCTL R$/Ton: ${inctl.rsTon?.length ?? 0} rows`);
  console.log(`INCTL Index: ${inctl.index?.length ?? 0} rows`);
  console.log(`INCTF General: ${inctf.general?.length ?? 0} rows`);
  console.log(`INCTF Detail: ${inctf.detail?.length ?? 0} rows`);
}

main().catch(console.error);
