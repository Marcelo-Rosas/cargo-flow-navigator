import { readFileSync } from 'node:fs';

const SUPABASE_TOKEN_KEY_PATTERN = /^sb-[^-]+-auth-token$/i;

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Token Supabase inválido (payload ausente).');
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (error) {
    throw new Error('Não foi possível decodificar o payload do token Supabase.');
  }
}

export function getUserIdFromStorageState(storagePath = '.auth/user.json'): string {
  const raw = readFileSync(storagePath, 'utf8');
  const storageState = JSON.parse(raw);

  const origin = Array.isArray(storageState.origins) ? storageState.origins[0] : null;
  const localStorage = Array.isArray(origin?.localStorage) ? origin?.localStorage : [];

  const authEntry = localStorage.find((entry) => SUPABASE_TOKEN_KEY_PATTERN.test(entry.name));
  if (!authEntry?.value) {
    throw new Error(
      'StorageState inválido. Gere o estado com: npx playwright test --project=setup'
    );
  }

  const parsedValue = JSON.parse(authEntry.value);
  const accessToken = parsedValue.access_token;
  if (!accessToken) {
    throw new Error('Token Supabase ausente no storage state.');
  }

  const payload = decodeJwtPayload(accessToken);
  const userId = payload.sub;
  if (typeof userId !== 'string') {
    throw new Error('Não foi possível extrair o user_id do token Supabase.');
  }

  return userId;
}
