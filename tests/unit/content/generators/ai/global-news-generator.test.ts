/**
 * Tests for GlobalNewsGenerator
 *
 * Test coverage:
 * - Extends BaseNewsGenerator with RSS feed support
 * - Uses correct system and user prompt files
 * - Uses MEDIUM model tier for news summarization
 * - Supports configurable RSS feeds via environment variable
 * - Validates default global news feeds (BBC, NYT)
 */

import { GlobalNewsGenerator } from '@/content/generators/ai/global-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient } from '@/api/data-sources/rss-client';
import { ModelTier } from '@/types/content-generator';
import type { AIProviderAPIKeys } from '@/content/generators/ai-prompt-generator';

// Helper type for accessing protected members in tests
type ProtectedGlobalNewsGenerator = GlobalNewsGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  feedUrls: string[];
};

describe('GlobalNewsGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockRSSClient: jest.Mocked<RSSClient>;
  let apiKeys: AIProviderAPIKeys;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;

    // Mock RSSClient
    mockRSSClient = {
      getLatestItems: jest.fn(),
    } as unknown as jest.Mocked<RSSClient>;

    // Setup API keys
    apiKeys = { openai: 'test-key', anthropic: 'test-key' };
  });

  describe('constructor', () => {
    it('should create instance with default global news feeds', () => {
      const generator = new GlobalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        apiKeys,
        mockRSSClient
      );

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(GlobalNewsGenerator);
    });

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

    it('should use MEDIUM model tier for news summarization', () => {
      const generator = new GlobalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        apiKeys,
        mockRSSClient
      ) as ProtectedGlobalNewsGenerator;

      expect(generator.modelTier).toBe(ModelTier.MEDIUM);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new GlobalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        apiKeys,
        mockRSSClient
      ) as ProtectedGlobalNewsGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return news-summary.txt (unified prompt for all news generators)', () => {
      const generator = new GlobalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        apiKeys,
        mockRSSClient
      ) as ProtectedGlobalNewsGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('news-summary.txt');
    });
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
});
