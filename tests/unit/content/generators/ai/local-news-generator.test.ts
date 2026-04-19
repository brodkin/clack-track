/**
 * Tests for LocalNewsGenerator
 *
 * Generator-specific behavior:
 * - DEFAULT_FEEDS constant (LA Times, KTLA)
 * - Custom feed URLs support
 * - RSS client usage during generation
 */

import { LocalNewsGenerator } from '@/content/generators/ai/local-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient } from '@/api/data-sources/rss-client';
import { ModelTier } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedLocalNewsGenerator = LocalNewsGenerator & {
  feedUrls: string[];
};

describe('LocalNewsGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockRSSClient: jest.Mocked<RSSClient>;

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
  });

  describe('DEFAULT_FEEDS constant', () => {
    it('should include LA Times feed', () => {
      expect(LocalNewsGenerator.DEFAULT_FEEDS).toContain(
        'https://www.latimes.com/local/rss2.0.xml'
      );
    });

    it('should include KTLA feed', () => {
      expect(LocalNewsGenerator.DEFAULT_FEEDS).toContain('https://ktla.com/feed/');
    });
  });

  describe('feed URL configuration', () => {
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
  });

  describe('integration with base class', () => {
    let mockAIProvider: jest.Mocked<AIProvider>;

    beforeEach(() => {
      mockAIProvider = {
        generate: jest.fn().mockResolvedValue({
          text: 'MOCK CONTENT',
          model: 'gpt-4.1-mini',
          tokensUsed: 50,
        }),
        validateConnection: jest.fn().mockResolvedValue(true),
      } as unknown as jest.Mocked<AIProvider>;

      jest
        .spyOn(
          LocalNewsGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should use RSS client for fetching news items during generation', async () => {
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

      await generator.generate({ updateType: 'major', timestamp: new Date() });

      expect(mockRSSClient.getLatestItems).toHaveBeenCalled();
    });
  });
});
