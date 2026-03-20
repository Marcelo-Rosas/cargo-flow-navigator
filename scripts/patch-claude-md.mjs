/**
 * Grava CLAUDE.md na raiz em UTF-8 a partir de cursor-setup-package/CLAUDE.md
 * (remove a secao "## Pacote cursor-setup" e tudo abaixo).
 * Evita depender de origin/main com encoding quebrado e de regravar via editor errado.
 * Uso: node scripts/patch-claude-md.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'cursor-setup-package', 'CLAUDE.md');

let s = readFileSync(pkgPath, 'utf8');
const marker = '\n## Pacote cursor-setup';
const i = s.indexOf(marker);
if (i !== -1) {
  s = s.slice(0, i).trimEnd() + '\n';
}

writeFileSync(join(root, 'CLAUDE.md'), s, 'utf8');
console.log('CLAUDE.md written from cursor-setup-package/CLAUDE.md, UTF-8, length', s.length);
