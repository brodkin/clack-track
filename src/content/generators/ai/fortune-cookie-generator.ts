/**
 * Fortune Cookie Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * fortune cookie wisdom with a twist using AI, with programmatic title injection.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/fortune-cookie.txt for fortune cookie content guidance
 * - Programmatic title injection: prepends "FORTUNE COOKIE" with color bars
 * - AI generates 3 lines of fortune wisdom + 1 line of lucky numbers (4 total)
 * - Final output: 5 lines (title + 3 fortune lines + lucky numbers)
 * - Centered text alignment for classic fortune cookie aesthetic
 * - Optimized with LIGHT model tier for efficiency (simple fortunes)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getCustomMetadata(): Adds titleInjected and formatOptions to metadata
 * - postProcessContent(): Prepends programmatic title line to AI content
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
 * // Output structure (5 lines):
 * // Line 1: FORTUNE COOKIE (programmatic title with color bars)
 * // Lines 2-4: AI-generated fortune wisdom
 * // Line 5: AI-generated lucky numbers
 * console.log(content.text);
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GeneratedContent } from '../../../types/content-generator.js';

/**
 * Programmatic title for fortune cookie content.
 * Uses red color bars for visual emphasis on Vestaboard display.
 */
const FORTUNE_COOKIE_TITLE = '\uD83D\uDFE5 FORTUNE COOKIE \uD83D\uDFE5';

/**
 * Generates fortune cookie wisdom with a twist
 *
 * Extends AIPromptGenerator with fortune-cookie-specific prompts,
 * efficient LIGHT model tier selection, and programmatic title injection.
 *
 * Uses the postProcessContent hook to prepend a title line to the
 * AI-generated content, ensuring consistent formatting with center alignment.
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

  /**
   * Hook: Returns metadata indicating title was injected with center alignment.
   *
   * @returns Metadata with titleInjected flag and formatOptions
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      titleInjected: true,
      formatOptions: {
        textAlign: 'center',
      },
    };
  }

  /**
   * Hook: Prepends programmatic title line to AI-generated content.
   *
   * Output structure (5 lines total):
   * - Line 1: Programmatic title with color bars
   * - Lines 2-4: AI-generated fortune wisdom
   * - Line 5: AI-generated lucky numbers
   *
   * @param content - AI-generated content (3 lines fortune + 1 line lucky numbers)
   * @returns Content with title prepended and center alignment
   */
  protected postProcessContent(content: GeneratedContent): GeneratedContent {
    // Prepend programmatic title to AI content
    const combinedText = `${FORTUNE_COOKIE_TITLE}\n${content.text}`;

    return {
      ...content,
      text: combinedText,
    };
  }
}
