/**
 * Resolve CLOUDFLARE_API_TOKEN com permissão Log Explorer.
 * Ordem: env → .env.local → .cloudflare-api-token.local → histórico terminals Cursor
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ACCOUNT_ID = '361e9e1383bfa8e95e1db54e6c2a3bba';

const INVALID_PATTERNS = /seu-token|COLE_AQUI|xxxx|\.\.\.|placeholder/i;

function isPlausibleToken(token) {
  if (!token || token.length < 30) return false;
  if (INVALID_PATTERNS.test(token)) return false;
  return /^cfut_[A-Za-z0-9_-]+$/.test(token);
}

function parseEnvFile(path) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*CLOUDFLARE_API_TOKEN\s*=\s*["']?([^"'\s#]+)["']?\s*$/);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function findTokensFromTerminals() {
  const dirs = [
    join(process.cwd(), '.cursor', 'projects'),
    join(process.env.USERPROFILE ?? '', '.cursor', 'projects'),
    join(homedir(), '.cursor', 'projects'),
  ];
  const found = new Set();
  for (const projectsDir of dirs) {
    if (!existsSync(projectsDir)) continue;
    try {
      for (const project of readdirSync(projectsDir)) {
        const termDir = join(projectsDir, project, 'terminals');
        if (!existsSync(termDir)) continue;
        for (const file of readdirSync(termDir)) {
          const text = readFileSync(join(termDir, file), 'utf8');
          for (const m of text.matchAll(/cfut_[A-Za-z0-9_-]{20,}/g)) {
            if (isPlausibleToken(m[0])) found.add(m[0]);
          }
        }
      }
    } catch {
      /* skip */
    }
  }
  return [...found];
}

function collectCandidates() {
  const list = [];
  const fromEnv = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (fromEnv) list.push(fromEnv);

  const envLocal = parseEnvFile(join(process.cwd(), '.env.local'));
  if (envLocal) list.push(envLocal);

  const tokenFile = join(process.cwd(), '.cloudflare-api-token.local');
  if (existsSync(tokenFile)) {
    const line = readFileSync(tokenFile, 'utf8').trim().split(/\r?\n/)[0]?.trim();
    if (line) list.push(line);
  }

  list.push(...findTokensFromTerminals());
  return [...new Set(list.filter(isPlausibleToken))];
}

async function verifyToken(token) {
  const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return body.success === true;
}

async function hasLogExplorerAccess(token) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/logs/explorer/datasets?include_zones=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const body = await res.json();
  return body.success === true;
}

/** @returns {Promise<string|null>} */
export async function resolveCloudflareLogExplorerToken() {
  const candidates = collectCandidates();
  for (const token of candidates) {
    if (!(await verifyToken(token))) continue;
    if (await hasLogExplorerAccess(token)) return token;
  }
  return null;
}

export function printTokenHelp() {
  console.error(`
Nenhum token Cloudflare com permissão Log Explorer encontrado.

Configure UMA vez (arquivo gitignored):

  1. Crie .env.local na raiz do projeto:
     CLOUDFLARE_API_TOKEN=cfut_SEU_TOKEN_COMPLETO

  OU

  2. Arquivo .cloudflare-api-token.local (só o token, uma linha)

Token: My Profile → API Tokens → "Log Explorer" (Zone Logs + Account Logs Edit)
Se perdeu o valor: Create Token de novo e copie na hora.

Depois: npm run cf:log-explorer:test-all
`);
}
