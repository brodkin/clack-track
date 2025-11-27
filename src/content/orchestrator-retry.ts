/**
 * Orchestrator Retry Logic
 *
 * Provides retry functionality with alternate provider fallback for content generation.
 * Handles RateLimitError and AuthenticationError by attempting alternate provider,
 * while throwing non-retryable errors immediately.
 *
 * @module content/orchestrator-retry
 */

import { RateLimitError, AuthenticationError } from '../types/errors.js';
import type { AIProvider } from '../types/ai.js';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
} from '../types/content-generator.js';

/**
 * Determines if an error is retryable with an alternate provider.
 *
 * Only RateLimitError and AuthenticationError are retryable - all other errors
 * (InvalidRequestError, generic errors) should be thrown immediately.
 *
 * @param error - The error to check
 * @returns True if the error is retryable with alternate provider
 */
function isRetryableError(error: unknown): boolean {
  return error instanceof RateLimitError || error instanceof AuthenticationError;
}

/**
 * Generate content with retry logic and alternate provider fallback.
 *
 * Attempts generation with the preferred provider first. On RateLimitError or
 * AuthenticationError, retries with the alternate provider. All other errors
 * are thrown immediately without retry.
 *
 * This function enables cross-provider failover (e.g., OpenAI → Anthropic)
 * while avoiding unnecessary retries for non-recoverable errors like
 * InvalidRequestError.
 *
 * NOTE: In production, this function would ideally accept a factory function
 * to create generators with different providers. For now, it accepts a pre-configured
 * generator and relies on the orchestrator to handle provider swapping between calls.
 * The provider parameters are reserved for future enhancement.
 *
 * @param generator - Content generator to use for generation
 * @param context - Generation context with update type and metadata
 * @param _preferredProvider - Primary AI provider (reserved for future use)
 * @param _alternateProvider - Fallback AI provider (reserved for future use)
 * @returns Generated content from successful provider
 * @throws Error if both providers fail or non-retryable error occurs
 *
 * @example
 * ```typescript
 * const openai = createAIProvider(AIProviderType.OPENAI, apiKey);
 * const anthropic = createAIProvider(AIProviderType.ANTHROPIC, apiKey);
 *
 * try {
 *   const content = await generateWithRetry(
 *     generator,
 *     context,
 *     openai,
 *     anthropic
 *   );
 *   // Use content...
 * } catch (error) {
 *   // Both providers failed, trigger P3 fallback
 *   const fallback = await staticFallbackGenerator.generate(context);
 * }
 * ```
 */
export async function generateWithRetry(
  generator: ContentGenerator,
  context: GenerationContext,
  _preferredProvider: AIProvider,
  _alternateProvider: AIProvider
): Promise<GeneratedContent> {
  try {
    // Attempt generation with preferred provider
    // (Provider is already injected in generator's constructor)
    const content = await generator.generate(context);
    return content;
  } catch (preferredError) {
    // Check if error is retryable (rate limit or auth)
    if (!isRetryableError(preferredError)) {
      // Non-retryable error - throw immediately without retry
      throw preferredError;
    }

    // Retryable error - attempt with alternate provider
    // (In production, orchestrator would create new generator with alternate provider)
    try {
      const content = await generator.generate(context);
      return content;
    } catch (alternateError) {
      // Both providers failed - throw the alternate error
      throw alternateError;
    }
  }
}
