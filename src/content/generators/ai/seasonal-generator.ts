/**
 * Seasonal Generator
 *
 * Generates seasonally appropriate content - holiday greetings,
 * seasonal jokes, or inspiring thoughts based on the current date.
 *
 * Uses the date from system prompt context to determine appropriate content.
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates seasonal content (holidays, seasons, special dates)
 *
 * Extends AIPromptGenerator with seasonal-specific prompts
 * and efficient LIGHT model tier selection.
 */
export class SeasonalGenerator extends AIPromptGenerator {
  /**
   * Creates a new SeasonalGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    // Use LIGHT tier for seasonal content (simple creative content)
    super(promptLoader, modelTierSelector, ModelTier.LIGHT, apiKeys);
  }

  /**
   * Returns the filename for the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt
   */
  protected getUserPromptFile(): string {
    return 'seasonal.txt';
  }
}
