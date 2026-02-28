/**
 * Returns CORS headers with origin restricted to ALLOWED_ORIGIN / ALLOWED_ORIGINS.
 * Accepts exact origins or patterns with * (e.g. https://*.vercel.app for Vercel previews).
 * In production, set ALLOWED_ORIGIN (e.g. https://app.vectracargo.com).
 * For multiple origins, use comma-separated ALLOWED_ORIGINS.
 */
function matchesOrigin(origin: string, pattern: string): boolean {
  if (pattern === origin) return true;
  if (!pattern.includes('*')) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(origin);
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const getEnv = (key: string) => {
    try {
      if (
        typeof (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno
          ?.env?.get === 'function'
      ) {
        return (
          globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }
        ).Deno.env.get(key);
      }
      if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
      }
    } catch {
      // ignore
    }
    return undefined;
  };
  const allowed =
    getEnv('ALLOWED_ORIGINS') ||
    getEnv('ALLOWED_ORIGIN') ||
    'http://localhost:5173,http://localhost:8080,https://cargo-flow-navigator.vercel.app,https://*.vercel.app';
  const origins = allowed.split(',').map((o) => o.trim());
  const requestOrigin = req.headers.get('Origin');

  const inAllowlist =
    !!requestOrigin && origins.some((pattern) => matchesOrigin(requestOrigin, pattern));

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (inAllowlist) {
    headers['Access-Control-Allow-Origin'] = requestOrigin!;
    headers['Vary'] = 'Origin';
  }

  return headers;
}
