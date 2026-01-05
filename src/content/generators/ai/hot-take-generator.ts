/**
 * Hot Take Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * playful, cheeky opinions on mundane everyday topics.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/hot-take.txt for hot take content guidance
 * - Optimized with LIGHT model tier for efficiency (simple opinions)
 * - Inherits retry logic and provider failover from base class
 *
 * Topics are intentionally trivial (food preferences, daily habits,
 * minor life choices) to keep takes playful and harmless. The tone
 * is confident and bold but never mean-spirited or actually controversial.
 *
 * @example
 * ```typescript
 * const generator = new HotTakeGenerator(
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
 * console.log(content.text); // "PINEAPPLE ON PIZZA\nIS NOT JUST ACCEPTABLE\nIT'S SUPERIOR"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates playful hot takes on mundane topics
 *
 * Extends AIPromptGenerator with hot-take-specific prompts
 * and efficient LIGHT model tier selection.
 */
export class HotTakeGenerator extends AIPromptGenerator {
  /**
   * Creates a new HotTakeGenerator instance
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
    // Use LIGHT tier for hot takes (simple content, fast and cheap)
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
   * Uses the hot-take prompt which specifies the content type,
   * structure, and playful tone for spicy mundane opinions.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'hot-take.txt';
  }
}
