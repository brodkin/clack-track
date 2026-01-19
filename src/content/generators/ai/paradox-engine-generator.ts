/**
 * Paradox Engine Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * logical paradoxes applied to relatable everyday situations.
 *
 * CRITICAL DESIGN: Uses CURATED paradox database + relatable applications.
 * Novel paradox generation is unsolved by AI - humor comes from the
 * APPLICATION of well-known paradoxes to everyday contexts, not from
 * generating new paradoxes.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/logical-paradox.txt for paradox content guidance
 * - Curated database of 50+ classic logical paradoxes
 * - 30+ relatable everyday application contexts
 * - Optimized with LIGHT model tier (selection + application, not generation)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new ParadoxEngineGenerator(
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
 * console.log(content.text);
 * // "SHIP OF THESEUS:
 * //  IS YOUR COUCH STILL
 * //  THE SAME COUCH AFTER
 * //  ALL THOSE STAINS"
 * ```
 */

import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions, type TemplateVariables } from '../../personality/index.js';
import { DimensionSubstitutor } from '../../dimension-substitutor.js';
import type {
  ContentGenerator,
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
  ModelTier,
} from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';
import type { ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { join } from 'path';

/**
 * Type-safe API key provider mapping
 */
export type AIProviderAPIKeys = Record<string, string>;

/**
 * Generates logical paradoxes applied to relatable everyday situations
 *
 * Uses a curated database of classic paradoxes and applies them to
 * everyday contexts for humor and philosophical reflection.
 */
export class ParadoxEngineGenerator implements ContentGenerator {
  /**
   * Curated database of classic logical paradoxes
   *
   * These are well-known paradoxes that don't require AI generation.
   * The AI's job is to apply them creatively to everyday contexts.
   */
  static readonly PARADOX_DATABASE: readonly string[] = [
    'SHIP_OF_THESEUS',
    'LIARS_PARADOX',
    'GRANDFATHER',
    'BOOTSTRAP',
    'ZENO_ARROW',
    'SORITES',
    'OMNIPOTENCE',
    'FERMI',
    'BRAESS',
    'SIMPSONS',
    'BIRTHDAY',
    'MONTY_HALL',
    'BARBER',
    'CROCODILE',
    'ACHILLES_TORTOISE',
    'BURIDAN_DONKEY',
    'TWINS',
    'NEWCOMB',
    'UNEXPECTED_HANGING',
    'RAVENS',
    'HEAP',
    'EPIMENIDES',
    'RUSSELL',
    'BANACH_TARSKI',
    'HILBERT_HOTEL',
    'GALILEO',
    'DICHOTOMY',
    'GRELLING_NELSON',
    'CURRY',
    'YABLO',
    'ROSS_LITTLEWOOD',
    'TWO_ENVELOPE',
    'SLEEPING_BEAUTY',
    'DOOMSDAY',
    'SIMULATION',
    'TROLLEY',
    'TELEPORTER',
    'THESEUS_AXLE',
    'COASTLINE',
    'RAVEN_BLACK',
    'GETTIER',
    'MOORE',
    'SURPRISE_TEST',
    'KAVKA_TOXIN',
    'COUNTERFACTUAL',
    'VOTING',
    'PREFACE',
    'LOTTERY',
    'FITCH',
    'SORENSEN',
  ] as const;

  /**
   * Relatable everyday application contexts
   *
   * These contexts make the paradoxes accessible and humorous
   * by grounding abstract philosophy in daily life.
   */
  static readonly APPLICATION_CONTEXTS: readonly string[] = [
    'YOUR_COUCH',
    'YOUR_PLAYLIST',
    'YOUR_RELATIONSHIP',
    'MONDAY_MORNINGS',
    'YOUR_COFFEE_ORDER',
    'YOUR_CHILDHOOD_HOME',
    'YOUR_FAVORITE_BAND',
    'YOUR_WARDROBE',
    'YOUR_TO_DO_LIST',
    'YOUR_STREAMING_QUEUE',
    'YOUR_GYM_MEMBERSHIP',
    'YOUR_DIET',
    'YOUR_SOCIAL_MEDIA',
    'YOUR_SAVINGS_ACCOUNT',
    'YOUR_SLEEP_SCHEDULE',
    'YOUR_HOBBIES',
    'YOUR_COMMUTE',
    'YOUR_HAIRCUT',
    'YOUR_HOUSEPLANTS',
    'YOUR_FRIDGE_CONTENTS',
    'YOUR_EMAIL_INBOX',
    'YOUR_PHONE_BATTERY',
    'YOUR_WI_FI_SIGNAL',
    'YOUR_LUNCH_CHOICE',
    'YOUR_PARKING_SPOT',
    'YOUR_WEEKEND_PLANS',
    'YOUR_NEW_YEARS_RESOLUTION',
    'YOUR_LAUNDRY_PILE',
    'YOUR_BROWSER_TABS',
    'YOUR_LEFTOVERS',
    'YOUR_MEETING_SCHEDULE',
  ] as const;

  protected readonly promptLoader: PromptLoader;
  protected readonly modelTierSelector: ModelTierSelector;
  protected readonly modelTier: ModelTier;
  private readonly apiKeys: AIProviderAPIKeys;
  private readonly dimensionSubstitutor: DimensionSubstitutor;

  /**
   * Creates a new ParadoxEngineGenerator instance
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
    this.promptLoader = promptLoader;
    this.modelTierSelector = modelTierSelector;
    // Use LIGHT tier for paradox application (selection + application, not generation)
    this.modelTier = ModelTierEnum.LIGHT;
    this.apiKeys = apiKeys;
    this.dimensionSubstitutor = new DimensionSubstitutor();
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
   * Uses the logical-paradox prompt which specifies instructions for
   * applying curated paradoxes to everyday situations.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'logical-paradox.txt';
  }

  /**
   * Selects a random paradox from the curated database
   *
   * @returns A randomly selected paradox identifier
   */
  private selectRandomParadox(): string {
    const index = Math.floor(Math.random() * ParadoxEngineGenerator.PARADOX_DATABASE.length);
    return ParadoxEngineGenerator.PARADOX_DATABASE[index];
  }

  /**
   * Selects a random application context
   *
   * @returns A randomly selected application context
   */
  private selectRandomApplication(): string {
    const index = Math.floor(Math.random() * ParadoxEngineGenerator.APPLICATION_CONTEXTS.length);
    return ParadoxEngineGenerator.APPLICATION_CONTEXTS[index];
  }

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
   * 1. Selects random paradox and application context
   * 2. Generates personality dimensions for content variety
   * 3. Loads system and user prompts with template variable substitution
   * 4. Selects preferred model based on tier
   * 5. Attempts generation with preferred provider
   * 6. On failure, retries with alternate provider (if available)
   * 7. Throws if all providers fail
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Select random paradox and application for this generation
    const paradox = this.selectRandomParadox();
    const application = this.selectRandomApplication();

    // Generate personality dimensions (use provided or create new)
    const personality = context.personality ?? generatePersonalityDimensions();

    // Build template variables from personality, context, AND paradox selections
    const templateVars = this.buildTemplateVariables(personality, context, paradox, application);

    // Load prompts with variable substitution (personality, date, paradox, application, etc.)
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
    const formattedUserPrompt = this.formatUserPrompt(userPrompt, context);

    // Select model for this tier
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);

    let lastError: Error | null = null;

    // Build base metadata (reused for both primary and failover responses)
    const baseMetadata = {
      tier: this.modelTier,
      personality,
      systemPrompt,
      userPrompt: formattedUserPrompt,
      paradox,
      application,
    };

    // If promptsOnly mode, return just the prompts without AI call
    // This is used by ToolBasedGenerator to get prompts for its own AI call with tools
    if (context.promptsOnly) {
      return {
        text: '',
        outputMode: 'text',
        metadata: baseMetadata,
      };
    }

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
   * Builds template variables from personality dimensions, context, and paradox selections
   *
   * @param personality - Personality dimensions for this generation
   * @param context - Generation context with timestamp and other data
   * @param paradox - Selected paradox identifier
   * @param application - Selected application context
   * @returns Template variables map for prompt substitution
   */
  private buildTemplateVariables(
    personality: { mood: string; energyLevel: string; humorStyle: string; obsession: string },
    context: GenerationContext,
    paradox: string,
    application: string
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

      // Paradox-specific variables
      paradox: paradox.replace(/_/g, ' '),
      application: application.replace(/_/g, ' '),
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
   * Replaces {{maxChars}} and {{maxLines}} placeholders with values.
   * Uses DimensionSubstitutor for the actual substitution.
   *
   * @param prompt - Prompt template with potential dimension placeholders
   * @returns Prompt with dimension variables substituted
   */
  protected applyDimensionSubstitution(prompt: string): string {
    return this.dimensionSubstitutor.substitute(prompt);
  }

  /**
   * Returns the user prompt without additional context
   *
   * The user prompt already contains all necessary instructions.
   * Adding context caused the AI to echo it back in output.
   *
   * @param userPrompt - Base user prompt text
   * @returns User prompt unchanged
   */
  private formatUserPrompt(userPrompt: string, _context: GenerationContext): string {
    return userPrompt;
  }
}
