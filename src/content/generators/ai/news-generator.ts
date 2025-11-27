/**
 * News Summary Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * news summaries using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/news-summary.txt for news content guidance
 * - Optimized with MEDIUM model tier for complex summarization
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new NewsGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   updateType: 'major',
 *   timestamp: new Date(),
 *   timezone: 'America/New_York'
 * });
 *
 * console.log(content.text); // "TECH STOCKS RALLY\nMARKETS UP 2.5%..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates news summaries from current events
 *
 * Extends AIPromptGenerator with news-specific prompts
 * and MEDIUM model tier selection for better summarization quality.
 */
export class NewsGenerator extends AIPromptGenerator {
  /**
   * Creates a new NewsGenerator instance
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
    // Use MEDIUM tier for news summaries (more complex than simple quotes, needs better model)
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys);
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
   * Uses the news-summary prompt which specifies the content type,
   * structure, and tone for news summaries.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'news-summary.txt';
  }
}
