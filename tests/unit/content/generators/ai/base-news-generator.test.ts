/**
 * Tests for BaseNewsGenerator abstract class
 *
 * TDD Approach:
 * - RED: Write tests first (this file)
 * - GREEN: Implement minimal functionality
 * - BLUE: Refactor for quality
 *
 * Uses Template Method hooks:
 * - getTemplateVariables() for headlines injection
 * - getCustomMetadata() for feedUrls tracking
 */

import { BaseNewsGenerator } from '@/content/generators/ai/base-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient, type RSSItem } from '@/api/data-sources/rss-client';
import type { GenerationContext, ModelTier } from '@/types/content-generator';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';

// Mock createAIProvider function to avoid real API calls
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn(),
  AIProviderType: {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
  },
}));

// Mock personality generation for consistent tests
jest.mock('@/content/personality/index.js', () => ({
  generatePersonalityDimensions: jest.fn(() => ({
    mood: 'cheerful',
    energyLevel: 'high',
    humorStyle: 'witty',
    obsession: 'coffee',
  })),
}));

import { createAIProvider } from '@/api/ai/index.js';

// Concrete implementation for testing abstract class
// Note: BaseNewsGenerator now provides getSystemPromptFile() and getUserPromptFile()
// implementations, so TestNewsGenerator just needs to exist as a concrete class
class TestNewsGenerator extends BaseNewsGenerator {
  // For testing - expose protected methods
  public getSystemPromptFile(): string {
    return super.getSystemPromptFile();
  }

  public getUserPromptFile(): string {
    return super.getUserPromptFile();
  }
}

describe('BaseNewsGenerator', () => {
  let mockRSSClient: jest.Mocked<RSSClient>;
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
    jest.clearAllMocks();

    // Mock RSSClient
    mockRSSClient = {
      getLatestItems: jest.fn(),
      fetchFeed: jest.fn(),
    } as unknown as jest.Mocked<RSSClient>;

    // Mock PromptLoader - simulates template variable substitution
    mockPromptLoader = {
      loadPrompt: jest.fn().mockResolvedValue('prompt content'),
      loadPromptWithVariables: jest.fn().mockImplementation((type, _filename, variables) => {
        if (type === 'system') {
          return Promise.resolve('System prompt for Vestaboard content generation.');
        }
        // Simulate simple {{headlines}} variable substitution
        // The headlines are pre-formatted as a string by base-news-generator
        const headlines = variables?.headlines || '';
        return Promise.resolve(
          `Pretend you are a late night comic. Select a random current event from the list below.\n\n${headlines}`
        );
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

    // Mock createAIProvider to return a successful mock provider
    (createAIProvider as jest.Mock).mockReturnValue(
      createMockAIProvider({
        response: {
          text: 'TECH NEWS\nBREAKING ANNOUNCEMENT\nMARKETS UP TODAY',
          model: 'gpt-4o-mini',
          tokensUsed: 100,
        },
      })
    );
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

    it('should inject headlines into user prompt via getTemplateVariables() hook', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      // Verify loadPromptWithVariables was called with headlines
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'news-summary.txt',
        expect.objectContaining({
          headlines: expect.stringContaining('Breaking: Major Tech Announcement'),
        })
      );
    });

    it('should format headlines as bullet list', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      // Verify headlines are formatted as bullet list
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2] as Record<string, string>;
      expect(templateVars.headlines).toContain('  - Breaking: Major Tech Announcement');
      expect(templateVars.headlines).toContain('  - Market Update: Stocks Rise');
    });

    it('should return generated content from AI provider', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      expect(result.text).toBe('TECH NEWS\nBREAKING ANNOUNCEMENT\nMARKETS UP TODAY');
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toMatchObject({
        model: 'gpt-4o-mini',
        tier: 'medium',
        provider: 'openai',
      });
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue with fallback message when RSS fetch fails', async () => {
      mockRSSClient.getLatestItems.mockRejectedValue(new Error('Network timeout'));

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // Should still generate content
      expect(result.text).toBeDefined();

      // Verify prompt contains fallback message
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2] as Record<string, string>;
      expect(templateVars.headlines).toContain('No news available at this time');
    });

    it('should handle empty RSS results with fallback', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue([]);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      expect(result.text).toBeDefined();

      // Empty array results in empty headlines string
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2] as Record<string, string>;
      // Empty headlines (no items to format)
      expect(templateVars.headlines).toBe('');
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

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2] as Record<string, string>;
      expect(templateVars.headlines).toContain('Breaking: Major Tech Announcement');
    });
  });

  describe('Headline Formatting', () => {
    it('should include late night comic style instructions', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      // User prompt should be loaded
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'news-summary.txt',
        expect.any(Object)
      );
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
    it('should store RSSClient and feed URLs', async () => {
      expect(generator).toBeInstanceOf(BaseNewsGenerator);
      // Protected properties - verify through behavior
      const result = await generator.validate();
      expect(result.valid).toBe(true);
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

  describe('Base Class Contract', () => {
    it('should provide getUserPromptFile returning news-summary.txt', () => {
      expect(generator.getUserPromptFile()).toBe('news-summary.txt');
    });

    it('should provide getSystemPromptFile returning major-update-base.txt', () => {
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
    });

    it('should inherit validation from AIPromptGenerator', async () => {
      const result = await generator.validate();
      expect(result).toHaveProperty('valid');
      expect(result.valid).toBe(true);
    });
  });

  describe('Dimension Substitution', () => {
    it('should apply dimension substitution to system prompt', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      // Track what gets passed to createAIProvider
      const mockProvider = createMockAIProvider({
        response: {
          text: 'NEWS CONTENT',
          model: 'gpt-4o-mini',
          tokensUsed: 100,
        },
      });
      (createAIProvider as jest.Mock).mockReturnValue(mockProvider);

      // Return system prompt with dimension placeholders
      mockPromptLoader.loadPromptWithVariables.mockImplementation((type, _filename, _variables) => {
        if (type === 'system') {
          return Promise.resolve(
            'Generate content with {{maxChars}} chars per line and {{maxLines}} lines maximum.'
          );
        }
        return Promise.resolve('News prompt with headlines.');
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      // Extract the systemPrompt argument from the AI provider call
      const generateCall = (mockProvider.generate as jest.Mock).mock.calls[0][0];
      const systemPrompt = generateCall.systemPrompt;

      // Verify dimension placeholders are substituted with actual values
      expect(systemPrompt).toContain('21 chars per line');
      expect(systemPrompt).toContain('5 lines maximum');
      expect(systemPrompt).not.toContain('{{maxChars}}');
      expect(systemPrompt).not.toContain('{{maxLines}}');
    });
  });

  describe('Template Variables', () => {
    it('should include date template variable in system prompt loading', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await generator.generate(context);

      // Verify loadPromptWithVariables was called with date variable
      const systemPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'system'
      );

      expect(systemPromptCall).toBeDefined();
      const templateVars = systemPromptCall![2] as Record<string, string>;

      // Should have date variable
      expect(templateVars).toHaveProperty('date');
      // Date should be formatted like "Wednesday, November 27, 2025"
      expect(templateVars.date).toContain('November');
      expect(templateVars.date).toContain('27');
      expect(templateVars.date).toContain('2025');
    });
  });

  describe('Provider Failover', () => {
    it('should try alternate provider when primary fails', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      // Create generator with both API keys
      const generatorWithBothKeys = new TestNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        'medium' as ModelTier,
        { openai: 'test-api-key', anthropic: 'test-api-key-2' },
        mockRSSClient,
        feedUrls
      );

      // Primary provider fails, alternate succeeds
      const primaryProvider = createMockAIProvider({
        shouldFail: true,
        failureError: new Error('Primary provider error'),
      });

      const alternateProvider = createMockAIProvider({
        response: {
          text: 'ALTERNATE PROVIDER CONTENT',
          model: 'claude-sonnet-4.5',
          tokensUsed: 150,
        },
      });

      (createAIProvider as jest.Mock)
        .mockReturnValueOnce(primaryProvider)
        .mockReturnValueOnce(alternateProvider);

      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        tier: 'medium',
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generatorWithBothKeys.generate(context);

      // Verify result came from alternate provider
      expect(result.text).toBe('ALTERNATE PROVIDER CONTENT');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toBe('Primary provider error');
    });

    it('should throw error when all providers fail', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      // Create generator with both API keys
      const generatorWithBothKeys = new TestNewsGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        'medium' as ModelTier,
        { openai: 'test-api-key', anthropic: 'test-api-key-2' },
        mockRSSClient,
        feedUrls
      );

      // Both providers fail
      (createAIProvider as jest.Mock).mockReturnValue(
        createMockAIProvider({
          shouldFail: true,
          failureError: new Error('Provider failure'),
        })
      );

      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        tier: 'medium',
      });

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      await expect(generatorWithBothKeys.generate(context)).rejects.toThrow(
        'All AI providers failed for tier medium'
      );
    });
  });

  describe('getCustomMetadata() hook', () => {
    it('should include feedUrls in metadata', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // feedUrls should be in metadata from getCustomMetadata() hook
      expect(result.metadata?.feedUrls).toEqual(feedUrls);
    });

    it('should include headlineCount in metadata', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // headlineCount should be in metadata from getCustomMetadata() hook
      expect(result.metadata?.headlineCount).toBe(3);
    });

    it('should include moreInfoUrl from first RSS item link', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(mockRSSItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // moreInfoUrl should be the first RSS item's link
      expect(result.metadata?.moreInfoUrl).toBe('https://example.com/article1');
    });

    it('should not include moreInfoUrl when no RSS items fetched', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue([]);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // moreInfoUrl should be undefined when no headlines
      expect(result.metadata?.moreInfoUrl).toBeUndefined();
    });

    it('should not include moreInfoUrl when RSS fetch fails', async () => {
      mockRSSClient.getLatestItems.mockRejectedValue(new Error('Network timeout'));

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // moreInfoUrl should be undefined when fetch fails
      expect(result.metadata?.moreInfoUrl).toBeUndefined();
    });

    it('should cache first RSS link between getTemplateVariables and getCustomMetadata', async () => {
      // Use 5 items to verify we only cache the first one
      const manyItems = [
        ...mockRSSItems,
        {
          title: 'Fourth Article',
          link: 'https://example.com/article4',
          pubDate: new Date('2025-11-27T08:30:00Z'),
          contentSnippet: 'Fourth article content',
          source: 'Test Source',
        },
        {
          title: 'Fifth Article',
          link: 'https://example.com/article5',
          pubDate: new Date('2025-11-27T08:00:00Z'),
          contentSnippet: 'Fifth article content',
          source: 'Test Source',
        },
      ];
      mockRSSClient.getLatestItems.mockResolvedValue(manyItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-11-27T10:00:00Z'),
      };

      const result = await generator.generate(context);

      // Should cache only the FIRST link from fetched items
      expect(result.metadata?.moreInfoUrl).toBe('https://example.com/article1');
      expect(result.metadata?.headlineCount).toBe(5);
    });
  });
});
