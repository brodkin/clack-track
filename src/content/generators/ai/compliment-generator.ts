/**
 * Compliment Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * genuine compliments and affirmations directed at the viewer.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/compliment.txt for compliment content guidance
 * - Topic and style dictionaries for high-effectiveness variability
 * - Random topic/style injection via {{topic}} and {{style}} template variables
 * - Optimized with LIGHT model tier for efficiency (simple messages)
 * - Uses second-person voice ('you') for direct, personal connection
 * - Wholesome, uplifting tone - occasionally cheeky but always kind
 * - Inherits retry logic and provider failover from base class
 *
 * Variability System:
 * - COMPLIMENT_TOPICS (20+ items): What to compliment (e.g., "your energy today")
 * - COMPLIMENT_STYLES (8+ items): How to deliver it (e.g., "sincere", "over-the-top dramatic")
 * - Random selection ensures varied outputs across generations
 *
 * @example
 * ```typescript
 * const generator = new ComplimentGenerator(
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
 * console.log(content.text); // "HEY YOU\nYOU'RE DOING GREAT\nKEEP IT UP CHAMP"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions } from '../../personality/index.js';
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';
import { ModelTier } from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

/**
 * Topics/subjects to compliment the viewer about
 *
 * Covers diverse areas: personality, abilities, presence, effort, taste, impact
 * Each topic should work naturally in the phrase "compliment about [topic]"
 */
export const COMPLIMENT_TOPICS: readonly string[] = [
  // Personality & Vibe
  'your energy today',
  'your positive attitude',
  'your unique vibe',
  'your contagious smile',
  'your calm presence',

  // Abilities & Skills
  'your creativity',
  'your problem-solving skills',
  'your hustle and work ethic',
  'your attention to detail',
  'your ability to stay focused',

  // Taste & Style
  'your taste in music',
  'your fashion sense',
  'your home decor choices',
  'your excellent taste in friends',
  'your playlist selections',

  // Impact & Presence
  'the way you light up a room',
  'your impact on others',
  'how you make people feel welcome',
  'your thoughtful gestures',
  'the effect you have on the mood',

  // Effort & Growth
  'how hard you work',
  'your dedication to improvement',
  'the progress you have made',
  'your resilience through challenges',
  'your commitment to your goals',
] as const;

/**
 * Delivery styles for compliments
 *
 * Controls the tone and approach - from sincere to absurdist
 * Each style creates a distinctly different feel for the compliment
 */
export const COMPLIMENT_STYLES: readonly string[] = [
  'sincere and heartfelt',
  'over-the-top dramatic',
  'poetic and lyrical',
  'absurdist but endearing',
  'casual and breezy',
  'hype man energy',
  'gentle and encouraging',
  'playfully exaggerated',
  'warm and cozy',
  'confidently matter-of-fact',
] as const;

/**
 * Generates genuine compliments and affirmations for the viewer
 *
 * Extends AIPromptGenerator with compliment-specific prompts,
 * efficient LIGHT model tier selection, and variability dictionaries.
 * Uses second-person voice for a direct, personal connection with the reader.
 *
 * Injects random {{topic}} and {{style}} via template variables to ensure
 * each generation produces meaningfully different content.
 */
export class ComplimentGenerator extends AIPromptGenerator {
  /**
   * Creates a new ComplimentGenerator instance
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
    // Use LIGHT tier for compliments (simple content, fast and cheap)
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
   * Uses the compliment prompt which specifies the content type,
   * structure, and tone for genuine, uplifting compliments.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'compliment.txt';
  }

  /**
   * Selects a random topic from the COMPLIMENT_TOPICS dictionary
   *
   * @returns A randomly selected compliment topic
   */
  selectRandomTopic(): string {
    const index = Math.floor(Math.random() * COMPLIMENT_TOPICS.length);
    return COMPLIMENT_TOPICS[index];
  }

  /**
   * Selects a random style from the COMPLIMENT_STYLES dictionary
   *
   * @returns A randomly selected compliment style
   */
  selectRandomStyle(): string {
    const index = Math.floor(Math.random() * COMPLIMENT_STYLES.length);
    return COMPLIMENT_STYLES[index];
  }

  /**
   * Generates compliment content with topic and style variability injection
   *
   * Workflow:
   * 1. Select random topic and style from dictionaries
   * 2. Load prompts with topic/style injected via template variables
   * 3. Generate content using AI provider with failover support
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Select random topic and style for variability
    const selectedTopic = this.selectRandomTopic();
    const selectedStyle = this.selectRandomStyle();

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

    // Apply dimension substitution (maxChars, maxLines) to system prompt
    const systemPrompt = this.applyDimensionSubstitution(loadedSystemPrompt);

    // Step 3: Load user prompt with topic and style injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      {
        topic: selectedTopic,
        style: selectedStyle,
      }
    );

    // Step 4: Select model and generate
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);
    let lastError: Error | null = null;

    // Build base metadata
    const baseMetadata = {
      tier: this.modelTier,
      personality,
      systemPrompt,
      userPrompt,
      selectedTopic,
      selectedStyle,
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
  private createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this['apiKeys'][selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
