/**
 * Orchestrator Retry Logic with Multi-Attempt Strategy
 *
 * Provides configurable retry functionality with:
 * - True provider swapping via generator factory pattern
 * - Exponential backoff with configurable parameters
 * - Multi-attempt strategy (default: 2 attempts per provider)
 * - Comprehensive error aggregation for debugging
 *
 * Retry Flow:
 * 1. Try preferred provider (attempt 1)
 * 2. Backoff 1s, try preferred provider (attempt 2)
 * 3. Switch to alternate provider
 * 4. Backoff 2s, try alternate provider (attempt 1)
 * 5. Backoff 4s, try alternate provider (attempt 2)
 * 6. All attempts exhausted → throw aggregated error for P3 fallback
 *
 * @module content/orchestrator-retry
 */

import { RateLimitError, OverloadedError } from '../types/errors.js';
import { sleep } from '../utils/sleep.js';
import type { AIProvider } from '../types/ai.js';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  FailoverMetadata,
} from '../types/content-generator.js';
import type { CircuitBreakerService } from '../services/circuit-breaker-service.js';
import type { CircuitState } from '../types/circuit-breaker.js';

/**
 * Maps a provider name to its circuit breaker ID
 *
 * @param providerName - The provider name (e.g., 'openai', 'anthropic')
 * @returns The circuit ID (e.g., 'PROVIDER_OPENAI', 'PROVIDER_ANTHROPIC')
 */
function providerToCircuitId(providerName: string): string {
  return `PROVIDER_${providerName.toUpperCase()}`;
}

/**
 * Gets the provider name from an AIProvider instance
 *
 * Uses the provider's getName() method if available, otherwise falls back to
 * a default based on the provider position (preferred = 'openai', alternate = 'anthropic')
 *
 * @param provider - The AI provider instance
 * @param isPreferred - Whether this is the preferred provider
 * @returns The provider name
 */
function getProviderNameFromInstance(provider: AIProvider, isPreferred: boolean): string {
  if (provider.getName) {
    return provider.getName();
  }
  // Default fallback based on position
  return isPreferred ? 'openai' : 'anthropic';
}

/**
 * Factory function to create a ContentGenerator with a specific AI provider
 *
 * Enables true provider swapping by creating new generator instances
 * with different providers on each retry attempt.
 *
 * @param provider - The AI provider to inject into the generator
 * @returns A new ContentGenerator instance configured with the provider
 *
 * @example
 * ```typescript
 * const factory = (provider: AIProvider) => new MotivationalGenerator(provider);
 * const content = await generateWithRetry(factory, context, openai, anthropic);
 * ```
 */
export type GeneratorFactory = (provider: AIProvider) => ContentGenerator;

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /**
   * Number of attempts per provider before switching
   * Default: 2 (total 4 attempts across 2 providers)
   */
  attemptsPerProvider: number;

  /**
   * Base delay in milliseconds for exponential backoff
   * Default: 1000 (1 second)
   */
  backoffBaseMs: number;

  /**
   * Multiplier for exponential backoff calculation
   * Default: 2 (backoff = baseMs × multiplier^attemptNumber)
   */
  backoffMultiplier: number;
}

/**
 * Metadata about a failed attempt
 */
export interface FailedAttempt {
  /**
   * Provider name that was used (e.g., "openai", "anthropic")
   */
  provider: string;

  /**
   * Attempt number for this provider (1-based)
   */
  attempt: number;

  /**
   * The error that caused the failure
   */
  error: Error;

  /**
   * Timestamp when the attempt failed
   */
  timestamp: Date;
}

/**
 * Error thrown when all retry attempts are exhausted
 *
 * Includes detailed information about each failed attempt
 * for debugging and P3 fallback decision-making.
 */
export class RetryExhaustedError extends Error {
  /**
   * Array of all failed attempts with metadata
   */
  public readonly attempts: FailedAttempt[];

  constructor(attempts: FailedAttempt[]) {
    const totalAttempts = attempts.length;
    const providers = Array.from(new Set(attempts.map(a => a.provider))).join(', ');
    super(
      `All retry attempts exhausted. Tried ${totalAttempts} attempts across providers: ${providers}`
    );
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  attemptsPerProvider: 2,
  backoffBaseMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Determines if an error is retryable with backoff/provider swap.
 *
 * Retryable errors:
 * - RateLimitError (429): Client exceeded quota, may succeed with different provider or after delay
 * - OverloadedError (503): Provider infrastructure at capacity, may succeed with different provider or after delay
 *
 * Non-retryable errors (throw immediately):
 * - AuthenticationError (401): Invalid credentials, won't succeed on retry
 * - InvalidRequestError (400): Bad parameters, won't succeed on retry
 * - Generic errors: Unknown issues, don't waste retries
 *
 * @param error - The error to check
 * @returns True if the error should trigger retry logic
 */
function isRetryableError(error: unknown): boolean {
  return error instanceof RateLimitError || error instanceof OverloadedError;
}

/**
 * Generate content with multi-attempt retry strategy and exponential backoff.
 *
 * Strategy: 2 attempts on preferred provider → 2 attempts on alternate provider → throw
 *
 * Implements true provider swapping via generator factory pattern. Each attempt
 * creates a new generator instance with the appropriate provider, enabling
 * seamless failover from one AI provider to another (e.g., OpenAI → Anthropic).
 *
 * Exponential backoff prevents overwhelming providers:
 * - Attempt 1 fails → wait 1s → Attempt 2
 * - Attempt 2 fails → wait 2s → Attempt 3 (provider swap)
 * - Attempt 3 fails → wait 4s → Attempt 4
 *
 * Error handling:
 * - Retryable errors (RateLimitError, OverloadedError): Continue with backoff/provider swap
 * - Non-retryable errors (AuthenticationError, InvalidRequestError, generic): Throw immediately
 * - All attempts exhausted: Throw RetryExhaustedError with full attempt history
 *
 * @param generatorFactory - Factory function to create generators with specific providers
 * @param context - Generation context with update type and metadata
 * @param preferredProvider - Primary AI provider (e.g., OpenAI)
 * @param alternateProvider - Fallback AI provider (e.g., Anthropic)
 * @param config - Optional retry configuration (defaults to 2 attempts per provider, 1s base backoff)
 * @param circuitBreaker - Optional circuit breaker service for tracking provider health
 * @returns Generated content from successful attempt
 * @throws RetryExhaustedError if all attempts fail with retryable errors
 * @throws Original error if non-retryable error occurs
 *
 * @example
 * ```typescript
 * const factory = (provider: AIProvider) => new MotivationalGenerator(provider);
 * const openai = createAIProvider(AIProviderType.OPENAI, apiKey);
 * const anthropic = createAIProvider(AIProviderType.ANTHROPIC, apiKey);
 *
 * try {
 *   const content = await generateWithRetry(factory, context, openai, anthropic);
 *   // Use content...
 * } catch (error) {
 *   if (error instanceof RetryExhaustedError) {
 *     // All providers failed, trigger P3 static fallback
 *     console.error(`Failed after ${error.attempts.length} attempts`);
 *   }
 *   throw error;
 * }
 * ```
 */
export async function generateWithRetry(
  generatorFactory: GeneratorFactory,
  context: GenerationContext,
  preferredProvider: AIProvider,
  alternateProvider: AIProvider,
  config: Partial<RetryConfig> = {},
  circuitBreaker?: CircuitBreakerService
): Promise<GeneratedContent> {
  // Merge provided config with defaults
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  const failedAttempts: FailedAttempt[] = [];
  const totalAttempts = retryConfig.attemptsPerProvider * 2; // 2 providers

  // Track start time for total duration
  const startTime = Date.now();

  // Extract provider names for metadata using getName() if available
  const preferredProviderName = getProviderNameFromInstance(preferredProvider, true);
  const alternateProviderName = getProviderNameFromInstance(alternateProvider, false);

  // Get circuit IDs for each provider
  const preferredCircuitId = providerToCircuitId(preferredProviderName);
  const alternateCircuitId = providerToCircuitId(alternateProviderName);

  // Track if any circuit was tripped (skipped due to OPEN state)
  let circuitTripped = false;

  // Helper to check if provider is available (fail-open on errors)
  const isProviderAvailable = async (circuitId: string): Promise<boolean> => {
    if (!circuitBreaker) return true;
    try {
      return await circuitBreaker.isProviderAvailable(circuitId);
    } catch {
      // Fail-open: if circuit breaker check fails, allow the attempt
      return true;
    }
  };

  // Helper to record provider failure (graceful on errors)
  const recordFailure = async (circuitId: string, error: Error): Promise<void> => {
    if (!circuitBreaker) return;
    try {
      await circuitBreaker.recordProviderFailure(circuitId, error);
    } catch {
      // Graceful degradation: log failure but continue
      console.warn(`Failed to record provider failure for ${circuitId}`);
    }
  };

  // Helper to record provider success (graceful on errors)
  const recordSuccess = async (circuitId: string): Promise<void> => {
    if (!circuitBreaker) return;
    try {
      await circuitBreaker.recordProviderSuccess(circuitId);
    } catch {
      // Graceful degradation: log failure but continue
      console.warn(`Failed to record provider success for ${circuitId}`);
    }
  };

  // Helper to get circuit states for metadata
  const getCircuitStates = async (): Promise<{ [circuitId: string]: CircuitState } | undefined> => {
    if (!circuitBreaker) return undefined;
    try {
      const states: { [circuitId: string]: CircuitState } = {};

      const preferredStatus = await circuitBreaker.getProviderStatus(preferredCircuitId);
      if (preferredStatus) {
        states[preferredCircuitId] = preferredStatus.state;
      }

      const alternateStatus = await circuitBreaker.getProviderStatus(alternateCircuitId);
      if (alternateStatus) {
        states[alternateCircuitId] = alternateStatus.state;
      }

      return Object.keys(states).length > 0 ? states : undefined;
    } catch {
      return undefined;
    }
  };

  // Calculate which provider to use for each attempt
  const getProviderForAttempt = (attemptIndex: number): AIProvider => {
    const providerAttemptNumber = Math.floor(attemptIndex / retryConfig.attemptsPerProvider);
    return providerAttemptNumber === 0 ? preferredProvider : alternateProvider;
  };

  // Get circuit ID for an attempt
  const getCircuitIdForAttempt = (attemptIndex: number): string => {
    const providerAttemptNumber = Math.floor(attemptIndex / retryConfig.attemptsPerProvider);
    return providerAttemptNumber === 0 ? preferredCircuitId : alternateCircuitId;
  };

  // Calculate attempt number within provider (1-based)
  const getAttemptNumber = (attemptIndex: number): number => {
    return (attemptIndex % retryConfig.attemptsPerProvider) + 1;
  };

  // Get provider name for metadata
  const getProviderName = (attemptIndex: number): string => {
    const providerAttemptNumber = Math.floor(attemptIndex / retryConfig.attemptsPerProvider);
    return providerAttemptNumber === 0 ? preferredProviderName : alternateProviderName;
  };

  // Check provider availability before starting
  // If circuit breaker is provided, check if both providers are unavailable
  if (circuitBreaker) {
    const preferredAvailable = await isProviderAvailable(preferredCircuitId);
    const alternateAvailable = await isProviderAvailable(alternateCircuitId);

    if (!preferredAvailable && !alternateAvailable) {
      // Both circuits are OPEN - no providers available
      circuitTripped = true;
      throw new RetryExhaustedError([]);
    }

    // Track if preferred is skipped
    if (!preferredAvailable) {
      circuitTripped = true;
    }
  }

  // Track attempts made per provider for circuit-aware loop
  let preferredAttemptsMade = 0;
  let alternateAttemptsMade = 0;
  let actualAttemptIndex = 0;

  // Attempt generation with retry loop
  for (let attemptIndex = 0; attemptIndex < totalAttempts; attemptIndex++) {
    const currentCircuitId = getCircuitIdForAttempt(attemptIndex);
    const currentProvider = getProviderForAttempt(attemptIndex);
    const isPreferredProvider = attemptIndex < retryConfig.attemptsPerProvider;

    // Check circuit availability before attempting
    const available = await isProviderAvailable(currentCircuitId);
    if (!available) {
      // Circuit is OPEN - skip this provider's attempts
      circuitTripped = true;

      // Skip all remaining attempts for this provider
      if (isPreferredProvider) {
        // Skip to alternate provider
        attemptIndex = retryConfig.attemptsPerProvider - 1; // Will be incremented by loop
        continue;
      } else {
        // Alternate provider also unavailable - we're done
        break;
      }
    }

    // Track actual attempts
    if (isPreferredProvider) {
      preferredAttemptsMade++;
    } else {
      alternateAttemptsMade++;
    }
    actualAttemptIndex++;

    const attemptNumber = getAttemptNumber(attemptIndex);

    // Apply exponential backoff before retry (not on first actual attempt)
    if (actualAttemptIndex > 1) {
      const backoffMs =
        retryConfig.backoffBaseMs * Math.pow(retryConfig.backoffMultiplier, actualAttemptIndex - 2);
      await sleep(backoffMs);
    }

    try {
      // Create new generator with current provider
      const generator = generatorFactory(currentProvider);

      // Attempt generation
      const content = await generator.generate(context);

      // Record success with circuit breaker
      await recordSuccess(currentCircuitId);

      // Success! Calculate metadata and return
      const totalDurationMs = Date.now() - startTime;
      const failedOver = !isPreferredProvider;
      const finalProviderName = getProviderName(attemptIndex);

      // Get circuit states for metadata
      const circuitStates = await getCircuitStates();

      const failoverMetadata: FailoverMetadata = {
        totalAttempts: actualAttemptIndex,
        preferredAttempts: preferredAttemptsMade,
        alternateAttempts: alternateAttemptsMade,
        failedOver,
        primaryProvider: preferredProviderName,
        finalProvider: finalProviderName,
        errors: failedAttempts.map(fa => ({
          provider: fa.provider,
          attempt: fa.attempt,
          error: fa.error.message,
        })),
        totalDurationMs,
        ...(circuitBreaker && {
          circuitTripped,
          circuitStates,
        }),
      };

      // Inject failover metadata into content metadata
      return {
        ...content,
        metadata: {
          ...content.metadata,
          failover: failoverMetadata,
        },
      };
    } catch (error) {
      // Record failed attempt
      // Extract provider name from error if it's an AIProviderError, otherwise use default
      const aiError = error as { provider?: string };
      const providerName = isPreferredProvider
        ? aiError.provider || preferredProviderName
        : aiError.provider || alternateProviderName;

      failedAttempts.push({
        provider: providerName,
        attempt: attemptNumber,
        error: error as Error,
        timestamp: new Date(),
      });

      // Check if error is retryable
      if (!isRetryableError(error)) {
        // Non-retryable error - throw immediately without further attempts
        throw error;
      }

      // Record failure with circuit breaker (for retryable errors)
      await recordFailure(currentCircuitId, error as Error);

      // If this was the last attempt, throw aggregated error
      if (attemptIndex === totalAttempts - 1) {
        throw new RetryExhaustedError(failedAttempts);
      }

      // Otherwise, continue to next attempt (loop will handle backoff)
    }
  }

  // This should never be reached due to throw in loop, but TypeScript needs it
  throw new RetryExhaustedError(failedAttempts);
}
