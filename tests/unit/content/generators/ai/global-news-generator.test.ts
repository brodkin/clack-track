/**
 * Tests for GlobalNewsGenerator
 *
 * Generator-specific behavior:
 * - DEFAULT_FEEDS constant (BBC World, NYT)
 * - Custom feed URLs support
 */

import { GlobalNewsGenerator } from '@/content/generators/ai/global-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient } from '@/api/data-sources/rss-client';
import type { AIProviderAPIKeys } from '@/content/generators/ai-prompt-generator';

// Helper type for accessing protected members in tests
type ProtectedGlobalNewsGenerator = GlobalNewsGenerator & {
  feedUrls: string[];
};

describe('GlobalNewsGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockRSSClient: jest.Mocked<RSSClient>;
  let apiKeys: AIProviderAPIKeys;

  beforeEach(() => {
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockRSSClient = {
      getLatestItems: jest.fn(),
    } as unknown as jest.Mocked<RSSClient>;

    apiKeys = { openai: 'test-key', anthropic: 'test-key' };
  });

  describe('DEFAULT_FEEDS constant', () => {
    it('should expose default BBC World and NYT feeds', () => {
      expect(GlobalNewsGenerator.DEFAULT_FEEDS).toEqual([
        'https://feeds.bbci.co.uk/news/world/rss.xml',
        'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      ]);
    });

    it('should have exactly 2 default feeds', () => {
      expect(GlobalNewsGenerator.DEFAULT_FEEDS).toHaveLength(2);
    });
  });

  describe('feed URL configuration', () => {
    it('should use default BBC and NYT feeds when no feeds provided', () => {
      const generator = new GlobalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        apiKeys,
        mockRSSClient
      ) as ProtectedGlobalNewsGenerator;

      expect(generator.feedUrls).toEqual([
        'https://feeds.bbci.co.uk/news/world/rss.xml',
        'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      ]);
    });

    it('should accept custom feed URLs', () => {
      const customFeeds = ['https://example.com/news.xml', 'https://another-example.com/feed.xml'];

      const generator = new GlobalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        apiKeys,
        mockRSSClient,
        customFeeds
      ) as ProtectedGlobalNewsGenerator;

      expect(generator.feedUrls).toEqual(customFeeds);
    });
  });
});
