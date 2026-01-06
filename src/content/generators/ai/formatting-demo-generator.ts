/**
 * Formatting Demo Generator
 *
 * A sample generator that demonstrates the new GeneratorFormatOptions system.
 * This generator serves as both documentation and integration test for:
 *
 * - Custom maxLines (3 lines instead of default 5)
 * - Custom maxCharsPerLine (18 chars instead of default 21)
 * - Left text alignment
 * - Word-wrap disabled
 *
 * The reduced dimensions leave room for visual elements like borders,
 * decorations, or icons around the main content area.
 *
 * Features:
 * - Uses prompts/system/formatting-demo.txt with {{maxChars}} and {{maxLines}} substitution
 * - Uses prompts/user/formatting-demo.txt for demo content guidance
 * - Optimized with LIGHT model tier for efficiency (simple content)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new FormattingDemoGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date(),
 *   updateType: 'major'
 * });
 *
 * // Content will be formatted for 3 lines x 18 chars
 * console.log(content.text); // "SHORT MESSAGE\nFITS NICELY\nIN THREE LINES"
 * console.log(content.metadata?.formatOptions); // { maxLines: 3, maxCharsPerLine: 18, ... }
 * ```
 *
 * @module content/generators/ai/formatting-demo-generator
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GeneratorFormatOptions } from '../../../types/content-generator.js';

/**
 * Demo formatting options showcasing reduced dimensions.
 *
 * These values demonstrate the new formatting system:
 * - maxLines: 3 (reduced from default 5) - leaves room for frame decoration
 * - maxCharsPerLine: 18 (reduced from default 21) - leaves room for side margins
 * - textAlign: 'left' - left-aligned text (demonstrates alignment option)
 * - wordWrap: false - no automatic word wrapping (demonstrates wrap control)
 */
const DEMO_FORMAT_OPTIONS: GeneratorFormatOptions = {
  maxLines: 3,
  maxCharsPerLine: 18,
  textAlign: 'left',
  wordWrap: false,
};

/**
 * Generates demo content showcasing custom formatting options.
 *
 * This generator demonstrates the new GeneratorFormatOptions feature
 * introduced in the formatting system. It uses reduced dimensions
 * (3 lines x 18 chars) with left alignment and no word wrap.
 *
 * Extends AIPromptGenerator with:
 * - Custom system prompt that uses {{maxChars}} and {{maxLines}} placeholders
 * - Custom user prompt for demo-specific content
 * - LIGHT model tier for efficiency
 * - formatOptions configuration for the pipeline
 */
export class FormattingDemoGenerator extends AIPromptGenerator {
  /**
   * Creates a new FormattingDemoGenerator instance
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
    // Use LIGHT tier for demo content (simple, fast and cheap)
    // Pass formatOptions to base class for DimensionSubstitutor integration
    super(promptLoader, modelTierSelector, ModelTier.LIGHT, apiKeys, DEMO_FORMAT_OPTIONS);
  }

  /**
   * Returns the filename for the system prompt
   *
   * Uses a custom demo system prompt that includes {{maxChars}} and {{maxLines}}
   * placeholders, which will be substituted with the reduced dimensions (18, 3).
   *
   * @returns Filename of the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'formatting-demo.txt';
  }

  /**
   * Returns the filename for the user prompt
   *
   * Uses a custom demo user prompt that guides the AI to create
   * short, punchy content suitable for the reduced dimensions.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'formatting-demo.txt';
  }
}
