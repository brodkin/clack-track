/**
 * Wakeup Greeting Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * warm, welcoming good morning messages when sleep mode deactivates.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/wakeup-greeting.txt for morning greeting guidance
 * - Morning theme dictionary for high-effectiveness variability
 * - Random theme injection via {{theme}} template variable
 * - Optimized with LIGHT model tier for efficiency (simple messages)
 * - Warm, cozy morning tone matching the Houseboy persona
 * - Standard framed mode (time/weather info bar applies)
 * - Inherits retry logic and provider failover from base class
 *
 * Variability System:
 * - MORNING_THEMES (15+ items): Morning vibes to inspire content
 *   (e.g., "coffee ritual", "sunrise beauty", "fresh start energy")
 * - Random selection ensures varied outputs across generations
 *
 * @example
 * ```typescript
 * const generator = new WakeupGreetingGenerator(
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
 * console.log(content.text); // "RISE AND SHINE\nTHE COFFEE IS READY\nTODAY IS YOURS"
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
 * Morning themes to inspire wakeup greeting content
 *
 * Covers diverse morning experiences: rituals, sensations, nature, energy
 * Each theme should evoke a specific morning vibe or feeling
 */
export const MORNING_THEMES: readonly string[] = [
  // Rituals & Routines
  'the coffee ritual - that first perfect sip',
  'the gentle stretch after a good sleep',
  'the warm shower that wakes the senses',
  'the quiet moment before the day begins',

  // Nature & Environment
  'sunrise painting the sky with possibility',
  'birds chirping their morning chorus',
  'the fresh morning air through an open window',
  'morning dew glistening in early light',
  'the golden hour casting warm shadows',

  // Energy & Mindset
  'fresh start energy - a blank page',
  'the calm confidence of a new day',
  'morning motivation to chase dreams',
  'the peaceful optimism of early hours',
  'waking up on the right side of the bed',

  // Cozy & Comfort
  'warm blankets and the decision to finally emerge',
  'the satisfaction of rising with the sun',
  'that first morning smile',
] as const;

/**
 * Generates warm, welcoming good morning messages for wakeup events
 *
 * Extends AIPromptGenerator with wakeup-specific prompts,
 * efficient LIGHT model tier selection, and morning theme variability.
 * Uses the Houseboy persona with a warmer, cozier morning tone.
 *
 * Injects random {{theme}} via template variables to ensure
 * each generation produces meaningfully different content.
 */
export class WakeupGreetingGenerator extends AIPromptGenerator {
  /**
   * Creates a new WakeupGreetingGenerator instance
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
    // Use LIGHT tier for wakeup greetings (simple content, fast and cheap)
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
   * Uses the wakeup greeting prompt which specifies the content type,
   * structure, and warm morning tone for welcoming messages.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'wakeup-greeting.txt';
  }

  /**
   * Selects a random theme from the MORNING_THEMES dictionary
   *
   * @returns A randomly selected morning theme
   */
  selectRandomTheme(): string {
    const index = Math.floor(Math.random() * MORNING_THEMES.length);
    return MORNING_THEMES[index];
  }

  /**
   * Generates wakeup greeting content with theme variability injection
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
