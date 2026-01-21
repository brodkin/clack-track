/**
 * Sleep Greeting Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * soothing bedtime greetings using AI, with programmatic theme injection.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/sleep-greeting.txt for bedtime content guidance
 * - Theme dictionary for high-effectiveness variability (15+ themes)
 * - Random theme injection via {{theme}} template variable
 * - Optimized with LIGHT model tier for efficiency (short, simple content)
 * - Output fits 2-3 rows maximum (center of 6-row display)
 * - Inherits retry logic and provider failover from base class
 *
 * Variability System:
 * - BEDTIME_THEMES (15+ items): Sleep/bedtime concepts (e.g., "cozy blanket", "dreamland")
 * - Random selection ensures varied outputs across generations
 *
 * @example
 * ```typescript
 * const generator = new SleepGreetingGenerator(
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
 * console.log(content.text); // "SWEET DREAMS\nREST WELL TONIGHT"
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
 * Bedtime themes for sleep greeting variability
 *
 * Covers diverse sleep-related concepts: cozy comfort, dreaming, nighttime imagery,
 * classic bedtime references, and peaceful rest themes.
 * Each theme should work naturally in the phrase "create a bedtime greeting about [theme]"
 */
export const BEDTIME_THEMES: readonly string[] = [
  // Cozy Comfort
  'cozy blanket',
  'warm pillow',
  'soft pajamas',
  'snuggling in',

  // Dreaming
  'dreamland',
  'sweet dreams',
  'pleasant dreams',
  'dream adventures',

  // Nighttime Imagery
  'stargazing',
  'moonlight',
  'twinkling stars',
  'peaceful night sky',

  // Classic Bedtime
  'counting sheep',
  'bedtime stories',
  'lullaby',
  'goodnight wishes',

  // Peaceful Rest
  'restful slumber',
  'deep relaxation',
  'peaceful night',
  'recharging energy',
] as const;

/**
 * Generates soothing bedtime greetings for the viewer
 *
 * Extends AIPromptGenerator with sleep-greeting-specific prompts,
 * efficient LIGHT model tier selection, and variability dictionaries.
 * Designed for short, centered content that fits 2-3 rows of a Vestaboard display.
 *
 * Injects random {{theme}} via template variables to ensure
 * each generation produces meaningfully different content.
 */
export class SleepGreetingGenerator extends AIPromptGenerator {
  /**
   * Creates a new SleepGreetingGenerator instance
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
    // Use LIGHT tier for sleep greetings (simple content, fast and cheap)
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
   * Uses the sleep-greeting prompt which specifies the content type,
   * structure, and tone for soothing bedtime messages.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'sleep-greeting.txt';
  }

  /**
   * Selects a random theme from the BEDTIME_THEMES dictionary
   *
   * @returns A randomly selected bedtime theme
   */
  selectRandomTheme(): string {
    const index = Math.floor(Math.random() * BEDTIME_THEMES.length);
    return BEDTIME_THEMES[index];
  }

  /**
   * Generates sleep greeting content with theme variability injection
   *
   * Workflow:
   * 1. Select random theme from dictionary
   * 2. Load prompts with theme injected via template variables
   * 3. Generate content using AI provider with failover support
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Select random theme for variability
    const selectedTheme = this.selectRandomTheme();

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

    // Step 3: Load user prompt with theme injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      {
        theme: selectedTheme,
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
      selectedTheme,
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
