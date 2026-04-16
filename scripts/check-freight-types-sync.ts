/**
 * check-freight-types-sync.ts
 *
 * Verifica que src/types/freight.ts está em sincronia com
 * supabase/functions/_shared/freight-types.ts.
 *
 * Regra: todo campo presente na Edge deve existir no cliente.
 * Campos extras no cliente (específicos de UI) são permitidos.
 *
 * Uso: npx tsx scripts/check-freight-types-sync.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Interfaces a comparar (presentes em ambos os arquivos)
const INTERFACES_TO_CHECK = [
  'CalculateFreightInput',
  'FreightMeta',
  'FreightComponents',
  'FreightRates',
  'FreightTotals',
  'FreightProfitability',
  'CalculateFreightResponse',
];

function extractInterfaceFields(content: string, name: string): Set<string> {
  // Captura o bloco da interface (não-aninhado)
  const regex = new RegExp(`interface ${name}[^{]*\\{`, 'g');
  const start = regex.exec(content);
  if (!start) return new Set();

  let depth = 0;
  let i = start.index;
  let bodyStart = -1;

  for (; i < content.length; i++) {
    if (content[i] === '{') {
      depth++;
      if (depth === 1) bodyStart = i + 1;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }

  const body = content.slice(bodyStart, i);
  const fields = new Set<string>();

  // Extrai nomes de campos ignorando comentários e blocos aninhados
  let innerDepth = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    innerDepth += (trimmed.match(/\{/g) || []).length;
    innerDepth -= (trimmed.match(/\}/g) || []).length;
    if (innerDepth > 0) continue; // dentro de tipo aninhado

    const fieldMatch = trimmed.match(/^(\w+)\??:/);
    if (fieldMatch) fields.add(fieldMatch[1]);
  }

  return fields;
}

const edgeContent = readFileSync(
  resolve(ROOT, 'supabase/functions/_shared/freight-types.ts'),
  'utf-8'
);
const clientContent = readFileSync(resolve(ROOT, 'src/types/freight.ts'), 'utf-8');

let hasErrors = false;

console.log('\nVerificando sincronismo de tipos Edge ↔ Cliente...\n');

for (const name of INTERFACES_TO_CHECK) {
  const edgeFields = extractInterfaceFields(edgeContent, name);
  const clientFields = extractInterfaceFields(clientContent, name);

  if (edgeFields.size === 0) {
    console.warn(`⚠️  ${name} — não encontrado no arquivo Edge (verifique o nome)`);
    continue;
  }

  const missingInClient = [...edgeFields].filter((f) => !clientFields.has(f));

  if (missingInClient.length > 0) {
    console.error(`❌ ${name}`);
    console.error(`   Campos presentes na Edge mas ausentes no cliente:`);
    missingInClient.forEach((f) => console.error(`     - ${f}`));
    hasErrors = true;
  } else {
    console.log(`✅ ${name}`);
  }
}

if (hasErrors) {
  console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Divergência detectada!

   Atualize src/types/freight.ts para incluir
   os campos faltantes da Edge Function.

   Source of truth: supabase/functions/_shared/freight-types.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  process.exit(1);
}

console.log('\n✅ Tipos em sincronia.\n');
