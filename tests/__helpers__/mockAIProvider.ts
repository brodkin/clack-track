/**
 * Mock AI Provider Factory for Tests
 *
 * Provides configurable mock AI providers for testing with customizable responses,
 * failures, and latency simulation. Includes specialized factories for common
 * test scenarios like rate limiting and authentication failures.
 */

import type { AIProvider, AIGenerationRequest, AIGenerationResponse } from '@/types/ai';
import {
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
} from '@/types/errors';

/**
 * Configuration options for mock AI provider behavior
 */
export interface MockAIProviderOptions {
  /** Partial response to return (merged with defaults) */
  response?: Partial<AIGenerationResponse>;
  /** Whether the provider should fail when generate() is called */
  shouldFail?: boolean;
  /** Error to throw when shouldFail is true */
  failureError?: Error;
  /** Simulated latency in milliseconds for validateConnection() */
  latencyMs?: number;
  /** Whether validateConnection() should return valid=true */
  connectionValid?: boolean;
}

/**
 * Create a configurable mock AI provider for tests
 *
 * @param options - Configuration for mock behavior
 * @returns Mock AIProvider with jest.fn() spies
 *
 * @example
 * ```typescript
 * // Basic mock with default response
 * const provider = createMockAIProvider();
 *
 * // Mock that fails on generate()
 * const failingProvider = createMockAIProvider({
 *   shouldFail: true,
 *   failureError: new Error('API error')
 * });
 *
 * // Mock with custom response
 * const customProvider = createMockAIProvider({
 *   response: { text: 'Custom response', model: 'test-model' }
 * });
 * ```
 */
export function createMockAIProvider(options: MockAIProviderOptions = {}): AIProvider {
  const {
    response = {},
    shouldFail = false,
    failureError = new Error('Mock provider failure'),
    latencyMs: _latencyMs = 10, // Prefix with _ to indicate intentionally unused
    connectionValid = true,
  } = options;

  // Default response values
  const defaultResponse: AIGenerationResponse = {
    text: 'MOCK AI RESPONSE',
    model: 'mock-model',
    tokensUsed: 30,
    finishReason: 'stop',
  };

  // Merge custom response with defaults
  const finalResponse: AIGenerationResponse = {
    ...defaultResponse,
    ...response,
  };

  return {
    generate: jest.fn().mockImplementation(async (_request: AIGenerationRequest) => {
      if (shouldFail) {
        throw failureError;
      }
      return finalResponse;
    }),
    validateConnection: jest.fn().mockResolvedValue(connectionValid),
  };
}

/**
 * Create a mock provider that throws a generic error
 *
 * Useful for testing error handling paths that don't trigger failover
 * (only RateLimitError and AuthenticationError trigger failover).
 *
 * @param error - Error to throw when generate() is called
 * @returns Mock AIProvider that fails with the specified error
 *
 * @example
 * ```typescript
 * const provider = createFailingProvider(new Error('Network timeout'));
 * await expect(provider.generate(request)).rejects.toThrow('Network timeout');
 * ```
 */
export function createFailingProvider(error: Error): AIProvider {
  return createMockAIProvider({ shouldFail: true, failureError: error });
}

/**
 * Create a mock provider that throws RateLimitError
 *
 * Used to test provider failover scenarios, as RateLimitError triggers
 * automatic failover to alternate provider in production code.
 *
 * @param provider - Provider name for error context (default: 'mock-provider')
 * @returns Mock AIProvider that fails with RateLimitError
 *
 * @example
 * ```typescript
 * const provider = createRateLimitedProvider('openai');
 * await expect(provider.generate(request)).rejects.toThrow(RateLimitError);
 * ```
 */
export function createRateLimitedProvider(provider = 'mock-provider'): AIProvider {
  const error = new RateLimitError('Rate limit exceeded', provider);
  return createFailingProvider(error);
}

/**
 * Create a mock provider that throws AuthenticationError
 *
 * Used to test provider failover scenarios, as AuthenticationError triggers
 * automatic failover to alternate provider in production code.
 *
 * @param provider - Provider name for error context (default: 'mock-provider')
 * @returns Mock AIProvider that fails with AuthenticationError
 *
 * @example
 * ```typescript
 * const provider = createAuthFailedProvider('anthropic');
 * await expect(provider.generate(request)).rejects.toThrow(AuthenticationError);
 * ```
 */
export function createAuthFailedProvider(provider = 'mock-provider'): AIProvider {
  const error = new AuthenticationError('Invalid API key', provider);
  return createFailingProvider(error);
}

/**
 * Create a mock provider that throws InvalidRequestError
 *
 * Used to test error handling for malformed requests. Unlike RateLimitError
 * and AuthenticationError, this does NOT trigger provider failover.
 *
 * @param provider - Provider name for error context (default: 'mock-provider')
 * @returns Mock AIProvider that fails with InvalidRequestError
 *
 * @example
 * ```typescript
 * const provider = createInvalidRequestProvider();
 * await expect(provider.generate(request)).rejects.toThrow(InvalidRequestError);
 * ```
 */
export function createInvalidRequestProvider(provider = 'mock-provider'): AIProvider {
  const error = new InvalidRequestError('Invalid request parameters', provider);
  return createFailingProvider(error);
}

/**
 * Create a mock provider with custom connection validation behavior
 *
 * Useful for testing connection validation logic and latency measurements.
 *
 * @param valid - Whether connection should be valid
 * @param latencyMs - Simulated latency in milliseconds
 * @returns Mock AIProvider with custom validation behavior
 *
 * @example
 * ```typescript
 * const slowProvider = createMockProviderWithConnection(true, 500);
 * const result = await slowProvider.validateConnection();
 * expect(result).toBe(true);
 * ```
 */
export function createMockProviderWithConnection(
  valid: boolean,
  latencyMs = 10
): AIProvider {
  return createMockAIProvider({ connectionValid: valid, latencyMs });
}
