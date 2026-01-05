/**
 * Shower Thought Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * philosophical musings and "wait, why IS that?" moments using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/shower-thought.txt for shower thought guidance
 * - Optimized with LIGHT model tier for efficiency (simple thoughts)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new ShowerThoughtGenerator(
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
 * console.log(content.text); // "DO FISH KNOW\nTHEY'RE WET\nOR IS THAT JUST LIFE"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates philosophical shower thoughts and oddly profound musings
 *
 * Extends AIPromptGenerator with shower-thought-specific prompts
 * and efficient LIGHT model tier selection.
 */
export class ShowerThoughtGenerator extends AIPromptGenerator {
  /**
   * Creates a new ShowerThoughtGenerator instance
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
    // Use LIGHT tier for shower thoughts (simple content, fast and cheap)
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
   * Uses the shower thought prompt which specifies the content type,
   * structure, and tone for philosophical musings.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'shower-thought.txt';
  }
}
