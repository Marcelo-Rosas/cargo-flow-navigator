import type { Page } from '@playwright/test';

function getSupabaseStorageKey() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.PW_SUPABASE_URL ||
    process.env.PW_BASE_URL;

  if (!supabaseUrl) {
    throw new Error(
      'Defina VITE_SUPABASE_URL (ou SUPABASE_URL/PW_SUPABASE_URL) para calcular a storage key do Supabase.'
    );
  }

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

export async function seedMockSupabaseSession(page: Page) {
  const storageKey = getSupabaseStorageKey();
  const fakeSession = {
    access_token: 'fake-access-token',
    token_type: 'bearer',
    refresh_token: 'fake-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: 'e2e-user',
      email: 'e2e@local.test',
      role: 'authenticated',
      aud: 'authenticated',
    },
  };

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
    [storageKey, fakeSession]
  );
}
