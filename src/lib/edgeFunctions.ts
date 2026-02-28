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
      headers: {
        ...headers,
        ...options.headers,
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
