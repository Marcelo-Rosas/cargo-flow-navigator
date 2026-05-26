/**
 * Renderiza PDF a partir de JSON (quote + company + version).
 *   deno run -A --config supabase/functions/generate-contract-pdf/deno.json scripts/render-contract-from-payload.ts <payload.json> [out.pdf]
 */
/// <reference path="./deno-cli.d.ts" />
import { renderContractPdf } from '../supabase/functions/generate-contract-pdf/contract-renderer.ts';

const payloadPath = Deno.args[0];
if (!payloadPath) {
  console.error('Uso: deno run ... render-contract-from-payload.ts <payload.json> [out.pdf]');
  Deno.exit(1);
}

const raw = await Deno.readTextFile(payloadPath);
const payload = JSON.parse(raw) as {
  quote: Record<string, unknown>;
  company: Record<string, unknown>;
  version: number;
};

const bytes = await renderContractPdf(payload);
const defaultOut = payload.quote?.quote_code
  ? `tests/smoke/contract/${String(payload.quote.quote_code).replace(/[^\w-]/g, '_')}-contrato-v${payload.version}.pdf`
  : 'tests/smoke/contract/contract-rendered.pdf';
const outPath = Deno.args[1] ?? defaultOut;
const outUrl = outPath.startsWith('file:')
  ? new URL(outPath)
  : new URL(outPath, `file://${Deno.cwd().replace(/\\/g, '/')}/`);

await Deno.mkdir(new URL('./', outUrl), { recursive: true });
await Deno.writeFile(outUrl, bytes);
console.log(`[render] OK — ${bytes.byteLength} bytes → ${outUrl.href}`);
