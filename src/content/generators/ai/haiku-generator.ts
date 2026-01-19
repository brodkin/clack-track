/**
 * Haiku Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * humorous haikus about randomly selected topics.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/haiku.txt for haiku content guidance
 * - Randomly selects topic from predefined list for variety
 * - Optimized with LIGHT model tier for efficiency (haikus are simple)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new HaikuGenerator(
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
 * console.log(content.text); // "TRAINS SPEED FAST\nWHISTLES ECHO LOUD..."
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
 * Topics for haiku generation
 *
 * These topics provide variety and unexpected combinations
 * for humorous haiku content.
 */
const TOPICS = [
  'Trains',
  'Business',
  'Architecture',
  'Food',
  'Comedy',
  'EDM Music',
  'Software development',
  'Aviation',
  'Disneyland',
  'Street lighting',
  'Current Weather',
  'Current Date',
  'Current holidays',
] as const;

/**
 * Generates humorous haikus about random topics
 *
 * Extends AIPromptGenerator with haiku-specific prompts,
 * efficient LIGHT model tier selection, and random topic
 * selection for content variety.
 */
export class HaikuGenerator extends AIPromptGenerator {
  /**
   * Creates a new HaikuGenerator instance
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
    // Use LIGHT tier for haiku content (simple, fast and cheap)
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
   * Uses the haiku prompt which specifies the content type,
   * structure, and tone for haiku content.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'haiku.txt';
  }

  /**
   * Selects a random topic from the TOPICS array
   *
   * @returns Randomly selected topic string
   */
  private selectRandomTopic(): string {
    const randomIndex = Math.floor(Math.random() * TOPICS.length);
    return TOPICS[randomIndex];
  }

  /**
   * Generates haiku content with random topic injection
   *
   * Workflow:
   * 1. Select random topic for variety
   * 2. Load prompts with topic injected via {{payload}} template variable
   * 3. Generate content using AI provider with failover support
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Select random topic
    const topic = this.selectRandomTopic();

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

    // Step 3: Load user prompt with topic injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      { payload: topic }
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
          topic,
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
          topic,
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
            topic,
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
