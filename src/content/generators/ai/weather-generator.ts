/**
 * Weather Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * weather-focused content using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/weather-focus.txt for weather content guidance
 * - Optimized with LIGHT model tier for efficiency (weather info is straightforward)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new WeatherGenerator(
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
 * console.log(content.text); // "SUNNY 72°F\nPERFECT DAY AHEAD..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates weather-focused content
 *
 * Extends AIPromptGenerator with weather-specific prompts
 * and efficient LIGHT model tier selection.
 */
export class WeatherGenerator extends AIPromptGenerator {
  /**
   * Creates a new WeatherGenerator instance
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
    // Use LIGHT tier for weather content (straightforward info, fast and cheap)
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
   * Uses the weather-focus prompt which specifies the content type,
   * structure, and tone for weather-focused content.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'weather-focus.txt';
  }
}
