/**
 * Valida variáveis de ambiente e conexão Supabase antes de smoke tests / scripts CLI.
 *
 *   npx tsx scripts/integration-health.ts
 *   npx tsx scripts/integration-health.ts --require-sr
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const requireSr = process.argv.includes('--require-sr');

const frontendVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;

/** Mesmo alias usado em generate-contract-by-code.ts e inspect-quote-pricing.ts */
export function resolveServiceRoleKey(): string | undefined {
  const key =
    process.env.SUPABASE_SR_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SERVICE_ROLE_KEY;
  const trimmed = key?.trim();
  return trimmed || undefined;
}

export function setupEnvironment(requireServiceRole = false): string[] {
  const missing: string[] = [];

  for (const key of frontendVars) {
    if (!process.env[key]?.trim()) missing.push(key);
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!url?.trim()) {
    if (!missing.includes('VITE_SUPABASE_URL')) missing.push('SUPABASE_URL|VITE_SUPABASE_URL');
  }

  if (requireServiceRole && !resolveServiceRoleKey()) {
    missing.push('SUPABASE_SR_KEY|SUPABASE_SERVICE_ROLE_KEY');
  }

  return missing;
}

export async function checkHealth(): Promise<boolean> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SR_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('[health] URL ou chave Supabase ausente');
    return false;
  }

  try {
    const sb = createClient(url, key);
    const { error } = await sb.from('company_settings').select('id').limit(1);
    if (error) {
      console.error('[health] Supabase:', error.message);
      return false;
    }
    console.log('[health] Supabase OK — company_settings acessível');
    return true;
  } catch (e) {
    console.error('[health] Erro de conexão:', (e as Error).message);
    return false;
  }
}

async function main() {
  const missing = setupEnvironment(requireSr);
  if (missing.length > 0) {
    console.error('[health] Variáveis ausentes:', missing.join(', '));
    process.exit(1);
  }

  console.log('[health] Variáveis críticas OK');
  const ok = await checkHealth();
  if (!ok) process.exit(1);
  console.log('[health] Ambiente pronto para smoke / integração');
}

void main();
