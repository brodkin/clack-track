import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import type { RequestHandler } from 'express';

/**
 * Configuration options for rate limiting
 *
 * Single Responsibility Principle:
 * - Defines only rate limit configuration structure
 */
export interface RateLimitConfig {
  /** Time window in milliseconds (default: 15 minutes) */
  windowMs?: number;
  /** Maximum number of requests per window per IP (default: 100) */
  max?: number;
  /** Custom error message for rate limit exceeded */
  message?: string;
  /** Whether rate limiting is enabled (default: true, can be set via RATE_LIMIT_ENABLED env var) */
  enabled?: boolean;
}

/**
 * Default rate limit configuration
 *
 * Default: 100 requests per 15 minutes per IP address
 */
const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  enabled: true,
};

/**
 * Parse environment variable as number with fallback
 *
 * @param envVar - Environment variable value
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed number or fallback
 */
function parseEnvNumber(envVar: string | undefined, fallback: number): number {
  if (!envVar) {
    return fallback;
  }
  const parsed = parseInt(envVar, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse environment variable as boolean with fallback
 *
 * @param envVar - Environment variable value
 * @param fallback - Fallback value if not set
 * @returns Parsed boolean or fallback
 */
function parseEnvBoolean(envVar: string | undefined, fallback: boolean): boolean {
  if (envVar === undefined || envVar === '') {
    return fallback;
  }
  return envVar.toLowerCase() === 'true' || envVar === '1';
}

/**
 * Pass-through middleware that does nothing (used when rate limiting is disabled)
 */
const noopMiddleware: RequestHandler = (_req, _res, next) => {
  next();
};

/**
 * Create rate limiter middleware with configurable options
 *
 * Implements:
 * - Dependency Inversion: Accepts configuration via parameter injection
 * - Open/Closed Principle: Open for extension via config, closed for modification
 * - Single Responsibility: Only creates and returns rate limiter middleware
 *
 * Environment Variables (optional):
 * - RATE_LIMIT_WINDOW_MS: Time window in milliseconds
 * - RATE_LIMIT_MAX_REQUESTS: Maximum requests per window
 *
 * @param config - Optional rate limit configuration
 * @returns Express middleware for rate limiting
 *
 * @example
 * ```typescript
 * // Use default configuration (100 req/15min)
 * const limiter = createRateLimiter();
 * app.use('/api', limiter);
 *
 * // Custom configuration
 * const strictLimiter = createRateLimiter({ windowMs: 60000, max: 10 });
 * app.use('/api/auth', strictLimiter);
 * ```
 */
export function createRateLimiter(
  config: RateLimitConfig = {}
): RateLimitRequestHandler | RequestHandler {
  // Check if rate limiting is enabled
  // Priority: config parameter > environment variable > default (true)
  const enabled = config.enabled ?? parseEnvBoolean(process.env.RATE_LIMIT_ENABLED, true);

  if (!enabled) {
    // Return pass-through middleware when rate limiting is disabled
    return noopMiddleware;
  }

  // Merge configuration with environment variables and defaults
  // Priority: config parameter > environment variables > defaults
  const windowMs =
    config.windowMs ?? parseEnvNumber(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_CONFIG.windowMs);
  const max = config.max ?? parseEnvNumber(process.env.RATE_LIMIT_MAX_REQUESTS, DEFAULT_CONFIG.max);
  const message = config.message ?? DEFAULT_CONFIG.message;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: (req, res) => {
      // Custom handler to ensure consistent JSON error response
      res.status(429).json({
        error: message,
      });
    },
  });
}
