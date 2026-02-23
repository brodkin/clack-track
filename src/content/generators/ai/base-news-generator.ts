/**
 * Base News Generator Abstract Class
 *
 * Abstract base class for news-related content generators that fetch
 * headlines from RSS feeds before generating AI-powered content.
 *
 * Story selection pipeline:
 * 1. Fetch ALL items from configured RSS feeds (no limit)
 * 2. Filter to items published within the last 12 hours
 * 3. Select one item at random from the filtered set
 * 4. If no recent items, fall back to random selection from 5 most recent
 * 5. Inject the single selected headline and snippet into the prompt
 *
 * All news generators use the same user prompt (news-summary.txt) with
 * different RSS feed URLs. The selected story's title is injected via
 * {{headlines}} and its content snippet via {{snippet}}.
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
import { RSSClient, type RSSItem } from '../../../api/data-sources/rss-client.js';
import type { GenerationContext, ModelTier } from '../../../types/content-generator.js';

/** Number of hours to consider an item "recent" */
const RECENT_WINDOW_HOURS = 12;

/** Maximum number of items to consider in fallback mode */
const FALLBACK_ITEM_COUNT = 5;

/**
 * Metadata about the story selection process, cached between
 * getTemplateVariables() and getCustomMetadata() calls.
 */
interface StorySelectionState {
  /** The selected story's link, used for moreInfoUrl metadata */
  selectedLink: string | undefined;
  /** Number of headlines selected (0 or 1) */
  headlineCount: number;
  /** "recent" if selected from 12h window, "fallback" if from top-5 most recent */
  selectionStrategy: 'recent' | 'fallback' | undefined;
  /** Total number of items fetched from all RSS feeds */
  totalItemsFetched: number;
  /** Number of items that fell within the 12-hour window */
  recentItemCount: number;
}

/**
 * Abstract base class for news generators with RSS feed integration
 *
 * Fetches all RSS items, filters to a 12-hour recency window, selects
 * one story at random, and injects it into the prompt template.
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Fetches items, filters, selects, injects headline + snippet
 * - getCustomMetadata(): Adds feedUrls, headlineCount, moreInfoUrl, and selection metadata
 *
 * The selected story's link is cached and exposed as moreInfoUrl in metadata
 * to enable frontend "Learn More" functionality. If RSS fetch fails or returns
 * no items, moreInfoUrl is omitted from metadata.
 */
export abstract class BaseNewsGenerator extends AIPromptGenerator {
  protected readonly rssClient: RSSClient;
  protected readonly feedUrls: string[];

  /** Default empty state for when no stories are available */
  private static readonly EMPTY_STATE: StorySelectionState = {
    selectedLink: undefined,
    headlineCount: 0,
    selectionStrategy: undefined,
    totalItemsFetched: 0,
    recentItemCount: 0,
  };

  /**
   * Cached state from the last story selection, used by getCustomMetadata
   */
  private selectionState: StorySelectionState = { ...BaseNewsGenerator.EMPTY_STATE };

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
   * Hook: Fetches RSS items, filters to 12h window, selects one at random,
   * and returns the single headline and snippet as template variables.
   *
   * Selection pipeline:
   * 1. Fetch all items from RSS feeds (no limit)
   * 2. Filter to items with pubDate < 12 hours before context timestamp
   * 3. If recent items exist, select one at random ("recent" strategy)
   * 4. If no recent items, select from the 5 most recent ("fallback" strategy)
   * 5. If no items at all, use a fallback message
   *
   * @param context - Generation context with timestamp for recency calculation
   * @returns Template variables with headlines (single title) and snippet
   */
  protected async getTemplateVariables(
    context: GenerationContext
  ): Promise<Record<string, string>> {
    let items: RSSItem[];

    try {
      items = await this.rssClient.getLatestItems(this.feedUrls);
    } catch (error) {
      console.error('Failed to fetch RSS headlines:', error);
      this.selectionState = { ...BaseNewsGenerator.EMPTY_STATE };
      return { headlines: 'No news available at this time.', snippet: '' };
    }

    if (items.length === 0) {
      this.selectionState = { ...BaseNewsGenerator.EMPTY_STATE };
      return { headlines: 'No news available at this time.', snippet: '' };
    }

    const selected = this.selectStory(items, context.timestamp);

    this.selectionState = {
      selectedLink: selected.item.link,
      headlineCount: 1,
      selectionStrategy: selected.strategy,
      totalItemsFetched: items.length,
      recentItemCount: selected.recentCount,
    };

    return {
      headlines: selected.item.title,
      snippet: selected.item.contentSnippet || '',
    };
  }

  /**
   * Selects a single story from the fetched items using the recency-based
   * selection pipeline.
   *
   * @param items - All fetched RSS items, sorted newest-first by RSSClient
   * @param timestamp - Context timestamp for the 12-hour window calculation
   * @returns The selected item, strategy used, and count of recent items
   */
  private selectStory(
    items: RSSItem[],
    timestamp: Date
  ): { item: RSSItem; strategy: 'recent' | 'fallback'; recentCount: number } {
    const cutoff = new Date(timestamp.getTime() - RECENT_WINDOW_HOURS * 60 * 60 * 1000);
    const recentItems = items.filter(item => item.pubDate.getTime() > cutoff.getTime());

    if (recentItems.length > 0) {
      const index = Math.floor(Math.random() * recentItems.length);
      return {
        item: recentItems[index],
        strategy: 'recent',
        recentCount: recentItems.length,
      };
    }

    // Fallback: select from the 5 most recent items (already sorted newest-first)
    const fallbackPool = items.slice(0, FALLBACK_ITEM_COUNT);
    const index = Math.floor(Math.random() * fallbackPool.length);
    return {
      item: fallbackPool[index],
      strategy: 'fallback',
      recentCount: 0,
    };
  }

  /**
   * Hook: Returns feed URLs, selection metadata, and moreInfoUrl in metadata.
   *
   * @returns Metadata with feedUrls, headlineCount, selectionStrategy,
   *          totalItemsFetched, recentItemCount, and optional moreInfoUrl
   */
  protected getCustomMetadata(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      feedUrls: this.feedUrls,
      headlineCount: this.selectionState.headlineCount,
      totalItemsFetched: this.selectionState.totalItemsFetched,
      recentItemCount: this.selectionState.recentItemCount,
    };

    // Include selection strategy only if a story was selected
    if (this.selectionState.selectionStrategy) {
      metadata.selectionStrategy = this.selectionState.selectionStrategy;
    }

    // Include moreInfoUrl only if we have a selected link
    if (this.selectionState.selectedLink) {
      metadata.moreInfoUrl = this.selectionState.selectedLink;
    }

    return metadata;
  }
}
