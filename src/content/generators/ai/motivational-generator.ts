/**
 * Motivational Quote Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * inspiring motivational messages using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/motivational.txt for motivational content guidance
 * - Optimized with LIGHT model tier for efficiency (simple quotes)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new MotivationalGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date().toISOString(),
 *   timezone: 'America/New_York'
 * });
 *
 * console.log(content.text); // "BELIEVE IN YOURSELF\nEVERY DAY IS A..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates motivational quotes and inspiring messages
 *
 * Extends AIPromptGenerator with motivational-specific prompts
 * and efficient LIGHT model tier selection.
 */
export class MotivationalGenerator extends AIPromptGenerator {
  /**
   * Creates a new MotivationalGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    // Use LIGHT tier for motivational quotes (simple content, fast and cheap)
    super(promptLoader, modelTierSelector, ModelTier.LIGHT, apiKeys);
  }

  /**
   * Returns the filename for the system prompt
   *
   * Uses the major update base prompt which provides general
   * Vestaboard formatting constraints and creative guidelines.
   *
   * @returns Filename of the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt
   *
   * Uses the motivational prompt which specifies the content type,
   * structure, and tone for inspiring messages.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'motivational.txt';
  }
}
