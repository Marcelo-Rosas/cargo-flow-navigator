import { Sentry } from './sentry';

const isProd = import.meta.env.PROD;

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    if (isProd) {
      Sentry.captureMessage(message, { level: 'info', extra: context });
    } else {
      console.log(`[INFO] ${message}`, context ?? '');
    }
  },

  warn(message: string, context?: Record<string, unknown>) {
    if (isProd) {
      Sentry.captureMessage(message, { level: 'warning', extra: context });
    } else {
      console.warn(`[WARN] ${message}`, context ?? '');
    }
  },

  error(message: string, context?: Record<string, unknown>) {
    if (isProd) {
      Sentry.captureMessage(message, { level: 'error', extra: context });
    } else {
      console.error(`[ERROR] ${message}`, context ?? '');
    }
  },

  captureException(error: unknown, context?: Record<string, unknown>) {
    if (!isProd) {
      console.error('[EXCEPTION]', error, context ?? '');
    }
    // Always attempt capture — Sentry is a no-op if not initialized
    Sentry.captureException(error, { extra: context });
  },
};
