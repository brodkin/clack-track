/**
 * Local News Generator for LA Area
 *
 * Concrete implementation of BaseNewsGenerator for generating
 * LA area local news summaries with RSS feed integration.
 *
 * Features:
 * - Fetches headlines from LA Times and KTLA RSS feeds
 * - Uses prompts/system/major-update-base for system context
 * - Uses prompts/user/news-local for LA-focused content guidance
 * - Optimized with MEDIUM model tier for news summarization
 * - Inherits RSS feed fetching and AI retry logic from BaseNewsGenerator
 * - Configurable via RSS_LOCAL_FEEDS environment variable
 *
 * @example
 * ```typescript
 * const generator = new LocalNewsGenerator(
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
 * console.log(content.text); // "TRAFFIC ALERT\nPCH CLOSED IN MALIBU..."
 * ```
 */

import { BaseNewsGenerator } from './base-news-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { RSSClient } from '../../../api/data-sources/rss-client.js';
import { ModelTier } from '../../../types/content-generator.js';
import type { AIProviderAPIKeys } from '../ai-prompt-generator.js';

/**
 * Generates local news summaries focused on LA area
 *
 * Extends BaseNewsGenerator with LA-specific RSS feeds
 * and local news-focused prompts.
 */
export class LocalNewsGenerator extends BaseNewsGenerator {
  /**
   * Default RSS feeds for LA area local news
   *
   * - LA Times Local: Los Angeles area news and events
   * - KTLA: Local LA news, traffic, and weather
   */
  static readonly DEFAULT_FEEDS = [
    'https://www.latimes.com/local/rss2.0.xml',
    'https://ktla.com/feed/',
  ];

  /**
   * Creates a new LocalNewsGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   * @param rssClient - RSS client for fetching headlines
   * @param feedUrls - Array of RSS feed URLs to aggregate (defaults to DEFAULT_FEEDS)
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys,
    rssClient: RSSClient,
    feedUrls: string[] = LocalNewsGenerator.DEFAULT_FEEDS
  ) {
    // Use MEDIUM tier for local news (needs good summarization quality)
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
   * Uses the news-local prompt which specifies LA-focused content,
   * local neighborhood focus, and personality-driven style.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'news-local.txt';
  }
}
