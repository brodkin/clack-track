/**
 * Word of the Day Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * vocabulary-building content with witty Houseboy-style usage examples.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/word-of-the-day.txt for word content guidance
 * - Randomly selects word domain, vibe, and style for variety
 * - Optimized with LIGHT model tier for efficiency (simple content)
 * - Inherits retry logic and provider failover from base class
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
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions } from '../../personality/index.js';
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

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
   * Generates word of the day content with random dictionary injection
   *
   * Workflow:
   * 1. Select random wordDomain, wordVibe, and style for variety
   * 2. Load prompts with dictionary selections injected via template variables
   * 3. Generate content using AI provider with failover support
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Select random dictionary values
    const wordDomain = this.selectRandom(WORD_DOMAIN);
    const wordVibe = this.selectRandom(WORD_VIBE);

    // Step 2: Load system prompt with personality
    const personality = context.personality ?? generatePersonalityDimensions();
    const systemPrompt = await this.promptLoader.loadPromptWithVariables(
      'system',
      this.getSystemPromptFile(),
      {
        mood: personality.mood,
        energyLevel: personality.energyLevel,
        humorStyle: personality.humorStyle,
        obsession: personality.obsession,
        persona: 'Houseboy',
      }
    );

    // Step 3: Load user prompt with dictionary selections injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      { wordDomain, wordVibe }
    );

    // If promptsOnly mode, return just the prompts without AI call
    // This is used by ToolBasedGenerator to get prompts for its own AI call with tools
    if (context.promptsOnly) {
      return {
        text: '',
        outputMode: 'text',
        metadata: {
          tier: this.modelTier,
          personality,
          systemPrompt,
          userPrompt,
          wordDomain,
          wordVibe,
        },
      };
    }

    // Step 4: Select model and generate
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
          wordDomain,
          wordVibe,
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
            wordDomain,
            wordVibe,
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
  protected createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this['apiKeys'][selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
