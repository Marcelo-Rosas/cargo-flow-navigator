/**
 * Gera HTML (layout e-mail Vectra) + PDF a partir do mesmo HTML (Playwright).
 *
 *   npx tsx scripts/render-montagem-orcamento-email-pdf.ts
 *   npx tsx scripts/render-montagem-orcamento-email-pdf.ts --json tests/fixtures/montagem-orcamento.json
 *
 * Saídas (slug padrão corpus-quality):
 *   tests/smoke/montagem/orcamento-montagem-{slug}-email.html
 *   tests/smoke/montagem/orcamento-montagem-{slug}-email.pdf
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { CORPUS_QUALITY_ORCAMENTO } from './montagem-orcamento/corpus-quality-data.ts';
import { buildMontagemEmailHtml } from './montagem-orcamento/email-html.ts';
import type { MontagemOrcamento } from './montagem-orcamento/types.ts';

const jsonIdx = process.argv.indexOf('--json');
const jsonPath = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : undefined;

async function main() {
  const data: MontagemOrcamento = jsonPath
    ? (JSON.parse(readFileSync(jsonPath, 'utf8')) as MontagemOrcamento)
    : CORPUS_QUALITY_ORCAMENTO;

  const slug = data.outputSlug ?? 'orcamento';
  const outDir = resolve('tests/smoke/montagem');
  mkdirSync(outDir, { recursive: true });

  const html = buildMontagemEmailHtml(data);
  const htmlPath = resolve(outDir, `orcamento-montagem-${slug}-email.html`);
  const pdfPath = resolve(outDir, `orcamento-montagem-${slug}-email.pdf`);

  writeFileSync(htmlPath, html, 'utf8');
  console.log(`[montagem-email] HTML → ${htmlPath}`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
    console.log(`[montagem-email] PDF  → ${pdfPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[montagem-email]', err);
  process.exit(1);
});
