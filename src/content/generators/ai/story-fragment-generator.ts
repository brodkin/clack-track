/**
 * Story Fragment Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * micro-fiction scene snapshots with one character, one moment,
 * and one emotional beat.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/story-fragment.txt for scene snapshot guidance
 * - Injects random scenario and emotionalBeat template variables
 * - Optimized with MEDIUM model tier for scene coherence nuance
 * - Inherits retry logic and provider failover from base class
 *
 * Design: Scene Snapshot
 * - One character, one moment, one emotional beat
 * - NOT a story arc - just a moment that lands
 * - No implied narrative requirement
 *
 * @example
 * ```typescript
 * const generator = new StoryFragmentGenerator(
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
 * console.log(content.text);
 * // "HE KEPT HER COFFEE
 * // MUG IN THE CABINET
 * // THREE YEARS NOW
 * // STILL DONT USE IT"
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
 * Scenario dictionary for scene snapshots
 *
 * Each scenario represents a moment type that can anchor a micro-fiction scene.
 * The scenario provides the situational context for the emotional beat.
 */
export const SCENARIO = [
  'KEEPING_OBJECT',
  'AFTER_PHONE_CALL',
  'ALMOST_SPOKE',
  'LAST_TIME',
  'WAITING',
  'FOUND_NOTE',
  'EMPTY_CHAIR',
  'HELD_DOOR',
  'PACKED_BOX',
  'KEPT_SECRET',
  'RETURNED_KEY',
  'WRONG_NUMBER',
  'OLD_PHOTO',
  'MISSED_TRAIN',
  'LEFT_MESSAGE',
  'UNOPENED_LETTER',
  'SAVED_SEAT',
] as const;

/**
 * Emotional beat dictionary for scene snapshots
 *
 * Each emotional beat represents the core feeling to convey through action,
 * not by naming the emotion directly.
 */
export const EMOTIONAL_BEAT = [
  'LOSS',
  'HOPE',
  'REGRET',
  'RELIEF',
  'LONGING',
  'RESOLVE',
  'TENDERNESS',
  'ACCEPTANCE',
] as const;

export type ScenarioType = (typeof SCENARIO)[number];
export type EmotionalBeatType = (typeof EMOTIONAL_BEAT)[number];

/**
 * Generates micro-fiction scene snapshots
 *
 * Extends AIPromptGenerator with story-fragment-specific prompts
 * and MEDIUM model tier selection for scene coherence.
 *
 * The generator injects random scenario and emotionalBeat variables
 * into the prompt template for creative variety.
 */
export class StoryFragmentGenerator extends AIPromptGenerator {
  /**
   * Static access to scenarios for testing
   */
  static readonly SCENARIO = SCENARIO;

  /**
   * Static access to emotional beats for testing
   */
  static readonly EMOTIONAL_BEAT = EMOTIONAL_BEAT;

  private readonly apiKeysRef: AIProviderAPIKeys;

  /**
   * Creates a new StoryFragmentGenerator instance
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
    // Use MEDIUM tier for story fragments (scene coherence requires nuance)
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
   * Uses the story-fragment prompt which specifies the content type,
   * structure, and guidelines for micro-fiction scene snapshots.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'story-fragment.txt';
  }

  /**
   * Selects a random scenario from the SCENARIO dictionary
   *
   * @returns Random scenario string
   */
  selectRandomScenario(): ScenarioType {
    const index = Math.floor(Math.random() * SCENARIO.length);
    return SCENARIO[index];
  }

  /**
   * Selects a random emotional beat from the EMOTIONAL_BEAT dictionary
   *
   * @returns Random emotional beat string
   */
  selectRandomEmotionalBeat(): EmotionalBeatType {
    const index = Math.floor(Math.random() * EMOTIONAL_BEAT.length);
    return EMOTIONAL_BEAT[index];
  }

  /**
   * Returns additional template variables for story fragments
   *
   * Randomly selects a scenario and emotionalBeat from the dictionaries
   * to inject into the prompt template for creative variety.
   *
   * @returns Object with scenario and emotionalBeat template variables
   */
  protected getAdditionalTemplateVariables(): {
    scenario: ScenarioType;
    emotionalBeat: EmotionalBeatType;
  } {
    return {
      scenario: this.selectRandomScenario(),
      emotionalBeat: this.selectRandomEmotionalBeat(),
    };
  }

  /**
   * Generates story fragment content using AI with automatic provider failover
   *
   * Overrides base class to inject scenario and emotionalBeat template variables.
   *
   * Workflow:
   * 1. Selects random scenario and emotional beat
   * 2. Generates personality dimensions for content variety
   * 3. Loads system and user prompts with template variable substitution
   * 4. Selects preferred model based on MEDIUM tier
   * 5. Attempts generation with preferred provider
   * 6. On failure, retries with alternate provider (if available)
   * 7. Throws if all providers fail
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Select random scenario and emotional beat
    const { scenario, emotionalBeat } = this.getAdditionalTemplateVariables();

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

    // Step 3: Load user prompt with story fragment variables injected
    const userPromptBase = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      {
        scenario,
        emotionalBeat,
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
      scenario,
      emotionalBeat,
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
   *
   * @param selection - Model selection with provider and model identifier
   * @returns Configured AI provider instance
   * @throws Error if API key not found for provider
   */
  protected createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this.apiKeysRef[selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
