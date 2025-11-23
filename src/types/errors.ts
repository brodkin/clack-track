/**
 * AI Provider Error Types
 *
 * Custom error classes for handling AI provider-specific errors
 * with additional context like provider name, status codes, and original errors.
 */

/**
 * Base error class for all AI provider errors
 */
export class AIProviderError extends Error {
  public readonly provider: string;
  public readonly originalError?: Error;
  public readonly statusCode?: number;

  constructor(message: string, provider: string, originalError?: Error, statusCode?: number) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.originalError = originalError;
    this.statusCode = statusCode;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when rate limit is exceeded
 * Default status code: 429 (Too Many Requests)
 */
export class RateLimitError extends AIProviderError {
  constructor(message: string, provider: string, originalError?: Error, statusCode?: number) {
    super(message, provider, originalError, statusCode ?? 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown when request parameters are invalid
 * Default status code: 400 (Bad Request)
 */
export class InvalidRequestError extends AIProviderError {
  constructor(message: string, provider: string, originalError?: Error, statusCode?: number) {
    super(message, provider, originalError, statusCode ?? 400);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Error thrown when authentication fails
 * Default status code: 401 (Unauthorized)
 */
export class AuthenticationError extends AIProviderError {
  constructor(message: string, provider: string, originalError?: Error, statusCode?: number) {
    super(message, provider, originalError, statusCode ?? 401);
    this.name = 'AuthenticationError';
  }
}
