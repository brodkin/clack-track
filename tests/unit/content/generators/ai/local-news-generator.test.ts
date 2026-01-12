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

    it('should use MEDIUM model tier for news summarization', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);
      mockRSSClient.getLatestItems.mockResolvedValue([]);

      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      // Verify via observable behavior: modelTierSelector.select is called with MEDIUM tier
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
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
    it('should return news-summary.txt (unified prompt for all news generators)', () => {
      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      ) as ProtectedLocalNewsGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('news-summary.txt');
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const result = await generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      const result = await generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    it('should use correct configuration for local news', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);
      mockRSSClient.getLatestItems.mockResolvedValue([]);

      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      ) as ProtectedLocalNewsGenerator;

      // Verify the generator uses the correct configuration via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('news-summary.txt');
      expect(generator.feedUrls).toEqual(LocalNewsGenerator.DEFAULT_FEEDS);

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing configuration
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });
  });

  describe('integration with base class', () => {
    it('should use RSS client for fetching news items during generation', async () => {
      // Set up mocks
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);
      mockRSSClient.getLatestItems.mockResolvedValue([
        { title: 'Test News', link: 'https://example.com', pubDate: new Date() },
      ]);

      const generator = new LocalNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockRSSClient
      );

      // Trigger generation to verify RSS client is used
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're verifying RSS client usage
      }

      // Verify via observable behavior: RSS client was called during generation
      expect(mockRSSClient.getLatestItems).toHaveBeenCalled();
    });
  });
});
