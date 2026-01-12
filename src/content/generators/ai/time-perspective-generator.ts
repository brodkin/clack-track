/**
 * Time Perspective Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * temporal reframing content through various psychological lenses using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/time-perspective.txt for time perspective guidance
 * - Uses MEDIUM model tier for nuanced psychological reframing
 * - Programmatic lens selection from 5 curated temporal perspectives
 * - Programmatic stress context selection from 20+ relatable situations
 * - Time-of-day bucket for contextual relevance
 * - Inherits retry logic and provider failover from base class
 *
 * Time perspective content aims to reframe current stressors through
 * temporal shifts - viewing situations from cosmic, absurdist, ancestral,
 * connected, or future-self perspectives. The goal is providing genuine
 * perspective shifts, not platitudes.
 *
 * Variability: 5 lenses x 20+ contexts x 4 time buckets = 400+ combinations
 *
 * @example
 * ```typescript
 * const generator = new TimePerspectiveGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date(),
 *   timezone: 'America/New_York'
 * });
 *
 * console.log(content.text); // "IN 10000 YEARS\nNO ONE WILL REMEMBER\nTHAT MEETING YOU DREAD"
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
 * Time bucket representing different parts of the day
 */
type TimeBucket = 'NIGHT' | 'MORNING' | 'AFTERNOON' | 'EVENING';

/**
 * Generates temporal reframing content through various psychological lenses
 *
 * Extends AIPromptGenerator with time-perspective-specific prompts
 * and MEDIUM model tier selection for nuanced psychological reframing.
 * Uses programmatic selection to ensure true randomness in lens and
 * stress context choices (LLMs cannot reliably generate random selections).
 */
export class TimePerspectiveGenerator extends AIPromptGenerator {
  /**
   * Five temporal perspective lenses for reframing stress.
   * Each lens provides a different angle on the current situation:
   *
   * - COSMIC: Vast time scales (billions of years, universe's age)
   * - ABSURDIST: Embracing life's inherent meaninglessness with humor
   * - ANCESTOR: Wisdom from those who came before
   * - CONNECTION: The web of human experience across time
   * - FUTURE_SELF: Advice from your future self looking back
   */
  static readonly LENSES: readonly string[] = [
    'COSMIC',
    'ABSURDIST',
    'ANCESTOR',
    'CONNECTION',
    'FUTURE_SELF',
  ] as const;

  /**
   * Relatable stress contexts that viewers may be experiencing.
   * Selected programmatically to ensure variety across generations.
   */
  static readonly STRESS_CONTEXTS: readonly string[] = [
    'FACING_DECISION',
    'OVERWHELMED_TODO',
    'DREADING_MEETING',
    'AFTER_MISTAKE',
    'WAITING_NEWS',
    'FEELING_STUCK',
    'INTERPERSONAL_CONFLICT',
    'DEADLINE_PRESSURE',
    'STARTING_SOMETHING_NEW',
    'LETTING_GO',
    'IMPOSTER_SYNDROME',
    'COMPARISON_SPIRAL',
    'PROCRASTINATING',
    'BURNED_OUT',
    'ANXIOUS_FUTURE',
    'REGRET_PAST',
    'FEELING_SMALL',
    'SEEKING_MEANING',
    'OVERWHELMED_OPTIONS',
    'FEAR_OF_FAILURE',
  ] as const;

  /**
   * Programmatically selects a random lens from the LENSES array.
   * Uses Math.random() for true randomness, unlike LLM-based selection
   * which exhibits bias toward certain options.
   *
   * @returns A randomly selected lens string
   */
  static selectLens(): string {
    const index = Math.floor(Math.random() * TimePerspectiveGenerator.LENSES.length);
    return TimePerspectiveGenerator.LENSES[index];
  }

  /**
   * Programmatically selects a random stress context from STRESS_CONTEXTS.
   * Uses Math.random() for true randomness.
   *
   * @returns A randomly selected stress context string
   */
  static selectStressContext(): string {
    const index = Math.floor(Math.random() * TimePerspectiveGenerator.STRESS_CONTEXTS.length);
    return TimePerspectiveGenerator.STRESS_CONTEXTS[index];
  }

  /**
   * Determines the time bucket based on the hour of day.
   *
   * @param hour - Hour in 24-hour format (0-23)
   * @returns Time bucket string (NIGHT, MORNING, AFTERNOON, EVENING)
   */
  static getTimeBucket(hour: number): TimeBucket {
    if (hour >= 0 && hour <= 5) return 'NIGHT';
    if (hour >= 6 && hour <= 11) return 'MORNING';
    if (hour >= 12 && hour <= 17) return 'AFTERNOON';
    return 'EVENING';
  }

  /**
   * Creates a new TimePerspectiveGenerator instance
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
    // Use MEDIUM tier for time perspective (psychological reframing needs nuance)
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
   * Uses the time-perspective prompt which specifies lens-specific
   * guidance and cliche exclusions, especially for COSMIC lens.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'time-perspective.txt';
  }

  /**
   * Generates time perspective content with programmatic lens and context selection.
   *
   * Overrides the base class generate() to:
   * 1. Select a random lens from the curated LENSES array
   * 2. Select a random stress context from STRESS_CONTEXTS
   * 3. Determine the time bucket from the timestamp
   * 4. Inject all three as template variables into the user prompt
   *
   * This ensures true randomness in selection, unlike asking the LLM
   * to "randomly select" which exhibits predictable bias.
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Programmatically select lens and stress context
    const selectedLens = TimePerspectiveGenerator.selectLens();
    const selectedStressContext = TimePerspectiveGenerator.selectStressContext();
    const timeBucket = TimePerspectiveGenerator.getTimeBucket(context.timestamp.getHours());

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

    // Step 4: Load user prompt with lens, stressContext, and timeBucket injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      {
        lens: selectedLens,
        stressContext: selectedStressContext,
        timeBucket,
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
          selectedLens,
          selectedStressContext,
          timeBucket,
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
            selectedLens,
            selectedStressContext,
            timeBucket,
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
