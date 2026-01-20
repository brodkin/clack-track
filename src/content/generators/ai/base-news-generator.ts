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
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { RSSClient } from '../../../api/data-sources/rss-client.js';
import type { GenerationContext, ModelTier } from '../../../types/content-generator.js';

/**
 * Abstract base class for news generators with RSS feed integration
 *
 * Fetches RSS headlines and passes them as `payload` array to the
 * news-summary.txt prompt for mustache rendering.
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects headlines into prompt
 * - getCustomMetadata(): Adds feedUrls to metadata
 */
export abstract class BaseNewsGenerator extends AIPromptGenerator {
  protected readonly rssClient: RSSClient;
  protected readonly feedUrls: string[];

  /**
   * Cached headlines from the last fetch, used by getCustomMetadata
   */
  private lastFetchedHeadlines: string[] = [];

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
   * Hook: Fetches RSS headlines and returns as template variable.
   *
   * Fetches latest headlines from configured RSS feeds and formats
   * them as a bullet list for prompt injection via {{headlines}}.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with headlines string
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    // Fetch headlines from RSS feeds
    let headlines: string[] = [];
    try {
      const items = await this.rssClient.getLatestItems(this.feedUrls, 5);
      headlines = items.map(item => item.title);
    } catch (error) {
      console.error('Failed to fetch RSS headlines:', error);
      headlines = ['No news available at this time.'];
    }

    // Cache headlines for metadata
    this.lastFetchedHeadlines = headlines;

    // Format headlines as bullet list for prompt
    const headlinesFormatted = headlines.map(h => `  - ${h}`).join('\n');

    return { headlines: headlinesFormatted };
  }

  /**
   * Hook: Returns feed URLs and headline count in metadata.
   *
   * @returns Metadata with feedUrls array
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      feedUrls: this.feedUrls,
      headlineCount: this.lastFetchedHeadlines.length,
    };
  }
}
