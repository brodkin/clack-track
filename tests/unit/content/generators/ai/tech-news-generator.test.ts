/**
 * @jest-environment node
 */

import { TechNewsGenerator } from '@/content/generators/ai/tech-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient } from '@/api/data-sources/rss-client';
import { ModelTier } from '@/types/content-generator';
import type { AIProviderAPIKeys } from '@/content/generators/ai-prompt-generator';

// Helper type for accessing protected members in tests
type ProtectedTechNewsGenerator = TechNewsGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  rssClient: RSSClient;
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
    // Create mocked instances
    promptLoader = new PromptLoader('prompts') as jest.Mocked<PromptLoader>;
    modelTierSelector = new ModelTierSelector() as jest.Mocked<ModelTierSelector>;
    rssClient = new RSSClient() as jest.Mocked<RSSClient>;
    apiKeys = { openai: 'test-key', anthropic: 'test-key' };
  });

  describe('constructor', () => {
    it('should create instance with default tech feeds', () => {
      const generator = new TechNewsGenerator(promptLoader, modelTierSelector, apiKeys, rssClient);

      expect(generator).toBeInstanceOf(TechNewsGenerator);
      // Verify it's a BaseNewsGenerator subclass
      expect(generator).toHaveProperty('generate');
      expect(generator).toHaveProperty('getSystemPromptFile');
      expect(generator).toHaveProperty('getUserPromptFile');
    });

    it('should create instance with custom feed URLs', () => {
      const customFeeds = ['https://example.com/feed1.xml', 'https://example.com/feed2.xml'];

      const generator = new TechNewsGenerator(
        promptLoader,
        modelTierSelector,
        apiKeys,
        rssClient,
        customFeeds
      );

      expect(generator).toBeInstanceOf(TechNewsGenerator);
    });

    it('should use MEDIUM model tier for tech news', () => {
      const generator = new TechNewsGenerator(
        promptLoader,
        modelTierSelector,
        apiKeys,
        rssClient
      ) as ProtectedTechNewsGenerator;

      // Access protected property for testing
      expect(generator.modelTier).toBe(ModelTier.MEDIUM);
    });
  });

  describe('getSystemPromptFile', () => {
    it('should return major-update-base.txt', () => {
      const generator = new TechNewsGenerator(
        promptLoader,
        modelTierSelector,
        apiKeys,
        rssClient
      ) as ProtectedTechNewsGenerator;

      // Call protected method for testing
      const result = generator.getSystemPromptFile();
      expect(result).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile', () => {
    it('should return news-tech.txt', () => {
      const generator = new TechNewsGenerator(
        promptLoader,
        modelTierSelector,
        apiKeys,
        rssClient
      ) as ProtectedTechNewsGenerator;

      // Call protected method for testing
      const result = generator.getUserPromptFile();
      expect(result).toBe('news-tech.txt');
    });
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

  describe('inheritance from BaseNewsGenerator', () => {
    it('should inherit RSS fetching capability', () => {
      const generator = new TechNewsGenerator(
        promptLoader,
        modelTierSelector,
        apiKeys,
        rssClient
      ) as ProtectedTechNewsGenerator;

      // Verify BaseNewsGenerator properties exist
      expect(generator.rssClient).toBe(rssClient);
      expect(generator.feedUrls).toBeDefined();
    });

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

  describe('model tier configuration', () => {
    it('should be configured for MEDIUM tier (balanced performance)', () => {
      const generator = new TechNewsGenerator(
        promptLoader,
        modelTierSelector,
        apiKeys,
        rssClient
      ) as ProtectedTechNewsGenerator;

      // MEDIUM tier is appropriate for tech news:
      // - More complex than simple quotes (LIGHT)
      // - Less complex than deep analysis (HEAVY)
      // - Balanced cost/quality for summarization
      expect(generator.modelTier).toBe(ModelTier.MEDIUM);
    });
  });
});
