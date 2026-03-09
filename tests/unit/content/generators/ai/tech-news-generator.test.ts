/**
 * @jest-environment node
 */

/**
 * Tests for TechNewsGenerator
 *
 * Generator-specific behavior:
 * - DEFAULT_FEEDS (Hacker News, TechCrunch, Ars Technica)
 * - Custom feed URLs support
 */

import { TechNewsGenerator } from '@/content/generators/ai/tech-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient } from '@/api/data-sources/rss-client';
import type { AIProviderAPIKeys } from '@/content/generators/ai-prompt-generator';

// Helper type for accessing protected members in tests
type ProtectedTechNewsGenerator = TechNewsGenerator & {
  feedUrls: string[];
};

// Mock dependencies
jest.mock('@/content/prompt-loader');
jest.mock('@/api/ai/model-tier-selector');
jest.mock('@/api/data-sources/rss-client');

describe('TechNewsGenerator', () => {
  let promptLoader: jest.Mocked<PromptLoader>;
  let modelTierSelector: jest.Mocked<ModelTierSelector>;
  let rssClient: jest.Mocked<RSSClient>;
  let apiKeys: AIProviderAPIKeys;

  beforeEach(() => {
    promptLoader = new PromptLoader('prompts') as jest.Mocked<PromptLoader>;
    modelTierSelector = new ModelTierSelector() as jest.Mocked<ModelTierSelector>;
    rssClient = new RSSClient() as jest.Mocked<RSSClient>;
    apiKeys = { openai: 'test-key', anthropic: 'test-key' };
  });

  describe('default feeds', () => {
    it('should include Hacker News feed', () => {
      expect(TechNewsGenerator.DEFAULT_FEEDS).toContain('https://hnrss.org/frontpage');
    });

    it('should include TechCrunch feed', () => {
      expect(TechNewsGenerator.DEFAULT_FEEDS).toContain('https://techcrunch.com/feed/');
    });

    it('should include Ars Technica feed', () => {
      expect(TechNewsGenerator.DEFAULT_FEEDS).toContain(
        'https://feeds.arstechnica.com/arstechnica/index'
      );
    });

    it('should have exactly 3 default feeds', () => {
      expect(TechNewsGenerator.DEFAULT_FEEDS).toHaveLength(3);
    });
  });

  describe('feed URL configuration', () => {
    it('should use default feeds when no custom feeds provided', () => {
      const generator = new TechNewsGenerator(
        promptLoader,
        modelTierSelector,
        apiKeys,
        rssClient
      ) as ProtectedTechNewsGenerator;

      expect(generator.feedUrls).toEqual(TechNewsGenerator.DEFAULT_FEEDS);
    });

    it('should use custom feeds when provided', () => {
      const customFeeds = ['https://example.com/tech.xml'];
      const generator = new TechNewsGenerator(
        promptLoader,
        modelTierSelector,
        apiKeys,
        rssClient,
        customFeeds
      ) as ProtectedTechNewsGenerator;

      expect(generator.feedUrls).toEqual(customFeeds);
    });
  });
});
