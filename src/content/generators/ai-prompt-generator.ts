/**
 * AI Prompt Generator Base Class
 *
 * Abstract base class for all AI-powered content generators using the
 * **Template Method Pattern**. The base `generate()` method defines the
 * algorithm skeleton, while subclasses customize specific steps via hooks.
 *
 * Built-in functionality:
 * - Prompt file loading and validation
 * - Model tier selection with cross-provider fallback
 * - Retry logic for AI provider failures
 * - Dynamic personality dimensions for content variety
 * - Centralized promptsOnly handling
 *
 * ## Required Methods (must implement)
 * - `getSystemPromptFile()`: Return filename for system prompt
 * - `getUserPromptFile()`: Return filename for user prompt
 *
 * ## Optional Hooks (override to customize)
 * - `getTemplateVariables(context)`: Add custom template variables (e.g., weather data)
 * - `getCustomMetadata()`: Add generator-specific metadata fields
 * - `postProcessContent(content)`: Modify content after AI generation
 *
 * **IMPORTANT**: Subclasses should NOT override the `generate()` method.
 * Use the provided hooks instead to customize behavior.
 *
 * @example
 * ```typescript
 * // Simple generator - just implement required methods
 * class MotivationalGenerator extends AIPromptGenerator {
 *   protected getSystemPromptFile(): string {
 *     return 'major-update-base.txt';
 *   }
 *   protected getUserPromptFile(): string {
 *     return 'motivational.txt';
 *   }
 * }
 *
 * // Advanced generator - use hooks for customization
 * class WeatherGenerator extends AIPromptGenerator {
 *   protected getSystemPromptFile() { return 'major-update-base.txt'; }
 *   protected getUserPromptFile() { return 'weather-focus.txt'; }
 *
 *   // Hook: Inject weather data into prompts
 *   protected async getTemplateVariables(context: GenerationContext) {
 *     const weather = await this.weatherService.getWeather();
 *     return { weather: formatWeather(weather) };
 *   }
 *
 *   // Hook: Track weather injection in metadata
 *   protected getCustomMetadata() {
 *     return { weatherInjected: true };
 *   }
 * }
 *
 * // Post-processing generator - modify content after AI generation
 * class FortuneCookieGenerator extends AIPromptGenerator {
 *   protected getSystemPromptFile() { return 'major-update-base.txt'; }
 *   protected getUserPromptFile() { return 'fortune-cookie.txt'; }
 *
 *   // Hook: Prepend title to AI-generated content
 *   protected postProcessContent(content: GeneratedContent): GeneratedContent {
 *     return {
 *       ...content,
 *       text: `FORTUNE COOKIE\n${content.text}`,
 *       metadata: { ...content.metadata, titleInjected: true }
 *     };
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
  /**
   * Marker indicating this is an AI-powered generator.
   * Used by the orchestrator to determine if ToolBasedGenerator wrapping is needed.
   */
  readonly isAIGenerator = true;

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

  // ============================================================================
  // TEMPLATE METHOD HOOKS - Override these to customize generator behavior
  // ============================================================================

  /**
   * Hook: Returns custom template variables to merge with base variables.
   *
   * Override this method to inject generator-specific data into prompts.
   * The returned variables are merged with base variables (personality, date, time)
   * and used for prompt template substitution.
   *
   * **Use cases:**
   * - WeatherGenerator: Inject weather data via `{ weather: '72F Sunny' }`
   * - NewsGenerator: Inject headlines via `{ headlines: '...' }`
   *
   * @param context - Generation context with timestamp and other data
   * @returns Custom template variables (default: empty object)
   *
   * @example
   * ```typescript
   * protected async getTemplateVariables(context: GenerationContext) {
   *   const weather = await this.weatherService.getWeather();
   *   return { weather: `${weather.temp}F ${weather.condition}` };
   * }
   * ```
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    return {};
  }

  /**
   * Hook: Returns custom metadata to include in generation result.
   *
   * Override this method to add generator-specific metadata fields.
   * Custom metadata is merged with base metadata (model, tier, provider, etc.)
   * but does NOT overwrite base fields if there are conflicts.
   *
   * **Use cases:**
   * - WeatherGenerator: `{ weatherInjected: true }`
   * - NewsGenerator: `{ feedUrls: ['...'], articlesUsed: 5 }`
   *
   * @returns Custom metadata fields (default: empty object)
   *
   * @example
   * ```typescript
   * protected getCustomMetadata() {
   *   return {
   *     weatherInjected: this.weatherData !== null,
   *     dataSource: 'openweathermap'
   *   };
   * }
   * ```
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {};
  }

  /**
   * Hook: Post-processes content after AI generation.
   *
   * Override this method to modify the generated content before returning.
   * This hook is called AFTER the AI provider returns content but BEFORE
   * the final result is returned. It is NOT called when `promptsOnly` is true.
   *
   * **Use cases:**
   * - FortuneCookieGenerator: Prepend title line
   * - FormattingGenerator: Apply text transformations
   *
   * @param content - AI-generated content to process
   * @returns Processed content (default: unchanged content)
   *
   * @example
   * ```typescript
   * protected postProcessContent(content: GeneratedContent): GeneratedContent {
   *   return {
   *     ...content,
   *     text: `FORTUNE COOKIE\n${content.text}`,
   *     metadata: { ...content.metadata, titleInjected: true }
   *   };
   * }
   * ```
   */
  protected postProcessContent(content: GeneratedContent): GeneratedContent {
    return content;
  }

  // ============================================================================
  // END OF TEMPLATE METHOD HOOKS
  // ============================================================================

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
   * Generates content using AI with automatic provider failover.
   *
   * **Template Method Pattern**: This method defines the algorithm skeleton.
   * Subclasses should NOT override this method - use the provided hooks instead:
   * - `getTemplateVariables()` - Add custom template variables
   * - `getCustomMetadata()` - Add generator-specific metadata
   * - `postProcessContent()` - Modify content after AI generation
   *
   * Workflow:
   * 1. Generate personality dimensions (use provided or create new)
   * 2. Build template variables (base + custom via hook)
   * 3. Load prompts with variable substitution
   * 4. Apply dimension substitution to system prompt
   * 5. Build base metadata + custom metadata (via hook)
   * 6. If promptsOnly mode, return prompts without AI call
   * 7. Try preferred provider, failover to alternate if needed
   * 8. Apply postProcessContent hook to result
   * 9. Return final content
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Generate personality dimensions (use provided or create new)
    const personality = context.personality ?? generatePersonalityDimensions();

    // Step 2: Build template variables (base + custom from hook)
    const baseTemplateVars = this.buildTemplateVariables(personality, context);
    const customTemplateVars = await this.getTemplateVariables(context);
    const templateVars = { ...baseTemplateVars, ...customTemplateVars };

    // Step 3: Load prompts with variable substitution (personality, date, etc.)
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

    // Step 4: Apply dimension substitution (maxChars, maxLines) to system prompt
    const systemPrompt = this.applyDimensionSubstitution(loadedSystemPrompt);

    // Format the user prompt with context
    const formattedUserPrompt = this.formatUserPrompt(userPrompt, context);

    // Select model for this tier
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);

    // Step 5: Build base metadata + custom metadata from hook
    // Custom metadata is added first, base metadata overwrites conflicts
    const customMetadata = this.getCustomMetadata();
    const baseMetadata = {
      ...customMetadata, // Custom metadata first (can be overwritten by base)
      tier: this.modelTier,
      personality,
      systemPrompt,
      userPrompt: formattedUserPrompt,
      ...(this.formatOptions && { formatOptions: this.formatOptions }),
    };

    // Step 6: If promptsOnly mode, return just the prompts without AI call
    // This is used by ToolBasedGenerator to get prompts for its own AI call with tools
    // Note: postProcessContent is NOT called in promptsOnly mode
    if (context.promptsOnly) {
      return {
        text: '',
        outputMode: 'text',
        metadata: baseMetadata,
      };
    }

    let lastError: Error | null = null;

    // Step 7: Try preferred provider
    try {
      const provider = this.createProviderForSelection(selection);
      const response = await provider.generate({
        systemPrompt,
        userPrompt: formattedUserPrompt,
      });

      const content: GeneratedContent = {
        text: response.text,
        outputMode: 'text',
        metadata: {
          ...baseMetadata,
          model: response.model,
          provider: selection.provider,
          tokensUsed: response.tokensUsed,
        },
      };

      // Step 8: Apply postProcessContent hook
      return this.postProcessContent(content);
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

        const content: GeneratedContent = {
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

        // Step 8: Apply postProcessContent hook
        return this.postProcessContent(content);
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
   * Protected method to allow subclasses to apply dimension substitution
   * when overriding generate().
   *
   * @param prompt - Prompt template with potential dimension placeholders
   * @returns Prompt with dimension variables substituted
   */
  protected applyDimensionSubstitution(prompt: string): string {
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
   * Appends context as structured plain text for better readability
   * and model comprehension.
   *
   * @param userPrompt - Base user prompt text
   * @param context - Generation context
   * @returns Formatted prompt with context
   */
  private formatUserPrompt(userPrompt: string, context: GenerationContext): string {
    return `${userPrompt}

CURRENT CONTEXT:
- Update Type: ${context.updateType}`;
  }
}
