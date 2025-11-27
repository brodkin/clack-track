/**
 * Tests for BaseNewsGenerator abstract class
 *
 * TDD Approach:
 * - RED: Write tests first (this file)
 * - GREEN: Implement minimal functionality
 * - BLUE: Refactor for quality
 */

import { BaseNewsGenerator } from '@/content/generators/ai/base-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient, type RSSItem } from '@/api/data-sources/rss-client';
import type { AIProvider } from '@/types/ai';
import type { GenerationContext, ModelTier } from '@/types/content-generator';

// Concrete implementation for testing abstract class
class TestNewsGenerator extends BaseNewsGenerator {
  getUserPromptFile(): string {
    return 'test-news-prompt.txt';
  }

  getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }
}

describe('BaseNewsGenerator', () => {
  let mockRSSClient: jest.Mocked<RSSClient>;
  let mockAIProvider: jest.Mocked<AIProvider>;
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let generator: TestNewsGenerator;
  let feedUrls: string[];

  const mockRSSItems: RSSItem[] = [
    {
      title: 'Breaking: Major Tech Announcement',
      link: 'https://example.com/article1',
      pubDate: new Date('2025-11-27T10:00:00Z'),
      contentSnippet: 'Tech company announces new product',
      source: 'Tech News',
    },
    {
      title: 'Market Update: Stocks Rise',
      link: 'https://example.com/article2',
      pubDate: new Date('2025-11-27T09:30:00Z'),
      contentSnippet: 'Markets show positive gains',
      source: 'Financial Times',
    },
    {
      title: 'Sports: Championship Game Tonight',
      link: 'https://example.com/article3',
      pubDate: new Date('2025-11-27T09:00:00Z'),
      contentSnippet: 'Local team competes for title',
      source: 'Sports Daily',
    },
  ];

  beforeEach(() => {
    // Mock RSSClient
    mockRSSClient = {
      getLatestItems: jest.fn(),
      fetchFeed: jest.fn(),
    } as unknown as jest.Mocked<RSSClient>;

    // Mock AIProvider
    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: 'TECH NEWS\nBREAKING ANNOUNCEMENT\nMARKETS UP TODAY',
        model: 'gpt-4o-mini',
        tokensUsed: 100,
      }),
      validateConnection: jest.fn().mockResolvedValue({ success: true, message: 'Connected' }),
    } as unknown as jest.Mocked<AIProvider>;

    // Mock PromptLoader
    mockPromptLoader = {
      loadPromptWithVariables: jest.fn().mockImplementation((type, _filename) => {
        if (type === 'system') {
          return Promise.resolve('System prompt for Vestaboard content generation.');
        }
        return Promise.resolve('Generate news summary from provided headlines.');
      }),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4o-mini',
        tier: 'medium',
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    feedUrls = ['https://example.com/feed1.xml', 'https://example.com/feed2.xml'];

    // Create generator instance
    generator = new TestNewsGenerator(
      mockPromptLoader,
      mockModelTierSelector,
      'medium' as ModelTier,
      { openai: 'test-api-key' },
      mockRSSClient,
      feedUrls
    );

    // Spy on createProvider method to return mock AI provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(generator as any, 'createProvider').mockReturnValue(mockAIProvider);
  });

  describe('RSS Fetching and Injection', () => {
    it('should fetch headlines from RSS feeds before generating', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      // Verify RSS fetch was called with correct parameters
      expect(mockRSSClient.getLatestItems).toHaveBeenCalledWith(feedUrls, 5);
      expect(mockRSSClient.getLatestItems).toHaveBeenCalledTimes(1);
    });

    it('should inject headlines into user prompt', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      // Verify AI provider was called
      expect(mockAIProvider.generate).toHaveBeenCalledTimes(1);

      // Extract the userPrompt argument
      const generateCall = mockAIProvider.generate.mock.calls[0][0];
      const userPrompt = generateCall.userPrompt;

      // Verify headlines are included in prompt
      expect(userPrompt).toContain('Breaking: Major Tech Announcement');
      expect(userPrompt).toContain('Tech News');
      expect(userPrompt).toContain('Market Update: Stocks Rise');
      expect(userPrompt).toContain('Financial Times');
      expect(userPrompt).toContain('Sports: Championship Game Tonight');
      expect(userPrompt).toContain('Sports Daily');
    });

    it('should format headlines with source attribution', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      const generateCall = mockAIProvider.generate.mock.calls[0][0];
      const userPrompt = generateCall.userPrompt;

      // Check formatted structure: "- Title (Source)"
      expect(userPrompt).toContain('- Breaking: Major Tech Announcement (Tech News)');
      expect(userPrompt).toContain('- Market Update: Stocks Rise (Financial Times)');
      expect(userPrompt).toContain('- Sports: Championship Game Tonight (Sports Daily)');
    });

    it('should return generated content from AI provider', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      expect(result).toEqual({
        text: 'TECH NEWS\nBREAKING ANNOUNCEMENT\nMARKETS UP TODAY',
        outputMode: 'text',
        metadata: expect.objectContaining({
          model: 'gpt-4o-mini',
          tier: 'medium',
          provider: 'openai',
          tokensUsed: 100,
        }),
      });
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue with empty headlines when RSS fetch fails', async () => {
      mockRSSClient.getLatestItems.mockRejectedValue(new Error('Network timeout'));

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // Should still generate content
      expect(result.text).toBeDefined();
      expect(mockAIProvider.generate).toHaveBeenCalledTimes(1);

      // Verify prompt contains fallback message
      const generateCall = mockAIProvider.generate.mock.calls[0][0];
      const userPrompt = generateCall.userPrompt;
      expect(userPrompt).toContain('No recent headlines available');
    });

    it('should handle empty RSS results gracefully', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue([]);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      expect(result.text).toBeDefined();
      expect(mockAIProvider.generate).toHaveBeenCalledTimes(1);

      const generateCall = mockAIProvider.generate.mock.calls[0][0];
      const userPrompt = generateCall.userPrompt;
      expect(userPrompt).toContain('No recent headlines available');
    });

    it('should handle partial RSS failures gracefully', async () => {
      // Simulate some feeds failing but at least one succeeding
      mockRSSClient.getLatestItems.mockResolvedValue([mockRSSItems[0]]);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      expect(result.text).toBeDefined();
      expect(mockAIProvider.generate).toHaveBeenCalledTimes(1);

      const generateCall = mockAIProvider.generate.mock.calls[0][0];
      const userPrompt = generateCall.userPrompt;
      expect(userPrompt).toContain('Breaking: Major Tech Announcement');
    });
  });

  describe('Headline Formatting', () => {
    it('should include headline section header in prompt', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      const generateCall = mockAIProvider.generate.mock.calls[0][0];
      const userPrompt = generateCall.userPrompt;

      // Should have section header
      expect(userPrompt).toContain('RECENT HEADLINES:');
    });

    it('should limit headlines to requested count', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      // Verify limit of 5 was requested
      expect(mockRSSClient.getLatestItems).toHaveBeenCalledWith(feedUrls, 5);
    });
  });

  describe('Constructor', () => {
    it('should store RSSClient and feed URLs', () => {
      expect(generator).toBeInstanceOf(BaseNewsGenerator);
      // Protected properties - verify through behavior
      expect(generator.validate().valid).toBe(true);
    });

    it('should accept custom feed URLs', () => {
      const customUrls = ['https://custom.com/feed.xml'];
      const customGenerator = new TestNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        'medium' as ModelTier,
        { openai: 'test-api-key' },
        mockRSSClient,
        customUrls
      );

      expect(customGenerator).toBeInstanceOf(BaseNewsGenerator);
    });
  });

  describe('Abstract Class Contract', () => {
    it('should require getUserPromptFile implementation', () => {
      expect(generator.getUserPromptFile()).toBe('test-news-prompt.txt');
    });

    it('should require getSystemPromptFile implementation', () => {
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
    });

    it('should inherit validation from AIPromptGenerator', () => {
      const result = generator.validate();
      expect(result).toHaveProperty('valid');
      expect(result.valid).toBe(true);
    });
  });

  describe('Provider Failover', () => {
    it('should try alternate provider when primary fails', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      // Primary provider fails
      const primaryProvider = {
        generate: jest.fn().mockRejectedValue(new Error('Primary provider error')),
        validateConnection: jest.fn(),
      };

      // Alternate provider succeeds
      const alternateProvider = {
        generate: jest.fn().mockResolvedValue({
          text: 'ALTERNATE PROVIDER CONTENT',
          model: 'claude-sonnet-4.5',
          tokensUsed: 150,
        }),
        validateConnection: jest.fn(),
      };

      // Setup failover scenario
      let callCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(generator as any, 'createProvider').mockImplementation(() => {
        callCount++;
        return callCount === 1 ? primaryProvider : alternateProvider;
      });

      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        tier: 'medium',
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // Verify both providers were tried
      expect(primaryProvider.generate).toHaveBeenCalledTimes(1);
      expect(alternateProvider.generate).toHaveBeenCalledTimes(1);

      // Verify result came from alternate provider
      expect(result.text).toBe('ALTERNATE PROVIDER CONTENT');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toBe('Primary provider error');
    });

    it('should throw error when all providers fail', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      // Both providers fail
      const failingProvider = {
        generate: jest.fn().mockRejectedValue(new Error('Provider failure')),
        validateConnection: jest.fn(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(generator as any, 'createProvider').mockReturnValue(failingProvider);

      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        tier: 'medium',
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await expect(generator.generate(context)).rejects.toThrow(
        'All AI providers failed for tier medium'
      );

      // Both providers should have been attempted
      expect(failingProvider.generate).toHaveBeenCalledTimes(2);
    });
  });
});
