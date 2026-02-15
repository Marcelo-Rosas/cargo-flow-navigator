/**
 * Returns CORS headers with origin restricted to ALLOWED_ORIGIN.
 * In production, set ALLOWED_ORIGIN (e.g. https://app.vectracargo.com).
 * For multiple origins, use comma-separated ALLOWED_ORIGINS.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const allowed =
    Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || 'http://localhost:5173';
  const origins = allowed.split(',').map((o) => o.trim());
  const requestOrigin = req.headers.get('Origin');

  const allowOrigin = requestOrigin && origins.includes(requestOrigin) ? requestOrigin : origins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}
