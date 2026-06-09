/**
 * Ping Google Generative Language API (mesmo endpoint das Edge Functions).
 * Uso: node scripts/ping-gemini.mjs
 * Lê chave Gemini de (ordem padrão):
 *   GEMINI_API_KEY (env) → supabase/.env.local GOOGLE_API_KEY → functions/.env.local.functions.txt
 *
 * Flags:
 *   --file-only   ignora GEMINI_API_KEY do shell (só .env.local / functions txt)
 *   --use-shell   só process.env.GEMINI_API_KEY
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fileOnly = process.argv.includes('--file-only');
const useShell = process.argv.includes('--use-shell');
const keyArg = process.argv.find((a) => a.startsWith('--key='))?.slice('--key='.length);

function parseEnvFile(path, keyName) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^${keyName}=(.+)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

function loadKey() {
  if (useShell && process.env.GEMINI_API_KEY?.trim()) {
    return { key: process.env.GEMINI_API_KEY.trim(), source: 'process.env.GEMINI_API_KEY' };
  }
  if (!fileOnly && process.env.GEMINI_API_KEY?.trim()) {
    return { key: process.env.GEMINI_API_KEY.trim(), source: 'process.env.GEMINI_API_KEY' };
  }
  const fromSupabaseLocal = parseEnvFile(resolve(root, 'supabase/.env.local'), 'GOOGLE_API_KEY');
  if (fromSupabaseLocal) {
    return { key: fromSupabaseLocal, source: 'supabase/.env.local → GOOGLE_API_KEY' };
  }
  const fromFunctions = parseEnvFile(
    resolve(root, 'supabase/functions/.env.local.functions.txt'),
    'GEMINI_API_KEY'
  );
  if (fromFunctions) {
    return { key: fromFunctions, source: 'functions/.env.local.functions.txt → GEMINI_API_KEY' };
  }
  return { key: null, source: '(nenhuma)' };
}

function maskKey(key) {
  if (!key || key.length < 12) return '(missing or too short)';
  return `${key.slice(0, 6)}…${key.slice(-4)} (len=${key.length})`;
}

const PRIMARY_MODEL = 'gemini-2.5-flash'; // approval_summary (CFN)
const FALLBACK_MODEL = 'gemini-2.5-flash';

async function ping(model, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Responda apenas: PONG' }] }],
      generationConfig: { maxOutputTokens: 16, temperature: 0 },
    }),
  });
  const body = await res.text();
  return { model, status: res.status, ms: Date.now() - started, body: body.slice(0, 500) };
}

async function listModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  const body = await res.text();
  return { status: res.status, body: body.slice(0, 300) };
}

const loaded = keyArg ? { key: keyArg.trim(), source: '--key= (argumento)' } : loadKey();
const { key: apiKey, source: keySource } = loaded;
console.log('CFN Gemini config (Edge Functions)');
console.log('  Endpoint: https://generativelanguage.googleapis.com/v1beta');
console.log('  Produção: Supabase secret GEMINI_API_KEY');
console.log('  Fonte:   ', keySource);
console.log('  Key:     ', maskKey(apiKey));
if (!fileOnly && !useShell && process.env.GEMINI_API_KEY?.trim()) {
  console.log('  Dica:    rode com --file-only para testar só supabase/.env.local');
}
console.log('  Primary:  ', PRIMARY_MODEL, '(approval_summary, ai-approval-summary-worker)');
console.log('  Fallback: ', FALLBACK_MODEL, '(gemini.ts callGemini fallback)');
console.log('  aiClient: GEMINI_MODEL env or default', FALLBACK_MODEL);
console.log('  NOT used: Cloudflare Workers AI binding, OpenAI, Anthropic (dead code in aiClient)');
console.log('');

if (!apiKey) {
  console.error(
    'GEMINI_API_KEY não encontrada. Defina no ambiente ou em supabase/functions/.env.local.functions.txt'
  );
  process.exit(1);
}

const list = await listModels(apiKey);
console.log('PING listModels:', list.status, list.status === 200 ? 'OK' : list.body);

let failed = false;
for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
  const r = await ping(model, apiKey);
  console.log(`PING ${model}:`, r.status, `${r.ms}ms`);
  if (r.status !== 200) {
    failed = true;
    console.log('  ', r.body);
  }
}

process.exitCode = failed ? 1 : 0;
