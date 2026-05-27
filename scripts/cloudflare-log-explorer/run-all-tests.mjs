/**
 * Roda list + todas as queries preset.
 * Token: .env.local, .cloudflare-api-token.local, CLOUDFLARE_API_TOKEN ou histórico terminals.
 */
import { execSync } from 'node:child_process';
import { printTokenHelp, resolveCloudflareLogExplorerToken } from './load-token.mjs';

const PRESETS = [
  'app-5xx',
  'app-waf-blocks',
  'app-traffic-summary',
  'app-slow-paths',
  'firewall-events',
  'audit-recent',
];

function run(cmd, env) {
  try {
    const out = execSync(cmd, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: e.stdout?.toString() ?? '', err: e.stderr?.toString() ?? e.message };
  }
}

const token = await resolveCloudflareLogExplorerToken();

if (!token) {
  printTokenHelp();
  process.exit(2);
}

console.log('Token: válido + permissão Log Explorer\n');

const env = { ...process.env, CLOUDFLARE_API_TOKEN: token };
const results = [];

console.log('=== --list ===');
const list = run('npx tsx scripts/cloudflare-log-explorer/provision-log-explorer.ts --list', env);
console.log(list.ok ? list.out : list.err);
results.push({ test: 'list', ok: list.ok });

for (const id of PRESETS) {
  console.log(`\n=== query: ${id} ===`);
  const q = run(`npx tsx scripts/cloudflare-log-explorer/run-query.ts ${id} --json`, env);
  if (!q.ok) {
    console.log('FAIL:', q.err || q.out);
    results.push({ test: id, ok: false, error: (q.err || q.out).slice(0, 120) });
    continue;
  }
  try {
    const parsed = JSON.parse(q.out);
    const rows = parsed.rows;
    const count = Array.isArray(rows) ? rows.length : 0;
    console.log(`OK — ${count} linha(s)`);
    if (count > 0) console.log(JSON.stringify(rows.slice(0, 2), null, 2));
    results.push({ test: id, ok: true, rows: count });
  } catch {
    console.log(q.out.slice(0, 500));
    results.push({ test: id, ok: false, error: 'parse json' });
  }
}

console.log('\n=== RESUMO ===');
console.table(results);
process.exit(results.every((r) => r.ok) ? 0 : 1);
