/**
 * AI Prompt Generator Base Class
 *
 * Abstract base class for all AI-powered content generators.
 * Implements the ContentGenerator interface with built-in:
 * - Prompt file loading and validation
 * - Model tier selection with cross-provider fallback
 * - Retry logic for AI provider failures
 * - Dynamic personality dimensions for content variety
 *
 * Subclasses must implement:
 * - getSystemPromptFile(): string - Return filename for system prompt
 * - getUserPromptFile(): string - Return filename for user prompt
 *
 * @example
 * ```typescript
 * class MotivationalQuoteGenerator extends AIPromptGenerator {
 *   protected getSystemPromptFile(): string {
 *     return 'major-update-base.txt';
 *   }
 *
 *   protected getUserPromptFile(): string {
 *     return 'motivational-quote.txt';
 *   }
 * }
 * ```
 */

import { join } from 'path';
import { PromptLoader } from '../prompt-loader.js';
import { ModelTierSelector, type ModelSelection } from '../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../api/ai/index.js';
import {
  generatePersonalityDimensions,
  type PersonalityDimensions,
  type TemplateVariables,
} from '../personality/index.js';
import { DimensionSubstitutor } from '../dimension-substitutor.js';
import type { AIProvider } from '../../types/ai.js';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
  GeneratorFormatOptions,
  ModelTier,
} from '../../types/content-generator.js';

/**
 * Type-safe API key provider mapping
 */
export type AIProviderAPIKeys = Record<string, string>;

/**
 * Abstract base class for AI-powered content generators
 *
 * Provides common functionality for loading prompts, selecting models,
 * and handling provider failover during content generation.
 */
export abstract class AIPromptGenerator implements ContentGenerator {
  protected readonly promptLoader: PromptLoader;
  protected readonly modelTierSelector: ModelTierSelector;
  protected readonly modelTier: ModelTier;
  private readonly apiKeys: AIProviderAPIKeys;
  private readonly formatOptions?: GeneratorFormatOptions;
  private readonly dimensionSubstitutor: DimensionSubstitutor;

  /**
   * Creates a new AIPromptGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param modelTier - Model tier to use ('light', 'medium', or 'heavy')
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   * @param formatOptions - Optional format options controlling maxChars/maxLines for prompt substitution
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    modelTier: ModelTier,
    apiKeys: AIProviderAPIKeys = {},
    formatOptions?: GeneratorFormatOptions
  ) {
    this.promptLoader = promptLoader;
    this.modelTierSelector = modelTierSelector;
    this.modelTier = modelTier;
    this.apiKeys = apiKeys;
    this.formatOptions = formatOptions;
    this.dimensionSubstitutor = new DimensionSubstitutor();
  }

  /**
   * Returns the filename for the system prompt
   *
   * Subclasses must implement this to specify which system prompt file to load
   * from the prompts/system/ directory.
   *
   * @returns Filename of the system prompt (e.g., 'major-update-base.txt')
   */
  protected abstract getSystemPromptFile(): string;

  /**
   * Returns the filename for the user prompt
   *
   * Subclasses must implement this to specify which user prompt file to load
   * from the prompts/user/ directory.
   *
   * @returns Filename of the user prompt (e.g., 'motivational-quote.txt')
   */
  protected abstract getUserPromptFile(): string;

  /**
   * Validates the generator configuration
   *
   * Checks that both system and user prompt files exist and can be loaded.
   *
   * @returns Validation result with any errors encountered
   */
  async validate(): Promise<GeneratorValidationResult> {
    const errors: string[] = [];

    // Check if system prompt exists by trying to load it
    const systemPromptPath = join('prompts', 'system', this.getSystemPromptFile());
    try {
      await this.promptLoader.loadPrompt('system', this.getSystemPromptFile());
    } catch {
      errors.push(`System prompt not found: ${systemPromptPath}`);
    }

    // Check if user prompt exists by trying to load it
    const userPromptPath = join('prompts', 'user', this.getUserPromptFile());
    try {
      await this.promptLoader.loadPrompt('user', this.getUserPromptFile());
    } catch {
      errors.push(`User prompt not found: ${userPromptPath}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generates content using AI with automatic provider failover
   *
   * Workflow:
   * 1. Generates personality dimensions for content variety
   * 2. Loads system and user prompts with template variable substitution
   * 3. Selects preferred model based on tier
   * 4. Attempts generation with preferred provider
   * 5. On failure, retries with alternate provider (if available)
   * 6. Throws if all providers fail
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Generate personality dimensions (use provided or create new)
    const personality = context.personality ?? generatePersonalityDimensions();

    // Build template variables from personality and context
    const templateVars = this.buildTemplateVariables(personality, context);

    // Load prompts with variable substitution (personality, date, etc.)
    const loadedSystemPrompt = await this.promptLoader.loadPromptWithVariables(
      'system',
      this.getSystemPromptFile(),
      templateVars
    );
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      templateVars
    );

    // Apply dimension substitution (maxChars, maxLines) to system prompt
    const systemPrompt = this.applyDimensionSubstitution(loadedSystemPrompt);

    // Format the user prompt with context
    const formattedUserPrompt = this.formatUserPrompt(userPrompt, context, personality);

    // Select model for this tier
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);

    let lastError: Error | null = null;

    // Build base metadata (reused for both primary and failover responses)
    const baseMetadata = {
      tier: this.modelTier,
      personality,
      systemPrompt,
      userPrompt: formattedUserPrompt,
      ...(this.formatOptions && { formatOptions: this.formatOptions }),
    };

    // Try preferred provider
    try {
      const provider = this.createProviderForSelection(selection);
      const response = await provider.generate({
        systemPrompt,
        userPrompt: formattedUserPrompt,
      });

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
        const alternateProvider = this.createProviderForSelection(alternate);
        const response = await alternateProvider.generate({
          systemPrompt,
          userPrompt: formattedUserPrompt,
        });

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

    // All providers failed
    throw new Error(`All AI providers failed for tier ${this.modelTier}: ${lastError?.message}`);
  }

  /**
   * Builds template variables from personality dimensions and context
   *
   * @param personality - Personality dimensions for this generation
   * @param context - Generation context with timestamp and other data
   * @returns Template variables map for prompt substitution
   */
  private buildTemplateVariables(
    personality: PersonalityDimensions,
    context: GenerationContext
  ): TemplateVariables {
    const timestamp = context.timestamp;

    return {
      // Personality dimensions
      mood: personality.mood,
      energyLevel: personality.energyLevel,
      humorStyle: personality.humorStyle,
      obsession: personality.obsession,

      // Date/time context
      date: timestamp.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      time: timestamp.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),

      // Static persona (could be made configurable later)
      persona: 'Houseboy',
    };
  }

  /**
   * Creates an AI provider instance for the given selection
   *
   * @param selection - Model selection with provider and model identifier
   * @returns Configured AI provider instance
   * @throws Error if API key not found for provider
   */
  private createProviderForSelection(selection: ModelSelection): AIProvider {
    const apiKey = this.apiKeys[selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }

    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }

  /**
   * Applies dimension substitution to a prompt template
   *
   * Replaces {{maxChars}} and {{maxLines}} placeholders with values from
   * format options (if provided) or defaults. Uses DimensionSubstitutor
   * for the actual substitution.
   *
   * @param prompt - Prompt template with potential dimension placeholders
   * @returns Prompt with dimension variables substituted
   */
  private applyDimensionSubstitution(prompt: string): string {
    // Map formatOptions to DimensionSubstitutor options
    // GeneratorFormatOptions uses maxCharsPerLine, DimensionOptions uses maxChars
    const dimensionOptions = this.formatOptions
      ? {
          maxChars: this.formatOptions.maxCharsPerLine,
          maxLines: this.formatOptions.maxLines,
        }
      : undefined;

    return this.dimensionSubstitutor.substitute(prompt, dimensionOptions);
  }

  /**
   * Formats the user prompt with context information
   *
   * Appends personality and context as structured plain text rather than JSON
   * for better readability and model comprehension.
   *
   * @param userPrompt - Base user prompt text
   * @param context - Generation context
   * @param personality - Personality dimensions for this generation
   * @returns Formatted prompt with context
   */
  private formatUserPrompt(
    userPrompt: string,
    context: GenerationContext,
    personality: PersonalityDimensions
  ): string {
    const timestamp = context.timestamp;
    const dateStr = timestamp.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return `${userPrompt}

CURRENT CONTEXT:
- Date: ${dateStr}
- Time: ${timeStr}
- Update Type: ${context.updateType}

PERSONALITY FOR THIS RESPONSE:
- Mood: ${personality.mood}
- Energy: ${personality.energyLevel}
- Humor Style: ${personality.humorStyle}
- Current Obsession: ${personality.obsession}`;
  }
}
