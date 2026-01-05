/**
 * Compliment Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * genuine compliments and affirmations directed at the viewer.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/compliment.txt for compliment content guidance
 * - Optimized with LIGHT model tier for efficiency (simple messages)
 * - Uses second-person voice ('you') for direct, personal connection
 * - Wholesome, uplifting tone - occasionally cheeky but always kind
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new ComplimentGenerator(
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
 * console.log(content.text); // "HEY YOU\nYOU'RE DOING GREAT\nKEEP IT UP CHAMP"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates genuine compliments and affirmations for the viewer
 *
 * Extends AIPromptGenerator with compliment-specific prompts
 * and efficient LIGHT model tier selection. Uses second-person
 * voice for a direct, personal connection with the reader.
 */
export class ComplimentGenerator extends AIPromptGenerator {
  /**
   * Creates a new ComplimentGenerator instance
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
    // Use LIGHT tier for compliments (simple content, fast and cheap)
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
   * Uses the compliment prompt which specifies the content type,
   * structure, and tone for genuine, uplifting compliments.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'compliment.txt';
  }
}
