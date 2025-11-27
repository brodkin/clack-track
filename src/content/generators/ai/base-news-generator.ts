/**
 * Base News Generator Abstract Class
 *
 * Abstract base class for news-related content generators that fetch
 * headlines from RSS feeds before generating AI-powered content.
 *
 * All news generators use the same user prompt (news-summary.txt) with
 * different RSS feed URLs. The prompt uses mustache templating with
 * {{#payload}} to iterate over headlines.
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
 * }
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { RSSClient } from '../../../api/data-sources/rss-client.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions } from '../../personality/index.js';
import type {
  GenerationContext,
  GeneratedContent,
  ModelTier,
} from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

/**
 * Abstract base class for news generators with RSS feed integration
 *
 * Fetches RSS headlines and passes them as `payload` array to the
 * news-summary.txt prompt for mustache rendering.
 */
export abstract class BaseNewsGenerator extends AIPromptGenerator {
  protected readonly rssClient: RSSClient;
  protected readonly feedUrls: string[];

  /**
   * Creates a new BaseNewsGenerator instance
   *
   * @param promptLoader - Loader for prompt files
   * @param modelTierSelector - Selector for tier-based model selection
   * @param modelTier - Model tier to use ('light', 'medium', or 'heavy')
   * @param apiKeys - Record of provider names to API keys
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
   * All news generators use the same system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * All news generators use the same user prompt with different RSS feeds
   */
  protected getUserPromptFile(): string {
    return 'news-summary.txt';
  }

  /**
   * Generates content with RSS headline fetching
   *
   * Workflow:
   * 1. Fetch latest headlines from configured RSS feeds
   * 2. Pass headlines as `payload` array for mustache template
   * 3. Generate content using AI provider
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Fetch headlines from RSS feeds
    let headlines: string[] = [];
    try {
      const items = await this.rssClient.getLatestItems(this.feedUrls, 5);
      headlines = items.map(item => item.title);
    } catch (error) {
      console.error('Failed to fetch RSS headlines:', error);
      headlines = ['No news available at this time.'];
    }

    // Step 2: Load system prompt (personality handled at system level)
    const personality = context.personality ?? generatePersonalityDimensions();
    const systemPrompt = await this.promptLoader.loadPromptWithVariables(
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

    // Step 3: Load user prompt with pre-formatted headlines string
    const headlinesFormatted = headlines.map(h => `  - ${h}`).join('\n');
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      { headlines: headlinesFormatted }
    );

    // Step 4: Select model and generate
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
          feedUrls: this.feedUrls,
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
            feedUrls: this.feedUrls,
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
  protected createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this['apiKeys'][selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
