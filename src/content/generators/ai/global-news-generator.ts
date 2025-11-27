/**
 * Global News Generator
 *
 * News generator for international headlines from BBC World and NYT.
 * Extends BaseNewsGenerator with global news feed URLs.
 */

import { BaseNewsGenerator } from './base-news-generator.js';
import type { AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { RSSClient } from '../../../api/data-sources/rss-client.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates content from global news RSS feeds (BBC World, NYT)
 */
export class GlobalNewsGenerator extends BaseNewsGenerator {
  static readonly DEFAULT_FEEDS = [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  ];

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys,
    rssClient: RSSClient,
    feedUrls: string[] = GlobalNewsGenerator.DEFAULT_FEEDS
  ) {
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys, rssClient, feedUrls);
  }
}
