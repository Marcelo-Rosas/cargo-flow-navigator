/**
 * Shared JWT validation middleware for Supabase Edge Functions.
 *
 * Usage (user-facing function):
 *   import { validateJWT } from '../_shared/auth.ts';
 *   const { user, supabase } = await validateJWT(req);
 *
 * Usage with role check:
 *   const { user, supabase } = await validateJWT(req, ['admin', 'financeiro']);
 *
 * Usage (service/internal function — skip JWT, use service role):
 *   import { validateServiceKey } from '../_shared/auth.ts';
 *   validateServiceKey(req);  // throws if apikey header is missing/invalid
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type UserProfile = 'admin' | 'operacional' | 'financeiro';

export interface AuthResult {
  user: { id: string; email?: string };
  supabase: SupabaseClient;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function getEnv(key: string): string | undefined {
  try {
    if (
      typeof (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno
        ?.env?.get === 'function'
    ) {
      return (
        globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }
      ).Deno.env.get(key);
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Validates a user JWT from the Authorization header.
 * Returns the authenticated user and a user-scoped Supabase client (respects RLS).
 *
 * @param req - Incoming request
 * @param allowedProfiles - Optional array of profiles to restrict access.
 *                          If provided, the user must have one of these profiles.
 * @throws AuthError on missing/invalid token or insufficient permissions
 */
export async function validateJWT(
  req: Request,
  allowedProfiles?: UserProfile[]
): Promise<AuthResult> {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AuthError('SUPABASE_URL ou SUPABASE_ANON_KEY não configurados', 500);
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) {
    throw new AuthError('Authorization header obrigatório');
  }

  // Create user-scoped client (respects RLS)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify the JWT and get the user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthError(authError?.message || 'Usuário não autenticado');
  }

  // Optional role check
  if (allowedProfiles && allowedProfiles.length > 0) {
    const { data: hasProfile, error: profileError } = await supabase.rpc('has_profile', {
      allowed: allowedProfiles,
    });

    if (profileError || !hasProfile) {
      throw new AuthError('Acesso negado — perfil insuficiente', 403);
    }
  }

  return {
    user: { id: user.id, email: user.email },
    supabase,
  };
}

/**
 * Validates that an internal/service call includes a valid apikey header
 * matching SUPABASE_SERVICE_ROLE_KEY. Use for internal function-to-function calls.
 *
 * @throws AuthError if the apikey is missing or doesn't match
 */
export function validateServiceKey(req: Request): void {
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    throw new AuthError('SUPABASE_SERVICE_ROLE_KEY não configurada', 500);
  }

  const apikey = req.headers.get('apikey');
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  // Accept either apikey header or Authorization: Bearer <service_role_key>
  const providedKey =
    apikey?.trim().replace(/^['"]+/, '').replace(/['"]+$/, '') ||
    authHeader?.replace(/^Bearer\s+/i, '').trim();

  const cleanServiceKey = serviceRoleKey.trim().replace(/^['"]+/, '').replace(/['"]+$/, '');

  if (!providedKey || providedKey !== cleanServiceKey) {
    throw new AuthError('Service key inválida ou ausente', 403);
  }
}

/**
 * Helper to create a JSON error response from an AuthError.
 * Use in catch blocks to return consistent error responses.
 */
export function authErrorResponse(
  error: AuthError,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error: error.message }),
    {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
