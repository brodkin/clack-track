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
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions } from '../../personality/index.js';
import { ModelTier } from '../../../types/content-generator.js';
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

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
   * Generates language lesson content with programmatic selection of variables.
   *
   * Overrides the base class generate() to:
   * 1. Select a random Duolingo voice
   * 2. Select a random phrase type
   * 3. Select a random language
   * 4. Select a random format
   * 5. Inject all four as template variables into the user prompt
   *
   * This ensures true randomness in selection, unlike asking the LLM
   * to "randomly select" which exhibits predictable bias.
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Programmatically select all variables
    const selectedVoice = LanguageLessonGenerator.selectDuolingoVoice();
    const selectedPhraseType = LanguageLessonGenerator.selectPhraseType();
    const selectedLanguage = LanguageLessonGenerator.selectLanguage();
    const selectedFormat = LanguageLessonGenerator.selectFormat();

    // Step 2: Load system prompt with personality and date context
    const personality = context.personality ?? generatePersonalityDimensions();
    const loadedSystemPrompt = await this.promptLoader.loadPromptWithVariables(
      'system',
      this.getSystemPromptFile(),
      {
        mood: personality.mood,
        energyLevel: personality.energyLevel,
        humorStyle: personality.humorStyle,
        obsession: personality.obsession,
        persona: 'Houseboy',
        // Include date template variable following AIPromptGenerator.buildTemplateVariables() pattern
        date: context.timestamp.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      }
    );

    // Step 3: Apply dimension substitution (maxChars, maxLines) to system prompt
    const systemPrompt = this.applyDimensionSubstitution(loadedSystemPrompt);

    // Step 4: Load user prompt with all four variables injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      {
        duolingoVoice: selectedVoice,
        phraseType: selectedPhraseType,
        language: selectedLanguage,
        format: selectedFormat,
      }
    );

    // Step 5: Select model and generate
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);
    let lastError: Error | null = null;

    // Try preferred provider
    try {
      const provider = this.createProvider(selection);
      const response = await provider.generate({ systemPrompt, userPrompt });

      return {
        text: response.text,
        outputMode: 'text',
        metadata: {
          model: response.model,
          tier: this.modelTier,
          provider: selection.provider,
          tokensUsed: response.tokensUsed,
          personality,
          selectedVoice,
          selectedPhraseType,
          selectedLanguage,
          selectedFormat,
        },
      };
    } catch (error) {
      lastError = error as Error;
    }

    // Try alternate provider
    const alternate = this.modelTierSelector.getAlternate(selection);
    if (alternate) {
      try {
        const alternateProvider = this.createProvider(alternate);
        const response = await alternateProvider.generate({ systemPrompt, userPrompt });

        return {
          text: response.text,
          outputMode: 'text',
          metadata: {
            model: response.model,
            tier: this.modelTier,
            provider: alternate.provider,
            tokensUsed: response.tokensUsed,
            failedOver: true,
            primaryError: lastError?.message,
            personality,
            selectedVoice,
            selectedPhraseType,
            selectedLanguage,
            selectedFormat,
          },
        };
      } catch (alternateError) {
        lastError = alternateError as Error;
      }
    }

    throw new Error(`All AI providers failed for tier ${this.modelTier}: ${lastError?.message}`);
  }

  /**
   * Creates an AI provider instance for the given selection
   */
  private createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this['apiKeys'][selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
