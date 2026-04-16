/**
 * lighthouse-audit.mjs
 * Executa Lighthouse e verifica scores contra thresholds.
 * Uso: node scripts/lighthouse-audit.mjs [url]
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

const url = process.argv[2] || process.env.LIGHTHOUSE_URL || 'http://localhost:3000';

const thresholds = {
  performance: 75,
  accessibility: 90,
  'best-practices': 85,
  seo: 90,
};

const reportPath = './lighthouse-report.json';

console.log(`\nStarting Lighthouse audit...`);
console.log(`Target URL: ${url}\n`);

try {
  execSync(
    `npx lighthouse ${url} --output=json --output-path=${reportPath} --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"`,
    { encoding: 'utf-8', stdio: 'inherit' }
  );
} catch {
  console.error('Lighthouse execution failed');
  process.exit(1);
}

if (!existsSync(reportPath)) {
  console.error('Report file not found after audit');
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
const scores = report.categories;

let allPass = true;

console.log('\n── Resultados ──────────────────────────');
for (const [category, threshold] of Object.entries(thresholds)) {
  const score = Math.round(scores[category].score * 100);
  const pass = score >= threshold;
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${category.padEnd(16)} ${String(score).padStart(3)} (mín ${threshold})`);
  if (!pass) allPass = false;
}
console.log('────────────────────────────────────────\n');

if (!allPass) {
  console.error('Um ou mais scores abaixo do threshold.');
  process.exit(1);
}

console.log('Todos os scores aprovados.\n');
