/**
 * Local News Generator (LA Area)
 *
 * News generator for LA area headlines from LA Times and KTLA.
 * Extends BaseNewsGenerator with local news feed URLs.
 */

import { BaseNewsGenerator } from './base-news-generator.js';
import type { AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { RSSClient } from '../../../api/data-sources/rss-client.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Generates content from LA area news RSS feeds (LA Times, KTLA)
 */
export class LocalNewsGenerator extends BaseNewsGenerator {
  static readonly DEFAULT_FEEDS = [
    'https://www.latimes.com/local/rss2.0.xml',
    'https://ktla.com/feed/',
  ];

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys,
    rssClient: RSSClient,
    feedUrls: string[] = LocalNewsGenerator.DEFAULT_FEEDS
  ) {
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys, rssClient, feedUrls);
  }
}
