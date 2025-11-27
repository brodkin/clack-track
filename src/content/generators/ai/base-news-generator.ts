/**
 * Base News Generator Abstract Class
 *
 * Abstract base class for news-related content generators that fetch
 * headlines from RSS feeds before generating AI-powered content.
 *
 * Extends AIPromptGenerator with:
 * - RSS feed fetching and aggregation
 * - Headline formatting and injection into prompts
 * - Graceful degradation when RSS feeds fail
 *
 * Subclasses must implement:
 * - getSystemPromptFile(): string - Return filename for system prompt
 * - getUserPromptFile(): string - Return filename for user prompt
 *
 * @example
 * ```typescript
 * class TechNewsGenerator extends BaseNewsGenerator {
 *   constructor(
 *     promptLoader: PromptLoader,
 *     modelTierSelector: ModelTierSelector,
 *     apiKeys: AIProviderAPIKeys,
 *     rssClient: RSSClient
 *   ) {
 *     super(
 *       promptLoader,
 *       modelTierSelector,
 *       ModelTier.MEDIUM,
 *       apiKeys,
 *       rssClient,
 *       ['https://techcrunch.com/feed/', 'https://arstechnica.com/feed/']
 *     );
 *   }
 *
 *   protected getSystemPromptFile(): string {
 *     return 'major-update-base.txt';
 *   }
 *
 *   protected getUserPromptFile(): string {
 *     return 'tech-news.txt';
 *   }
 * }
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { RSSClient, type RSSItem } from '../../../api/data-sources/rss-client.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import {
  generatePersonalityDimensions,
  type PersonalityDimensions,
  type TemplateVariables,
} from '../../personality/index.js';
import type {
  GenerationContext,
  GeneratedContent,
  ModelTier,
} from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

/**
 * Abstract base class for news generators with RSS feed integration
 *
 * Provides automatic RSS headline fetching and injection into AI prompts
 * with graceful degradation when feeds are unavailable.
 */
export abstract class BaseNewsGenerator extends AIPromptGenerator {
  protected readonly rssClient: RSSClient;
  protected readonly feedUrls: string[];

  /**
   * Creates a new BaseNewsGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param modelTier - Model tier to use ('light', 'medium', or 'heavy')
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   * @param rssClient - RSS client for fetching headlines
   * @param feedUrls - Array of RSS feed URLs to aggregate
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    modelTier: ModelTier,
    apiKeys: AIProviderAPIKeys,
    rssClient: RSSClient,
    feedUrls: string[]
  ) {
    super(promptLoader, modelTierSelector, modelTier, apiKeys);
    this.rssClient = rssClient;
    this.feedUrls = feedUrls;
  }

  /**
   * Generates content with RSS headline fetching and injection
   *
   * Workflow:
   * 1. Fetch latest headlines from configured RSS feeds
   * 2. Format headlines for prompt injection
   * 3. Load system and user prompts with template variables
   * 4. Append headlines to user prompt
   * 5. Generate content using AI provider with enhanced prompt
   * 6. Gracefully degrade to "No headlines" message on RSS failures
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Fetch headlines from RSS feeds with graceful fallback
    let headlines: RSSItem[] = [];
    try {
      headlines = await this.rssClient.getLatestItems(this.feedUrls, 5);
    } catch (error) {
      // Log error but continue with empty headlines
      console.error('Failed to fetch RSS headlines:', error);
    }

    // Step 2: Format headlines for prompt injection
    const headlinesText = this.formatHeadlines(headlines);

    // Step 3: Generate personality dimensions
    const personality = context.personality ?? generatePersonalityDimensions();

    // Build template variables from personality and context
    const templateVars = this.buildTemplateVars(personality, context);

    // Step 4: Load prompts with variable substitution
    const systemPrompt = await this.promptLoader.loadPromptWithVariables(
      'system',
      this.getSystemPromptFile(),
      templateVars
    );
    const baseUserPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      templateVars
    );

    // Step 5: Enhance user prompt with headlines and context
    const enhancedUserPrompt = this.enhanceUserPromptWithHeadlines(
      baseUserPrompt,
      context,
      personality,
      headlinesText
    );

    // Step 6: Select model for this tier
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);

    let lastError: Error | null = null;

    // Try preferred provider
    try {
      const provider = this.createProvider(selection);
      const response = await provider.generate({
        systemPrompt,
        userPrompt: enhancedUserPrompt,
      });

      return {
        text: response.text,
        outputMode: 'text',
        metadata: {
          model: response.model,
          tier: this.modelTier,
          provider: selection.provider,
          tokensUsed: response.tokensUsed,
          personality,
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
        const response = await alternateProvider.generate({
          systemPrompt,
          userPrompt: enhancedUserPrompt,
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
            personality,
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
  protected buildTemplateVars(
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
  protected createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this['apiKeys'][selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }

    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }

  /**
   * Formats RSS headlines for injection into AI prompts
   *
   * Creates a structured text representation of headlines with source attribution.
   * Handles empty headline lists gracefully with a fallback message.
   *
   * Format:
   * ```
   * RECENT HEADLINES:
   * - Headline Title (Source Name)
   * - Another Headline (Another Source)
   * ```
   *
   * @param headlines - Array of RSS items to format
   * @returns Formatted headline text for prompt injection
   */
  protected formatHeadlines(headlines: RSSItem[]): string {
    // Handle empty headlines with fallback message
    if (headlines.length === 0) {
      return 'No recent headlines available.';
    }

    // Build section with header
    const lines = ['RECENT HEADLINES:'];

    // Format each headline with source attribution
    for (const headline of headlines) {
      lines.push(`- ${headline.title} (${headline.source})`);
    }

    return lines.join('\n');
  }

  /**
   * Enhances user prompt with headlines and context information
   *
   * Replicates the parent's formatUserPrompt logic but injects headlines
   * at the appropriate location in the prompt structure.
   *
   * @param userPrompt - Base user prompt text
   * @param context - Generation context
   * @param personality - Personality dimensions for this generation
   * @param headlinesText - Formatted headlines text to inject
   * @returns Enhanced prompt with headlines and context
   */
  protected enhanceUserPromptWithHeadlines(
    userPrompt: string,
    context: GenerationContext,
    personality: PersonalityDimensions,
    headlinesText: string
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

    // Build enhanced prompt with headlines injected before context
    return `${userPrompt}

${headlinesText}

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
