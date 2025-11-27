/**
 * Global News Generator
 *
 * Concrete implementation of BaseNewsGenerator for generating
 * world news summaries from international RSS feeds.
 *
 * Features:
 * - Fetches headlines from global news RSS feeds (BBC World, New York Times)
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/news-global.txt for global news content guidance
 * - Optimized with MEDIUM model tier for summarization
 * - Inherits RSS fetching and failover logic from BaseNewsGenerator
 * - Configurable via RSS_GLOBAL_FEEDS environment variable
 *
 * @example
 * ```typescript
 * const generator = new GlobalNewsGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' },
 *   rssClient
 * );
 *
 * const content = await generator.generate({
 *   updateType: 'major',
 *   timestamp: new Date(),
 *   timezone: 'America/Los_Angeles'
 * });
 *
 * console.log(content.text); // "UN CLIMATE SUMMIT\nGLOBAL TRADE TALKS..."
 * ```
 */

import { BaseNewsGenerator } from './base-news-generator.js';
import type { AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { RSSClient } from '../../../api/data-sources/rss-client.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates world news summaries from RSS feeds
 *
 * Extends BaseNewsGenerator with global news feeds and prompts.
 * Focuses on international affairs, world politics, and global events.
 */
export class GlobalNewsGenerator extends BaseNewsGenerator {
  /**
   * Default global news RSS feeds
   *
   * - BBC News World: International news from BBC
   * - New York Times: Global headlines from NYT
   */
  static readonly DEFAULT_FEEDS = [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  ];

  /**
   * Creates a new GlobalNewsGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   * @param rssClient - RSS client for fetching global news headlines
   * @param feedUrls - Array of RSS feed URLs to aggregate (defaults to DEFAULT_FEEDS)
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys,
    rssClient: RSSClient,
    feedUrls: string[] = GlobalNewsGenerator.DEFAULT_FEEDS
  ) {
    // Use MEDIUM tier for global news summaries
    // - More complex than simple quotes (requires context synthesis)
    // - Balanced cost/quality for news summarization
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys, rssClient, feedUrls);
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
   * Uses the news-global prompt which specifies the content type,
   * structure, and tone for global news summaries.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'news-global.txt';
  }
}
