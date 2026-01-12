/**
 * Countdown Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * countdown messages to upcoming events (holidays, weekends, payday, etc.).
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/countdown.txt for countdown content guidance
 * - Relies on {{date}} template variable (provided by base class) for calculations
 * - Optimized with LIGHT model tier for efficiency (simple countdown messages)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new CountdownGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date(),
 *   timezone: 'America/New_York'
 * });
 *
 * console.log(content.text); // "ONLY 3 DAYS UNTIL\nFRIDAY\nHOLD ON TIGHT"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates countdown messages to upcoming events
 *
 * Extends AIPromptGenerator with countdown-specific prompts
 * and efficient LIGHT model tier selection. Uses the current date
 * (available via {{date}} template variable) to calculate days
 * until various upcoming events.
 */
export class CountdownGenerator extends AIPromptGenerator {
  /**
   * Creates a new CountdownGenerator instance
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
    // Use LIGHT tier for countdown content (simple content, fast and cheap)
    super(promptLoader, modelTierSelector, ModelTier.LIGHT, apiKeys);
  }

  /**
   * Returns the filename for the system prompt
   *
   * Uses the major update base prompt which provides general
   * Vestaboard formatting constraints, creative guidelines, and
   * the current date via {{date}} template variable.
   *
   * @returns Filename of the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt
   *
   * Uses the countdown prompt which specifies instructions for
   * generating countdown messages to upcoming events, using the
   * current date to calculate days remaining.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'countdown.txt';
  }
}
