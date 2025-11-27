/**
 * Tech News Generator
 *
 * News generator for tech/startup headlines from Hacker News, TechCrunch, Ars Technica.
 * Extends BaseNewsGenerator with tech news feed URLs.
 */

import { BaseNewsGenerator } from './base-news-generator.js';
import type { AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { RSSClient } from '../../../api/data-sources/rss-client.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates content from tech news RSS feeds (HN, TechCrunch, Ars)
 */
export class TechNewsGenerator extends BaseNewsGenerator {
  static readonly DEFAULT_FEEDS = [
    'https://hnrss.org/frontpage',
    'https://techcrunch.com/feed/',
    'https://feeds.arstechnica.com/arstechnica/index',
  ];

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys,
    rssClient: RSSClient,
    feedUrls: string[] = TechNewsGenerator.DEFAULT_FEEDS
  ) {
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys, rssClient, feedUrls);
  }
}
