/**
 * Fortune Cookie Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * fortune cookie wisdom with a twist using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/fortune-cookie.txt for fortune cookie content guidance
 * - Optimized with LIGHT model tier for efficiency (simple fortunes)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new FortuneCookieGenerator(
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
 * console.log(content.text); // "FORTUNE COOKIE SAY\nYOUR LUCKY NUMBER IS\nPROBABLY NOT 7"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates fortune cookie wisdom with a twist
 *
 * Extends AIPromptGenerator with fortune-cookie-specific prompts
 * and efficient LIGHT model tier selection.
 */
export class FortuneCookieGenerator extends AIPromptGenerator {
  /**
   * Creates a new FortuneCookieGenerator instance
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
    // Use LIGHT tier for fortune cookies (simple content, fast and cheap)
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
   * Uses the fortune-cookie prompt which specifies the content type,
   * structure, and tone for clever fortune cookie messages.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'fortune-cookie.txt';
  }
}
