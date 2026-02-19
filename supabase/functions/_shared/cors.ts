/**
 * Returns CORS headers with origin restricted to ALLOWED_ORIGIN.
 * In production, set ALLOWED_ORIGIN (e.g. https://app.vectracargo.com).
 * For multiple origins, use comma-separated ALLOWED_ORIGINS.
 */
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
    'http://localhost:5173,https://cargo-flow-navigator.vercel.app';
  const origins = allowed.split(',').map((o) => o.trim());
  const requestOrigin = req.headers.get('Origin');

  const inAllowlist = requestOrigin && origins.includes(requestOrigin);

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
