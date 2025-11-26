import {
  VestaboardAuthenticationError,
  VestaboardConnectionError,
  VestaboardTimeoutError,
  VestaboardRateLimitError,
  VestaboardServerError,
} from './errors.js';
import type { AnimationOptions } from './types.js';

export interface VestaboardHTTPClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class VestaboardHTTPClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: VestaboardHTTPClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'http://vestaboard.local:7000';
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.maxRetries = config.maxRetries ?? 2; // Default: 1 initial + 2 retries = 3 total attempts
  }

  /**
   * Send a layout to the Vestaboard
   * @param layout - 6x22 array of character codes
   */
  async post(layout: number[][]): Promise<void> {
    await this.executeWithRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/local-api/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vestaboard-Local-Api-Key': this.apiKey,
          },
          body: JSON.stringify(layout),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw await this.handleErrorResponse(response);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw this.handleRequestError(error);
      }
    });
  }

  /**
   * Send a layout with animation to the Vestaboard
   * @param layout - 6x22 array of character codes
   * @param options - Animation configuration
   */
  async postWithAnimation(layout: number[][], options: AnimationOptions): Promise<void> {
    await this.executeWithRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const payload = {
          characters: layout,
          strategy: options.strategy,
          step_interval_ms: options.stepIntervalMs ?? 100,
          step_size: options.stepSize ?? 1,
        };

        const response = await fetch(`${this.baseUrl}/local-api/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vestaboard-Local-Api-Key': this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw await this.handleErrorResponse(response);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw this.handleRequestError(error);
      }
    });
  }

  /**
   * Read the current message from the Vestaboard
   * @returns 6x22 array of character codes
   */
  async get(): Promise<number[][]> {
    return await this.executeWithRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/local-api/message`, {
          method: 'GET',
          headers: {
            'X-Vestaboard-Local-Api-Key': this.apiKey,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw await this.handleErrorResponse(response);
        }

        return (await response.json()) as number[][];
      } catch (error) {
        clearTimeout(timeoutId);
        throw this.handleRequestError(error);
      }
    });
  }

  /**
   * Execute a function with exponential backoff retry logic
   * @param fn - Function to execute
   * @returns Result of the function
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    const totalAttempts = this.maxRetries + 1; // Initial attempt + retries

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if ('isRetryable' in lastError && !lastError.isRetryable) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === totalAttempts - 1) {
          throw lastError;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new Error('Retry failed');
  }

  /**
   * Handle HTTP error responses
   * @param response - Fetch response
   * @returns Appropriate error
   */
  private async handleErrorResponse(response: Response): Promise<Error> {
    const { status, statusText } = response;

    if (status === 401 || status === 403) {
      return new VestaboardAuthenticationError(`Authentication failed: ${statusText}`, status);
    }

    if (status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
      return new VestaboardRateLimitError(`Rate limit exceeded: ${statusText}`, retryAfterSeconds);
    }

    if (status >= 500) {
      return new VestaboardServerError(`Server error: ${statusText}`, status);
    }

    return new Error(`HTTP error ${status}: ${statusText}`);
  }

  /**
   * Handle request errors (network, timeout, etc.)
   * @param error - Error from fetch
   * @returns Appropriate error
   */
  private handleRequestError(error: unknown): Error {
    if (error instanceof Error) {
      // Check if error is already one of our custom errors
      if (
        error instanceof VestaboardAuthenticationError ||
        error instanceof VestaboardConnectionError ||
        error instanceof VestaboardTimeoutError ||
        error instanceof VestaboardRateLimitError ||
        error instanceof VestaboardServerError
      ) {
        return error;
      }

      // Check for timeout
      if (error.message.includes('aborted')) {
        return new VestaboardTimeoutError('Request timed out');
      }

      // Network or other errors
      return new VestaboardConnectionError(`Connection error: ${error.message}`);
    }

    return new VestaboardConnectionError('Unknown connection error');
  }
}
