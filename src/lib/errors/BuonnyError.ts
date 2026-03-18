/**
 * Buonny Error Hierarchy
 * Structured error handling for insurance API integration
 */

/**
 * Base Buonny Error
 * All insurance-related errors extend this
 */
export class BuonnyError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly originalError?: unknown;
  public readonly timestamp: string;
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    options?: {
      statusCode?: number;
      originalError?: unknown;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'BuonnyError';
    this.code = code;
    this.statusCode = options?.statusCode;
    this.originalError = options?.originalError;
    this.context = options?.context || {};
    this.timestamp = new Date().toISOString();

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, BuonnyError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

/**
 * Authentication Error
 * Invalid credentials, expired tokens, etc.
 */
export class AuthenticationError extends BuonnyError {
  constructor(
    message: string = 'Authentication failed',
    options?: Parameters<typeof BuonnyError>[2]
  ) {
    super(message, 'AUTHENTICATION_ERROR', {
      statusCode: 401,
      ...options,
    });
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization Error
 * Insufficient permissions
 */
export class AuthorizationError extends BuonnyError {
  constructor(
    message: string = 'Authorization failed',
    options?: Parameters<typeof BuonnyError>[2]
  ) {
    super(message, 'AUTHORIZATION_ERROR', {
      statusCode: 403,
      ...options,
    });
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Validation Error
 * Invalid input parameters
 */
export class ValidationError extends BuonnyError {
  public readonly fields: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    fields: Record<string, string[]> = {},
    options?: Parameters<typeof BuonnyError>[2]
  ) {
    super(message, 'VALIDATION_ERROR', {
      statusCode: 400,
      ...options,
    });
    this.name = 'ValidationError';
    this.fields = fields;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Rate Limit Error
 * Too many requests to API
 */
export class RateLimitError extends BuonnyError {
  public readonly retryAfter: number; // seconds

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter: number = 60,
    options?: Parameters<typeof BuonnyError>[2]
  ) {
    super(message, 'RATE_LIMIT_ERROR', {
      statusCode: 429,
      ...options,
    });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Timeout Error
 * Request exceeded timeout duration
 */
export class TimeoutError extends BuonnyError {
  public readonly duration: number; // milliseconds

  constructor(
    message: string = 'Request timeout',
    duration: number = 30000,
    options?: Parameters<typeof BuonnyError>[2]
  ) {
    super(message, 'TIMEOUT_ERROR', {
      statusCode: 504,
      ...options,
    });
    this.name = 'TimeoutError';
    this.duration = duration;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Network Error
 * Connection failed, DNS error, etc.
 */
export class NetworkError extends BuonnyError {
  constructor(message: string = 'Network error', options?: Parameters<typeof BuonnyError>[2]) {
    super(message, 'NETWORK_ERROR', options);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * API Error
 * Unexpected API response or error from Buonny
 */
export class APIError extends BuonnyError {
  public readonly endpoint?: string;
  public readonly method?: string;

  constructor(
    message: string = 'API error',
    options?: Parameters<typeof BuonnyError>[2] & { endpoint?: string; method?: string }
  ) {
    const { endpoint, method, ...rest } = options || {};
    super(message, 'API_ERROR', {
      statusCode: 500,
      ...rest,
    });
    this.name = 'APIError';
    this.endpoint = endpoint;
    this.method = method;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Policy Error
 * Insurance policy related errors
 */
export class PolicyError extends BuonnyError {
  public readonly policyNumber?: string;

  constructor(
    message: string = 'Policy error',
    policyNumber?: string,
    options?: Parameters<typeof BuonnyError>[2]
  ) {
    super(message, 'POLICY_ERROR', options);
    this.name = 'PolicyError';
    this.policyNumber = policyNumber;
    Object.setPrototypeOf(this, PolicyError.prototype);
  }
}

/**
 * Eligibility Error
 * Route/cargo not eligible for insurance
 */
export class EligibilityError extends BuonnyError {
  public readonly originUF?: string;
  public readonly destinationUF?: string;
  public readonly reason?: string;

  constructor(
    message: string = 'Not eligible for insurance',
    options?: Parameters<typeof BuonnyError>[2] & {
      originUF?: string;
      destinationUF?: string;
      reason?: string;
    }
  ) {
    const { originUF, destinationUF, reason, ...rest } = options || {};
    super(message, 'ELIGIBILITY_ERROR', {
      statusCode: 400,
      context: { originUF, destinationUF, reason },
      ...rest,
    });
    this.name = 'EligibilityError';
    this.originUF = originUF;
    this.destinationUF = destinationUF;
    this.reason = reason;
    Object.setPrototypeOf(this, EligibilityError.prototype);
  }
}

/**
 * Type guard: check if error is BuonnyError
 */
export function isBuonnyError(error: unknown): error is BuonnyError {
  return error instanceof BuonnyError;
}

/**
 * Type guard: check if error is specific subclass
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Error logger with structured output
 */
export function logBuonnyError(error: unknown, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();

  if (isBuonnyError(error)) {
    const log = {
      timestamp,
      level: 'ERROR',
      type: error.name,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      context: { ...error.context, ...context },
    };

    if (error.originalError) {
      log.context.originalError = String(error.originalError);
    }

    console.error(JSON.stringify(log));
  } else {
    console.error(
      JSON.stringify({
        timestamp,
        level: 'ERROR',
        type: 'UnknownError',
        message: String(error),
        context,
      })
    );
  }
}
