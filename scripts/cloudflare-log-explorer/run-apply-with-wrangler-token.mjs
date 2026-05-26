/**
 * One-shot: lê oauth_token do Wrangler e executa provision-log-explorer --apply.
 * Não imprime o token. Arquivo auxiliar local — não commitar com token.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const paths = [
  join(process.env.APPDATA ?? '', 'xdg.config', '.wrangler', 'config', 'default.toml'),
  join(homedir(), '.wrangler', 'config', 'default.toml'),
];

let token;
for (const p of paths) {
  try {
    const text = readFileSync(p, 'utf8');
    const m = text.match(/oauth_token\s*=\s*"([^"]+)"/);
    if (m?.[1]) {
      token = m[1];
      break;
    }
  } catch {
    /* try next path */
  }
}

if (!token) {
  console.error('oauth_token não encontrado. Rode: npx wrangler login');
  process.exit(2);
}

process.env.CLOUDFLARE_API_TOKEN = token;
execSync('npx tsx scripts/cloudflare-log-explorer/provision-log-explorer.ts --apply', {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd(),
});
