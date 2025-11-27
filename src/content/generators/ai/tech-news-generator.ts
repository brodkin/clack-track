/**
 * Tech News Generator
 *
 * Concrete implementation of BaseNewsGenerator for generating
 * tech and startup news summaries from RSS feeds.
 *
 * Features:
 * - Fetches headlines from tech news RSS feeds (Hacker News, TechCrunch, Ars Technica)
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/news-tech.txt for tech-specific content guidance
 * - Optimized with MEDIUM model tier for summarization
 * - Inherits RSS fetching and failover logic from BaseNewsGenerator
 * - Configurable via RSS_TECH_FEEDS environment variable
 *
 * @example
 * ```typescript
 * const generator = new TechNewsGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   rssClient
 * );
 *
 * const content = await generator.generate({
 *   updateType: 'major',
 *   timestamp: new Date(),
 *   timezone: 'America/Los_Angeles'
 * });
 *
 * console.log(content.text); // "AI STARTUP RAISES $50M\nOPENAI RELEASES GPT-5..."
 * ```
 */

import { BaseNewsGenerator } from './base-news-generator.js';
import type { AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { RSSClient } from '../../../api/data-sources/rss-client.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates tech and startup news summaries from RSS feeds
 *
 * Extends BaseNewsGenerator with tech-specific feeds and prompts.
 * Focuses on innovation, startups, and Silicon Valley news.
 */
export class TechNewsGenerator extends BaseNewsGenerator {
  /**
   * Default tech news RSS feeds
   *
   * - Hacker News: Top stories from tech community
   * - TechCrunch: Startup and tech industry news
   * - Ars Technica: In-depth technology coverage
   */
  static readonly DEFAULT_FEEDS = [
    'https://hnrss.org/frontpage',
    'https://techcrunch.com/feed/',
    'https://feeds.arstechnica.com/arstechnica/index',
  ];

  /**
   * Creates a new TechNewsGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   * @param rssClient - RSS client for fetching tech news headlines
   * @param feedUrls - Array of RSS feed URLs to aggregate (defaults to DEFAULT_FEEDS)
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys,
    rssClient: RSSClient,
    feedUrls: string[] = TechNewsGenerator.DEFAULT_FEEDS
  ) {
    // Use MEDIUM tier for tech news summaries
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
   * Uses the news-tech prompt which specifies the content type,
   * structure, and tone for tech/startup news summaries.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'news-tech.txt';
  }
}
