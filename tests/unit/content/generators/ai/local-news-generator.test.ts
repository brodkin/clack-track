/**
 * Tests for LocalNewsGenerator
 *
 * Test coverage:
 * - Extends BaseNewsGenerator with correct prompt files
 * - Uses MEDIUM model tier for news summarization
 * - Configurable via default LA feeds or custom feeds
 * - Validates prompt files exist
 * - Inherits RSS feed integration from BaseNewsGenerator
 */

import { LocalNewsGenerator } from '@/content/generators/ai/local-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient } from '@/api/data-sources/rss-client';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedLocalNewsGenerator = LocalNewsGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  feedUrls: string[];
};

describe('LocalNewsGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockRSSClient: jest.Mocked<RSSClient>;

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
  });

  describe('DEFAULT_FEEDS', () => {
    it('should define default LA area news feeds', () => {
      expect(LocalNewsGenerator.DEFAULT_FEEDS).toBeDefined();
      expect(Array.isArray(LocalNewsGenerator.DEFAULT_FEEDS)).toBe(true);
      expect(LocalNewsGenerator.DEFAULT_FEEDS.length).toBeGreaterThan(0);
    });

    it('should include LA Times feed', () => {
      expect(LocalNewsGenerator.DEFAULT_FEEDS).toContain(
        'https://www.latimes.com/local/rss2.0.xml'
      );
    });

    it('should include KTLA feed', () => {
      expect(LocalNewsGenerator.DEFAULT_FEEDS).toContain('https://ktla.com/feed/');
    });
  });

  describe('constructor', () => {
    it('should create instance with default feeds when none provided', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(LocalNewsGenerator);
    });

    it('should use default feeds when feedUrls parameter omitted', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      ) as ProtectedLocalNewsGenerator;

      expect(generator.feedUrls).toEqual(LocalNewsGenerator.DEFAULT_FEEDS);
    });

    it('should accept custom feed URLs', () => {
      const customFeeds = ['https://example.com/feed1.xml', 'https://example.com/feed2.xml'];

      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient,
        customFeeds
      ) as ProtectedLocalNewsGenerator;

      expect(generator.feedUrls).toEqual(customFeeds);
    });

    it('should use MEDIUM model tier for news summarization', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      ) as ProtectedLocalNewsGenerator;

      expect(generator.modelTier).toBe(ModelTier.MEDIUM);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      ) as ProtectedLocalNewsGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return news-local.txt', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      ) as ProtectedLocalNewsGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('news-local.txt');
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const result = generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const result = generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    it('should inherit generate method from BaseNewsGenerator', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      expect(typeof generator.generate).toBe('function');
      // The actual implementation is tested in base-news-generator.test.ts
    });

    it('should use correct configuration for local news', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      ) as ProtectedLocalNewsGenerator;

      // Verify the generator uses the correct configuration
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('news-local.txt');
      expect(generator.modelTier).toBe(ModelTier.MEDIUM);
      expect(generator.feedUrls).toEqual(LocalNewsGenerator.DEFAULT_FEEDS);
    });
  });

  describe('integration with base class', () => {
    it('should inherit RSS feed fetching from BaseNewsGenerator', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      // Verify that generate method exists (inherited from base class)
      expect(typeof generator.generate).toBe('function');
    });

    it('should inherit validation logic from BaseNewsGenerator', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      // Verify that validate method exists (inherited from base class)
      expect(typeof generator.validate).toBe('function');
    });

    it('should pass RSS client to base class', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      ) as ProtectedLocalNewsGenerator;

      // Verify RSS client was stored by base class
      expect(generator['rssClient']).toBe(mockRSSClient);
    });
  });
});
