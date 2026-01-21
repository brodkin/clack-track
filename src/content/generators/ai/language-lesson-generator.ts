/**
 * Language Lesson Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * Duolingo-style micro-lessons with absurd-but-educational phrases using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/language-lesson.txt for language lesson guidance
 * - Optimized with LIGHT model tier for efficiency (simple phrases)
 * - Programmatic selection of Duolingo voice, phrase type, language, and format
 * - Supports 7 languages with romanization for non-Latin scripts
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects duolingoVoice, phraseType, language, and format
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Romanization Requirements:
 * - Chinese: Pinyin (NI HAO)
 * - Japanese: Romaji (KONNICHIWA)
 * - Russian: Transliteration (PRIVET)
 * - Czech: Without diacritics (DEKUJI)
 *
 * @example
 * ```typescript
 * const generator = new LanguageLessonGenerator(
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
 * console.log(content.text); // "SPANISH LESSON\nEL GATO ES ABOGADO\nTHE CAT IS A LAWYER"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';
import type { GenerationContext } from '../../../types/content-generator.js';

/**
 * Generates Duolingo-style micro-lessons with absurd-but-educational phrases
 *
 * Extends AIPromptGenerator with language-lesson-specific prompts
 * and efficient LIGHT model tier selection.
 * Uses programmatic selection of voice, phrase type, language, and format
 * to ensure true randomness (LLMs cannot reliably generate random selections).
 */
export class LanguageLessonGenerator extends AIPromptGenerator {
  /**
   * Duolingo character voices with distinct personalities.
   * Each voice brings a unique comedic perspective to the lessons.
   */
  static readonly DUOLINGO_VOICES: readonly string[] = [
    'LILY_GOTH_SASS',
    'OSCAR_DRAMATIC',
    'EDDY_AWKWARD',
    'ZARI_PERFECTIONIST',
    'JUNIOR_EARNEST',
    'DUO_CHAOTIC',
  ] as const;

  /**
   * Phrase type categories that define the humor style.
   * Each type creates a different flavor of absurdist content.
   */
  static readonly PHRASE_TYPES: readonly string[] = [
    'ABSURD_LITERAL',
    'PASSIVE_AGGRESSIVE',
    'EXISTENTIAL_FOOD',
    'WORKPLACE_CHAOS',
    'RELATIONSHIP_DRAMA',
    'SELF_AWARE',
  ] as const;

  /**
   * Supported languages for micro-lessons.
   * Non-Latin scripts (Chinese, Japanese, Russian) require romanization.
   * Czech requires diacritic removal.
   */
  static readonly LANGUAGES: readonly string[] = [
    'SPANISH',
    'FRENCH',
    'GERMAN',
    'CHINESE',
    'JAPANESE',
    'RUSSIAN',
    'CZECH',
  ] as const;

  /**
   * Output formats for the lesson.
   * PHRASE_TRANSLATION: Shows phrase and translation (only format - fill-the-blank removed due to Vestaboard character constraints)
   */
  static readonly FORMATS: readonly string[] = ['PHRASE_TRANSLATION'] as const;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedVoice: string = '';
  private selectedPhraseType: string = '';
  private selectedLanguage: string = '';
  private selectedFormat: string = '';

  /**
   * Programmatically selects a random Duolingo voice.
   * Uses Math.random() for true randomness.
   *
   * @returns A randomly selected voice string
   */
  static selectDuolingoVoice(): string {
    const index = Math.floor(Math.random() * LanguageLessonGenerator.DUOLINGO_VOICES.length);
    return LanguageLessonGenerator.DUOLINGO_VOICES[index];
  }

  /**
   * Programmatically selects a random phrase type.
   * Uses Math.random() for true randomness.
   *
   * @returns A randomly selected phrase type string
   */
  static selectPhraseType(): string {
    const index = Math.floor(Math.random() * LanguageLessonGenerator.PHRASE_TYPES.length);
    return LanguageLessonGenerator.PHRASE_TYPES[index];
  }

  /**
   * Programmatically selects a random language.
   * Uses Math.random() for true randomness.
   *
   * @returns A randomly selected language string
   */
  static selectLanguage(): string {
    const index = Math.floor(Math.random() * LanguageLessonGenerator.LANGUAGES.length);
    return LanguageLessonGenerator.LANGUAGES[index];
  }

  /**
   * Programmatically selects a random format.
   * Uses Math.random() for true randomness.
   *
   * @returns A randomly selected format string
   */
  static selectFormat(): string {
    const index = Math.floor(Math.random() * LanguageLessonGenerator.FORMATS.length);
    return LanguageLessonGenerator.FORMATS[index];
  }

  /**
   * Creates a new LanguageLessonGenerator instance
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
    // Use LIGHT tier for language lessons (simple content, fast and cheap)
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
   * Uses the language-lesson prompt which specifies the content type,
   * structure, and tone for Duolingo-style micro-lessons.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'language-lesson.txt';
  }

  /**
   * Hook: Selects random values and returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with duolingoVoice, phraseType, language, and format
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedVoice = LanguageLessonGenerator.selectDuolingoVoice();
    this.selectedPhraseType = LanguageLessonGenerator.selectPhraseType();
    this.selectedLanguage = LanguageLessonGenerator.selectLanguage();
    this.selectedFormat = LanguageLessonGenerator.selectFormat();

    return {
      duolingoVoice: this.selectedVoice,
      phraseType: this.selectedPhraseType,
      language: this.selectedLanguage,
      format: this.selectedFormat,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with all selected values
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedVoice: this.selectedVoice,
      selectedPhraseType: this.selectedPhraseType,
      selectedLanguage: this.selectedLanguage,
      selectedFormat: this.selectedFormat,
    };
  }
}
