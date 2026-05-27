#!/usr/bin/env npx tsx
/**
 * Executa queries prontas do Log Explorer (substituto de "saved queries" — a API
 * da Cloudflare não permite salvar queries no dashboard programaticamente).
 *
 * Uso:
 *   npm run cf:log-explorer:queries
 *   CLOUDFLARE_API_TOKEN=... npm run cf:log-explorer:query -- app-5xx
 *   npm run cf:log-explorer:query -- app-5xx --json
 */

import { printTokenHelp, resolveCloudflareLogExplorerToken } from './load-token.mjs';
import { VECTRA_LOG_QUERIES, getQueryPreset } from './queries/vectra.ts';

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const LIST = args.includes('--list') || args.length === 0 || args.includes('--help');
const queryId = args.find((a) => !a.startsWith('--'));

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? DEFAULT_ACCOUNT_ID;
const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim() ?? DEFAULT_ZONE_ID;

const DASHBOARD_BASE = `https://dash.cloudflare.com/${accountId}/analytics/logs/explorer`;

const PLACEHOLDER_TOKENS = new Set([
  'seu-token',
  'your-token',
  'your-cloudflare-api-token',
  '<seu-token>',
]);

function validateToken(token: string | undefined): string {
  if (!token) {
    console.error('CLOUDFLARE_API_TOKEN é obrigatório.');
    console.error(
      'Ex.: $env:CLOUDFLARE_API_TOKEN = "cfut_..."  (token real do dashboard, sem espaços)'
    );
    process.exit(1);
  }
  if (PLACEHOLDER_TOKENS.has(token.toLowerCase()) || token.length < 20) {
    console.error('CLOUDFLARE_API_TOKEN parece inválido ou placeholder ("seu-token").');
    console.error('Use o token real: My Profile → API Tokens → Log Explorer → copiar');
    process.exit(1);
  }
  return token;
}

interface QueryApiResult {
  success: boolean;
  result: unknown;
  errors?: Array<{ code: number; message: string }>;
}

async function runSql(
  scope: 'zone' | 'account',
  sql: string,
  token: string
): Promise<QueryApiResult> {
  const path =
    scope === 'zone'
      ? `/zones/${zoneId}/logs/explorer/query/sql`
      : `/accounts/${accountId}/logs/explorer/query/sql`;

  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: sql,
  });

  const raw = await res.text();
  try {
    return JSON.parse(raw) as QueryApiResult;
  } catch {
    throw new Error(`${res.status}: ${raw.slice(0, 300)}`);
  }
}

function assertQuerySuccess(payload: QueryApiResult): void {
  if (payload.success) return;
  const err = payload.errors?.[0];
  if (err?.code === 9106) {
    throw new Error(
      '9106: token inválido. Cole o token real (cfut_...) sem espaço após a aspas. Não use "seu-token".'
    );
  }
  throw new Error(err ? `${err.code}: ${err.message}` : 'Query falhou');
}

function printHelp(): void {
  console.log(`
Queries prontas Vectra (Log Explorer)

  npm run cf:log-explorer:queries              Lista presets
  npm run cf:log-explorer:query -- <id>        Executa query
  npm run cf:log-explorer:query -- <id> --json Saída JSON

Dashboard (colar SQL manualmente se preferir UI):
  ${DASHBOARD_BASE}

Presets:
`);
  console.table(
    VECTRA_LOG_QUERIES.map((q) => ({
      id: q.id,
      scope: q.scope,
      title: q.title,
    }))
  );
}

async function main(): Promise<void> {
  if (args.includes('--help') || LIST) {
    printHelp();
    process.exit(0);
  }

  const preset = getQueryPreset(queryId ?? '');
  if (!preset) {
    console.error(`Query desconhecida: ${queryId}`);
    printHelp();
    process.exit(1);
  }

  const token =
    process.env.CLOUDFLARE_API_TOKEN?.trim() || (await resolveCloudflareLogExplorerToken());
  if (!token) {
    printTokenHelp();
    process.exit(1);
  }

  const result = await runSql(preset.scope, preset.sql, token);
  assertQuerySuccess(result);

  if (JSON_OUT) {
    console.log(
      JSON.stringify({ id: preset.id, title: preset.title, rows: result.result }, null, 2)
    );
  } else {
    console.log(`\n# ${preset.title}\n${preset.description}\n`);
    console.log('SQL:\n', preset.sql, '\n');
    const rows = result.result;
    if (Array.isArray(rows) && rows.length === 0) {
      console.log('Resultado: nenhuma linha no período (normal se não houve tráfego/eventos).');
    } else {
      console.log('Resultado:\n');
      console.table(rows);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
