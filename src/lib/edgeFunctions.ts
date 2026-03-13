import { supabase } from '@/integrations/supabase/client';

type InvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
};

function getPublishableKey(): string | undefined {
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

async function buildAuthHeaders(requireAuth: boolean): Promise<Record<string, string>> {
  const baseHeaders: Record<string, string> = {};
  const publishableKey = getPublishableKey();
  if (publishableKey) {
    baseHeaders.apikey = publishableKey;
  }

  // getUser() forces refresh if token expired; getSession() alone can return stale token
  await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    if (requireAuth) {
      throw new Error('Sessão expirada. Faça login novamente e tente de novo.');
    }
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function invokeEdgeFunction<T>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<T> {
  const requireAuth = options.requireAuth ?? true;
  const initialHeaders = await buildAuthHeaders(requireAuth);

  const execute = (headers: Record<string, string>) =>
    supabase.functions.invoke(functionName, {
      body: options.body,
      // Keep call-specific headers, but never let them override auth headers.
      headers: {
        ...options.headers,
        ...headers,
      },
    });

  let { data, error } = await execute(initialHeaders);

  if (error && /401|jwt|token/i.test(error.message || '')) {
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (!refreshError && refreshedSession?.access_token) {
      const retryHeaders: Record<string, string> = {
        ...initialHeaders,
        Authorization: `Bearer ${refreshedSession.access_token}`,
      };
      const retry = await execute(retryHeaders);
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) {
    // Fallback: in rare browser/client-sdk cases, invoke can return 401 even with
    // valid headers. Retry with direct HTTP call to eliminate SDK transport issues.
    if (/401|jwt|token|authorization/i.test(error.message || '')) {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const publishableKey = getPublishableKey();
      if (url && publishableKey) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (accessToken) {
          const directRes = await fetch(`${url}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              apikey: publishableKey,
              Authorization: `Bearer ${accessToken}`,
              ...(options.headers ?? {}),
            },
            body: options.body != null ? JSON.stringify(options.body) : undefined,
          });

          if (directRes.ok) {
            const payload = (await directRes.json()) as T;
            return payload;
          }

          try {
            const payload = (await directRes.json()) as {
              error?: string;
              message?: string;
              errors?: string[];
            };
            if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
              throw new Error(payload.errors.join('; '));
            }
            if (payload?.error || payload?.message) {
              throw new Error(payload.error || payload.message);
            }
          } catch {
            const text = await directRes.text().catch(() => null);
            if (text) throw new Error(text);
          }
        }
      }
    }

    const parsedMessage = await (async () => {
      const context = (error as { context?: Response })?.context;
      if (!context) return null;
      try {
        const payload = (await context.clone().json()) as {
          error?: string;
          message?: string;
          errors?: string[];
        };
        if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
          return payload.errors.join('; ');
        }
        return payload?.error || payload?.message || null;
      } catch {
        try {
          const text = await context.clone().text();
          return text || null;
        } catch {
          return null;
        }
      }
    })();

    if (parsedMessage) {
      throw new Error(parsedMessage);
    }

    throw error;
  }

  return data as T;
}
