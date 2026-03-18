/**
 * BaseHttpClient - Reusable HTTP client with retry logic, typing, and error handling
 * Supports exponential backoff, timeouts, and structured logging
 *
 * Usage:
 *   const client = new BaseHttpClient({ baseURL: 'https://api.buonny.com' })
 *   const result = await client.post<InsuranceOption[]>('/check-options', { origin_uf: 'SP' })
 */

import {
  BuonnyError,
  AuthenticationError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  APIError,
  logBuonnyError,
} from '@/lib/errors/BuonnyError';

export interface BaseHttpClientConfig {
  baseURL: string;
  timeout?: number; // milliseconds, default 30000
  maxRetries?: number; // default 3
  retryDelay?: number; // milliseconds, default 1000 (exponential backoff multiplier)
  headers?: Record<string, string>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  retries?: number;
}

export interface HttpResponse<T> {
  status: number;
  statusText: string;
  data: T;
  headers: Record<string, string>;
}

/**
 * Exponential backoff with jitter: delay * (2 ^ retryCount) + random(0-1000ms)
 */
function calculateBackoffDelay(retryCount: number, baseDelay: number): number {
  const exponential = baseDelay * Math.pow(2, retryCount);
  const jitter = Math.random() * 1000;
  return exponential + jitter;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true; // 429
  if (error instanceof TimeoutError) return true;
  if (error instanceof NetworkError) return true;
  if (error instanceof APIError && error.statusCode && error.statusCode >= 500) return true; // 5xx
  return false;
}

export class BaseHttpClient {
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private defaultHeaders: Record<string, string>;

  constructor(config: BaseHttpClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', endpoint, data, options);
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  /**
   * Core request method with retry logic and error handling
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
    retryCount: number = 0
  ): Promise<HttpResponse<T>> {
    const maxRetries = options?.retries ?? this.maxRetries;
    const url = `${this.baseURL}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeout = options?.timeout ?? this.timeout;

      // Set timeout
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...options?.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: options?.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      // Extract headers as object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parse response body
      let responseData: T;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = (await response.text()) as T;
        }
      } catch (e) {
        throw new APIError('Failed to parse response body', {
          statusCode: response.status,
          endpoint,
          method,
          originalError: e,
        });
      }

      // Handle error status codes
      if (!response.ok) {
        this.handleErrorResponse(response.status, responseData, endpoint, method);
      }

      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        headers: responseHeaders,
      };
    } catch (error) {
      // Handle specific error types
      if (error instanceof BuonnyError) {
        // Retry logic for retryable errors
        if (isRetryableError(error) && retryCount < maxRetries) {
          const delay = calculateBackoffDelay(retryCount, this.retryDelay);
          logBuonnyError(error, {
            endpoint,
            method,
            retryCount,
            nextRetryIn: `${delay}ms`,
          });

          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(method, endpoint, data, options, retryCount + 1);
        }

        throw error;
      }

      // Handle fetch-specific errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new NetworkError('Network request failed', {
          originalError: error,
          context: { endpoint, method },
        });
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(
          `Request timeout after ${options?.timeout ?? this.timeout}ms`,
          options?.timeout ?? this.timeout,
          {
            originalError: error,
            context: { endpoint, method },
          }
        );
      }

      // Re-throw as generic BuonnyError
      throw new BuonnyError('Unknown request error', 'UNKNOWN_ERROR', {
        originalError: error,
        context: { endpoint, method },
      });
    }
  }

  /**
   * Handle error responses from API
   */
  private handleErrorResponse(
    status: number,
    data: unknown,
    endpoint: string,
    method: string
  ): never {
    // Rate limit
    if (status === 429) {
      const retryAfter = this.extractRetryAfter(data);
      throw new RateLimitError('Rate limit exceeded', retryAfter, {
        statusCode: status,
        context: { endpoint, method },
      });
    }

    // Authentication
    if (status === 401 || status === 403) {
      throw new AuthenticationError('Request unauthorized', {
        statusCode: status,
        context: { endpoint, method, data },
      });
    }

    // Validation errors
    if (status === 400) {
      const message = this.extractErrorMessage(data);
      throw new APIError(message || 'Bad request', {
        statusCode: status,
        endpoint,
        method,
        context: { data },
      });
    }

    // Server errors
    if (status >= 500) {
      const message = this.extractErrorMessage(data);
      throw new APIError(message || 'Server error', {
        statusCode: status,
        endpoint,
        method,
        context: { data },
      });
    }

    // Generic error
    const message = this.extractErrorMessage(data);
    throw new APIError(message || `HTTP ${status}`, {
      statusCode: status,
      endpoint,
      method,
      context: { data },
    });
  }

  /**
   * Extract error message from various response formats
   */
  private extractErrorMessage(data: unknown): string {
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      return (obj.message as string) || (obj.error as string) || (obj.detail as string) || '';
    }
    return '';
  }

  /**
   * Extract Retry-After header value in seconds
   */
  private extractRetryAfter(data: unknown): number {
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      const retryAfter = obj['retry_after'] || obj['retryAfter'];
      if (typeof retryAfter === 'number') return retryAfter;
    }
    return 60; // Default to 60 seconds
  }
}

/**
 * Factory for creating pre-configured clients
 */
export const createBuonnyClient = (
  apiKey: string,
  baseURL: string = 'https://api.buonny.com'
): BaseHttpClient => {
  return new BaseHttpClient({
    baseURL,
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Client-Version': '1.0.0',
    },
  });
};
