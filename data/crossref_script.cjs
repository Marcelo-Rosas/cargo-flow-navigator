/**
 * Cross-reference script: Extract vehicle-owner links from Excel
 * Source: cadastro_motorista_active.xlsx
 * Outputs:
 *   - owners_from_excel.csv (new owners not in DB)
 *   - vehicles_owner_link.sql (UPDATE statements to set owner_id)
 *   - vehicles_type_link.sql (UPDATE statements to set vehicle_type_id)
 */

const XLSX = require('C:/Users/marce/AppData/Local/Temp/xlsx_reader/node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const EXCEL_PATH = 'C:/Users/marce/.openclaw/workspace/docs/cadastro de motorista/cadastro_motorista_active.xlsx';

// --- 1. Read Excel ---
const wb = XLSX.readFile(EXCEL_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log(`Excel: ${rows.length} rows`);
console.log('Columns:', Object.keys(rows[0]).join(', '));

// Find the right column names (they might be in Portuguese)
const sampleRow = rows[0];
const colNames = Object.keys(sampleRow);
console.log('Sample row:', JSON.stringify(sampleRow, null, 2));

// Identify column mappings
const plateCol = colNames.find(c => c.toLowerCase().includes('placa')) || 'Placa';
const ownerCol = colNames.find(c => c.toLowerCase().includes('propriet') && !c.toLowerCase().includes('ant')) || 'Proprietário';
const typeCol = colNames.find(c => c === 'Tipo' || c.toLowerCase() === 'tipo');
const anttCol = colNames.find(c => c.toLowerCase().includes('antt')) || 'ANTT';

console.log(`\nColumn mappings: plate="${plateCol}", owner="${ownerCol}", type="${typeCol}", antt="${anttCol}"`);

// --- 2. Read existing owners from owners_rows.csv ---
const ownersCSV = fs.readFileSync(path.join(DATA_DIR, 'owners_rows.csv'), 'utf8');
const ownerLines = ownersCSV.split('\n').filter(l => l.trim());
const ownerHeader = ownerLines[0].split(',');
const nameIdx = ownerHeader.indexOf('name');
const existingOwnerNames = new Set();
for (let i = 1; i < ownerLines.length; i++) {
  // CSV parsing: handle quoted fields
  const parts = parseCSVLine(ownerLines[i]);
  if (parts[nameIdx]) {
    existingOwnerNames.add(parts[nameIdx].trim().toUpperCase());
  }
}
console.log(`\nExisting owners in DB: ${existingOwnerNames.size}`);

// --- 3. Extract unique vehicle-owner mappings ---
const vehicleOwnerMap = []; // { plate, ownerName }
const allOwnerNames = new Set();
const newOwnerNames = new Set();

for (const row of rows) {
  const plate = String(row[plateCol] || '').trim().toUpperCase().replace(/[-\s]/g, '');
  const ownerName = String(row[ownerCol] || '').trim();

  if (!plate || plate.length < 7 || !ownerName) continue;

  vehicleOwnerMap.push({ plate, ownerName });
  allOwnerNames.add(ownerName.toUpperCase());

  if (!existingOwnerNames.has(ownerName.toUpperCase())) {
    newOwnerNames.add(ownerName);
  }
}

console.log(`\nVehicles with owner: ${vehicleOwnerMap.length}`);
console.log(`Distinct owner names in Excel: ${allOwnerNames.size}`);
console.log(`Owners already in DB: ${allOwnerNames.size - newOwnerNames.size}`);
console.log(`NEW owners to import: ${newOwnerNames.size}`);

// --- 4. Generate owners_from_excel.csv ---
const newOwnersArr = Array.from(newOwnerNames).sort();
let ownersCsvContent = 'name,active\n';
for (const name of newOwnersArr) {
  ownersCsvContent += `"${name.replace(/"/g, '""')}",true\n`;
}
fs.writeFileSync(path.join(DATA_DIR, 'owners_from_excel.csv'), ownersCsvContent);
console.log(`\nWrote owners_from_excel.csv: ${newOwnersArr.length} new owners`);

// --- 5. Generate vehicles_owner_link.sql ---
let ownerLinkSQL = '-- Auto-generated: Link vehicles to owners by name\n';
ownerLinkSQL += '-- Run in Supabase SQL Editor AFTER importing owners_from_excel.csv\n\n';

for (const { plate, ownerName } of vehicleOwnerMap) {
  const escapedName = ownerName.replace(/'/g, "''");
  ownerLinkSQL += `UPDATE vehicles SET owner_id = (SELECT id FROM owners WHERE UPPER(name) = UPPER('${escapedName}') LIMIT 1) WHERE UPPER(plate) = '${plate}';\n`;
}
fs.writeFileSync(path.join(DATA_DIR, 'vehicles_owner_link.sql'), ownerLinkSQL);
console.log(`Wrote vehicles_owner_link.sql: ${vehicleOwnerMap.length} UPDATE statements`);

// --- 6. Extract vehicle types and generate vehicles_type_link.sql ---
const vehicleTypeMap = []; // { plate, typeName }
const distinctTypes = new Set();

for (const row of rows) {
  const plate = String(row[plateCol] || '').trim().toUpperCase().replace(/[-\s]/g, '');
  const typeName = String(row[typeCol] || '').trim();

  if (!plate || plate.length < 7 || !typeName) continue;

  vehicleTypeMap.push({ plate, typeName });
  distinctTypes.add(typeName);
}

console.log(`\nDistinct vehicle types in Excel: ${distinctTypes.size}`);
console.log('Types:', Array.from(distinctTypes).sort().join(', '));

let typeLinkSQL = '-- Auto-generated: Link vehicles to vehicle_types by name\n';
typeLinkSQL += '-- Run in Supabase SQL Editor\n';
typeLinkSQL += '-- NOTE: vehicle_types must already have matching records (by name)\n\n';

for (const { plate, typeName } of vehicleTypeMap) {
  const escapedType = typeName.replace(/'/g, "''");
  typeLinkSQL += `UPDATE vehicles SET vehicle_type_id = (SELECT id FROM vehicle_types WHERE UPPER(name) = UPPER('${escapedType}') LIMIT 1) WHERE UPPER(plate) = '${plate}';\n`;
}
fs.writeFileSync(path.join(DATA_DIR, 'vehicles_type_link.sql'), typeLinkSQL);
console.log(`Wrote vehicles_type_link.sql: ${vehicleTypeMap.length} UPDATE statements`);

// --- 7. Summary ---
console.log('\n=== SUMMARY ===');
console.log(`1. Import owners_from_excel.csv (${newOwnersArr.length} new owners) → Supabase Table Editor → owners`);
console.log(`2. Run vehicles_owner_link.sql (${vehicleOwnerMap.length} UPDATEs) → Supabase SQL Editor`);
console.log(`3. Run vehicles_type_link.sql (${vehicleTypeMap.length} UPDATEs) → Supabase SQL Editor`);

// --- Helper: simple CSV line parser ---
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
