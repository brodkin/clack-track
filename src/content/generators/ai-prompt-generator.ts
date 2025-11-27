/**
 * AI Prompt Generator Base Class
 *
 * Abstract base class for all AI-powered content generators.
 * Implements the ContentGenerator interface with built-in:
 * - Prompt file loading and validation
 * - Model tier selection with cross-provider fallback
 * - Retry logic for AI provider failures
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

import { existsSync } from 'fs';
import { join } from 'path';
import { PromptLoader } from '../prompt-loader.js';
import { ModelTierSelector, type ModelSelection } from '../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../api/ai/index.js';
import type { AIProvider } from '../../types/ai.js';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
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

  /**
   * Creates a new AIPromptGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param modelTier - Model tier to use ('light', 'medium', or 'heavy')
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    modelTier: ModelTier,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    this.promptLoader = promptLoader;
    this.modelTierSelector = modelTierSelector;
    this.modelTier = modelTier;
    this.apiKeys = apiKeys;
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
  validate(): GeneratorValidationResult {
    const errors: string[] = [];

    // Check if system prompt exists
    const systemPromptPath = join('prompts', 'system', this.getSystemPromptFile());
    if (!existsSync(systemPromptPath)) {
      errors.push(`System prompt not found: ${systemPromptPath}`);
    }

    // Check if user prompt exists
    const userPromptPath = join('prompts', 'user', this.getUserPromptFile());
    if (!existsSync(userPromptPath)) {
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
   * 1. Loads system and user prompts
   * 2. Selects preferred model based on tier
   * 3. Attempts generation with preferred provider
   * 4. On failure, retries with alternate provider (if available)
   * 5. Throws if all providers fail
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Load prompts
    const systemPrompt = await this.promptLoader.loadPrompt('system', this.getSystemPromptFile());
    const userPrompt = await this.promptLoader.loadPrompt('user', this.getUserPromptFile());

    // Select model for this tier
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);

    let lastError: Error | null = null;

    // Try preferred provider
    try {
      const provider = this.createProviderForSelection(selection);
      const response = await provider.generate({
        systemPrompt,
        userPrompt: this.formatUserPrompt(userPrompt, context),
      });

      return {
        text: response.text,
        outputMode: 'text',
        metadata: {
          model: response.model,
          tier: this.modelTier,
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
          userPrompt: this.formatUserPrompt(userPrompt, context),
        });

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
   * Formats the user prompt with context information
   *
   * @param userPrompt - Base user prompt text
   * @param context - Generation context to append
   * @returns Formatted prompt with context
   */
  private formatUserPrompt(userPrompt: string, context: GenerationContext): string {
    return `${userPrompt}\n\nContext: ${JSON.stringify(context, null, 2)}`;
  }
}
