/**
 * Daily Roast Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * affectionate mockery of everyday life topics with comedic edge.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/daily-roast.txt for roast content guidance
 * - Uses MEDIUM model tier for tone calibration (nuance required)
 * - Injects random topic domain, topic, and roast format into prompts
 * - Inherits retry logic and provider failover from base class
 *
 * CRITICAL TONE GUARDRAIL:
 * Roast the SITUATION, never the viewer. The viewer should feel
 * IN ON THE JOKE, not targeted. Affectionate mockery, not mean-spirited.
 *
 * Good: "MONDAY EMAILS HIT DIFFERENT WHEN YOU HAVENT HAD COFFEE"
 * Bad: "YOURE STILL NOT A MORNING PERSON HUH"
 *
 * @example
 * ```typescript
 * const generator = new DailyRoastGenerator(
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
 * console.log(content.text); // "INBOX ZERO\nTHE MYTHICAL CREATURE\nWE ALL PRETEND EXISTS"
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
 * Topic domains for daily roasts
 *
 * Each domain contains specific topics that resonate with everyday life.
 * Topics are universal, relatable situations that everyone experiences.
 */
export const TOPIC_DOMAINS = {
  WORK_LIFE: ['meetings', 'reply-all', 'inbox zero', 'slack', 'zoom fatigue'],
  MORNING_RITUALS: ['snooze button', 'coffee dependency', 'alarm clocks'],
  TECHNOLOGY: ['passwords', 'captchas', 'updates', 'wifi', 'charging cables'],
  SOCIAL: ['small talk', 'networking', 'linkedin', 'group chats'],
  LIFESTYLE: ['gym memberships', 'meal prep', 'plants dying', 'laundry'],
  DATING: ['dating apps', 'ghosting', 'situationships', 'texting back'],
} as const;

/**
 * Roast format styles
 *
 * Each format provides a different comedic angle for the roast:
 * - OBSERVATION: Noticing an absurd truth ("Meetings that could have been emails")
 * - ACCUSATION: Calling out universal behavior ("We all do this")
 * - CONFESSION: Admitting shared guilt ("Im guilty of this too")
 * - COMPARISON: Drawing absurd parallels ("This is basically that")
 */
export const ROAST_FORMATS = ['OBSERVATION', 'ACCUSATION', 'CONFESSION', 'COMPARISON'] as const;

export type TopicDomain = keyof typeof TOPIC_DOMAINS;
export type RoastFormat = (typeof ROAST_FORMATS)[number];

/**
 * Generates daily roasts - affectionate mockery of everyday life
 *
 * Extends AIPromptGenerator with roast-specific prompts,
 * MEDIUM model tier selection for tone calibration, and
 * random topic/format injection for variety.
 */
export class DailyRoastGenerator extends AIPromptGenerator {
  /**
   * Static access to topic domains for testing
   */
  static readonly TOPIC_DOMAINS = TOPIC_DOMAINS;

  /**
   * Static access to roast formats for testing
   */
  static readonly ROAST_FORMATS = ROAST_FORMATS;

  private readonly apiKeysRef: AIProviderAPIKeys;

  /**
   * Creates a new DailyRoastGenerator instance
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
    // Use MEDIUM tier for daily roasts (tone calibration requires nuance)
    super(promptLoader, modelTierSelector, ModelTierEnum.MEDIUM, apiKeys);
    this.apiKeysRef = apiKeys;
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
   * Uses the daily-roast prompt which specifies the content type,
   * structure, and tone for affectionate everyday life mockery.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'daily-roast.txt';
  }

  /**
   * Selects a random topic domain and topic within it
   *
   * @returns Object containing the selected topicDomain and topic
   */
  selectRandomTopic(): { topicDomain: string; topic: string } {
    const domainKeys = Object.keys(TOPIC_DOMAINS) as TopicDomain[];
    const randomDomain = domainKeys[Math.floor(Math.random() * domainKeys.length)];
    const topics = TOPIC_DOMAINS[randomDomain];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    return {
      topicDomain: randomDomain,
      topic: randomTopic,
    };
  }

  /**
   * Selects a random roast format
   *
   * @returns The selected roast format
   */
  selectRandomRoastFormat(): string {
    return ROAST_FORMATS[Math.floor(Math.random() * ROAST_FORMATS.length)];
  }

  /**
   * Generates daily roast content with random topic injection
   *
   * Workflow:
   * 1. Select random topic domain and topic
   * 2. Select random roast format
   * 3. Load system and user prompts with topic variables injected
   * 4. Generate content using AI provider with failover support
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Select random topic and format
    const { topicDomain, topic } = this.selectRandomTopic();
    const roastFormat = this.selectRandomRoastFormat();

    // Step 2: Load system prompt with personality
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
      }
    );

    // Apply dimension substitution to system prompt
    const systemPrompt = this.applyDimensionSubstitution(loadedSystemPrompt);

    // Step 3: Load user prompt with topic variables injected
    const userPromptBase = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      {
        topicDomain,
        topic,
        roastFormat,
      }
    );

    // Format user prompt with context
    const userPrompt = `${userPromptBase}

CURRENT CONTEXT:
- Update Type: ${context.updateType}`;

    // Step 4: Select model and generate
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);
    let lastError: Error | null = null;

    // Build metadata (reused for both primary and failover responses)
    const baseMetadata = {
      tier: this.modelTier,
      personality,
      topicDomain,
      topic,
      roastFormat,
    };

    // Try preferred provider
    try {
      const provider = this.createProvider(selection);
      const response = await provider.generate({ systemPrompt, userPrompt });

      return {
        text: response.text,
        outputMode: 'text',
        metadata: {
          ...baseMetadata,
          model: response.model,
          provider: selection.provider,
          tokensUsed: response.tokensUsed,
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
            ...baseMetadata,
            model: response.model,
            provider: alternate.provider,
            tokensUsed: response.tokensUsed,
            failedOver: true,
            primaryError: lastError?.message,
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
    const apiKey = this.apiKeysRef[selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
