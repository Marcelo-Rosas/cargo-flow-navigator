import fs from 'node:fs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node extract-antt-carga-geral.js <input.txt>');
  process.exit(1);
}

const txt = fs.readFileSync(inputPath, 'utf8');

// Extract the row for "Carga Geral" in Table A.
// We expect something like:
// 5 Carga Geral Deslocamento (CCD) R$/km 3,6815 ... 8,5104 ... Carga e descarga (CC) R$ 436,39 ... 872,44
const rowRe = /\bCarga Geral\b[\s\S]*?Deslocamento\s*\(CCD\)\s*R\$\/km\s*([0-9.,\s]+?)\s*Carga\s*e\s*descarga\s*\(CC\)\s*R\$\s*([0-9.,\s]+)/i;
const m = txt.match(rowRe);
if (!m) {
  console.error('Could not find Carga Geral row with CCD/CC values.');
  process.exit(2);
}

function parsePt(n) {
  // '1.030,58' -> 1030.58
  const s = n.trim().replace(/\./g, '').replace(',', '.');
  return Number(s);
}

function extractNums(s) {
  const nums = s
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return nums.map(parsePt).filter((v) => Number.isFinite(v));
}

const ccd = extractNums(m[1]);
const cc = extractNums(m[2]);

const axes = [2, 3, 4, 5, 6, 7, 9];
if (ccd.length < axes.length || cc.length < axes.length) {
  console.error('Not enough numeric values extracted.', { ccdLen: ccd.length, ccLen: cc.length });
  process.exit(3);
}

const rows = axes.map((axes_count, i) => ({
  operation_table: 'A',
  cargo_type: 'carga_geral',
  axes_count,
  ccd: ccd[i],
  cc: cc[i],
  valid_from: null,
  valid_until: null,
}));

console.log(JSON.stringify(rows, null, 2));
