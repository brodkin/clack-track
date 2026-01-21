/**
 * Word of the Day Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * vocabulary-building content with witty Houseboy-style usage examples.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/word-of-the-day.txt for word content guidance
 * - Randomly selects word domain and vibe for variety
 * - Optimized with LIGHT model tier for efficiency (simple content)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects wordDomain and wordVibe into prompt
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * @example
 * ```typescript
 * const generator = new WordOfTheDayGenerator(
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
 * console.log(content.text); // "WORD OF THE DAY\nSAUNTER\nLEISURELY WALK\n..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Word domains for vocabulary selection
 *
 * These domains provide thematic variety for word choices.
 */
const WORD_DOMAIN = [
  'EMOTION_WORDS',
  'SITUATION_WORDS',
  'RELATIONSHIP_WORDS',
  'WORK_WORDS',
  'NATURE_WORDS',
  'FOREIGN_LOANWORDS',
] as const;

/**
 * Word vibes for vocabulary selection
 *
 * These vibes describe the feel of the word itself.
 */
const WORD_VIBE = [
  'SATISFYING_TO_SAY',
  'SURPRISINGLY_USEFUL',
  'OBSCURE_BUT_RELATABLE',
  'COMEBACK_WORTHY',
] as const;

/**
 * Generates Word of the Day vocabulary content
 *
 * Extends AIPromptGenerator with word-of-the-day-specific prompts,
 * efficient LIGHT model tier selection, and random dictionary
 * selection for content variety.
 */
export class WordOfTheDayGenerator extends AIPromptGenerator {
  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedWordDomain: string = '';
  private selectedWordVibe: string = '';

  /**
   * Creates a new WordOfTheDayGenerator instance
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
    // Use LIGHT tier for word of the day content (simple, fast and cheap)
    super(promptLoader, modelTierSelector, ModelTierEnum.LIGHT, apiKeys);
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
   * Uses the word-of-the-day prompt which specifies the content type,
   * structure, and tone for vocabulary content.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'word-of-the-day.txt';
  }

  /**
   * Selects a random item from an array
   *
   * @param array - Array to select from
   * @returns Randomly selected item
   */
  private selectRandom<T>(array: readonly T[]): T {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }

  /**
   * Hook: Selects random wordDomain and wordVibe, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with wordDomain and wordVibe
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedWordDomain = this.selectRandom(WORD_DOMAIN);
    this.selectedWordVibe = this.selectRandom(WORD_VIBE);

    return {
      wordDomain: this.selectedWordDomain,
      wordVibe: this.selectedWordVibe,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with wordDomain and wordVibe
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      wordDomain: this.selectedWordDomain,
      wordVibe: this.selectedWordVibe,
    };
  }
}
