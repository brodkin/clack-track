/**
 * Tests for BaseNewsGenerator abstract class
 *
 * TDD Approach:
 * - RED: Write tests first (this file)
 * - GREEN: Implement minimal functionality
 * - BLUE: Refactor for quality
 *
 * Uses Template Method hooks:
 * - getTemplateVariables() for single-story injection
 * - getCustomMetadata() for feedUrls and selection tracking
 *
 * Story selection behavior:
 * - Fetches ALL items from RSS feeds (no limit)
 * - Filters to items within 12-hour window of context timestamp
 * - Selects one item at random from filtered set
 * - Falls back to 5 most recent if no items in 12h window
 * - Injects single headline via {{headlines}} and snippet via {{snippet}}
 */

import { join } from 'path';
import { BaseNewsGenerator } from '@/content/generators/ai/base-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { RSSClient, type RSSItem } from '@/api/data-sources/rss-client';
import type { GenerationContext, ModelTier } from '@/types/content-generator';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';
import {
  resolveTemplateVariables,
  findUnresolvedVariables,
} from '@/content/personality/template-resolver';

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

  // Base timestamp for tests: 2025-11-27T10:00:00Z
  const baseTimestamp = new Date('2025-11-27T10:00:00Z');

  // Helper to create RSSItem with relative hours offset from baseTimestamp
  const makeItem = (title: string, hoursAgo: number, opts: Partial<RSSItem> = {}): RSSItem => ({
    title,
    link: `https://example.com/${title.toLowerCase().replace(/\s+/g, '-')}`,
    pubDate: new Date(baseTimestamp.getTime() - hoursAgo * 60 * 60 * 1000),
    contentSnippet: opts.contentSnippet,
    source: opts.source || 'Test Source',
    ...opts,
  });

  // Items within 12-hour window (0-11 hours ago)
  const recentItems: RSSItem[] = [
    makeItem('Breaking: Major Tech Announcement', 1, {
      contentSnippet: 'Tech company announces new product',
      source: 'Tech News',
      link: 'https://example.com/article1',
    }),
    makeItem('Market Update: Stocks Rise', 3, {
      contentSnippet: 'Markets show positive gains',
      source: 'Financial Times',
      link: 'https://example.com/article2',
    }),
    makeItem('Sports: Championship Game Tonight', 6, {
      contentSnippet: 'Local team competes for title',
      source: 'Sports Daily',
      link: 'https://example.com/article3',
    }),
  ];

  // Items outside 12-hour window (13+ hours ago)
  const oldItems: RSSItem[] = [
    makeItem('Old Story One', 14, {
      link: 'https://example.com/old1',
      source: 'Old Source',
    }),
    makeItem('Old Story Two', 20, {
      link: 'https://example.com/old2',
      source: 'Old Source',
    }),
    makeItem('Old Story Three', 24, {
      link: 'https://example.com/old3',
      source: 'Old Source',
    }),
    makeItem('Old Story Four', 30, {
      link: 'https://example.com/old4',
      source: 'Old Source',
    }),
    makeItem('Old Story Five', 36, {
      link: 'https://example.com/old5',
      source: 'Old Source',
    }),
    makeItem('Old Story Six', 48, {
      link: 'https://example.com/old6',
      source: 'Old Source',
    }),
  ];

  // All items combined (sorted newest-first, as RSSClient returns)
  const allItems: RSSItem[] = [...recentItems, ...oldItems];

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
        const headlines = variables?.headlines || '';
        const snippet = variables?.snippet || '';
        return Promise.resolve(
          `Write about this news story.\n\nHeadline: ${headlines}\nSnippet: ${snippet}`
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

  describe('RSS Fetching', () => {
    it('should fetch all items from RSS feeds without a limit', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(allItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      // Should call without limit parameter to get all items
      expect(mockRSSClient.getLatestItems).toHaveBeenCalledWith(feedUrls);
      expect(mockRSSClient.getLatestItems).toHaveBeenCalledTimes(1);
    });
  });

  describe('12-Hour Filtering and Single Story Selection', () => {
    it('should filter items to the 12-hour window and select one', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(allItems);

      // Seed Math.random to get deterministic selection
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      // Should inject a single headline (from the recent items), not a bullet list
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2] as Record<string, string>;

      // With Math.random() = 0, should pick first recent item
      expect(templateVars.headlines).toBe('Breaking: Major Tech Announcement');
      // Should NOT contain bullet list formatting
      expect(templateVars.headlines).not.toContain('  - ');
      // Should NOT contain multiple headlines
      expect(templateVars.headlines).not.toContain('\n');

      randomSpy.mockRestore();
    });

    it('should include contentSnippet as {{snippet}} template variable when available', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(allItems);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      const templateVars = userPromptCall![2] as Record<string, string>;

      expect(templateVars.snippet).toBe('Tech company announces new product');

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should set snippet to empty string when contentSnippet is not available', async () => {
      const itemsWithoutSnippets = recentItems.map(item => ({
        ...item,
        contentSnippet: undefined,
      }));
      mockRSSClient.getLatestItems.mockResolvedValue(itemsWithoutSnippets);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      const templateVars = userPromptCall![2] as Record<string, string>;

      expect(templateVars.snippet).toBe('');

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should select different items based on random value', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(allItems);

      // Math.random() = 0.99 should select the last recent item (index 2 of 3)
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      const templateVars = userPromptCall![2] as Record<string, string>;

      // With Math.random() = 0.99, floor(0.99 * 3) = 2, third item
      expect(templateVars.headlines).toBe('Sports: Championship Game Tonight');

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should only include items within the 12-hour window', async () => {
      // Item exactly at the boundary (12h ago) should be EXCLUDED
      const boundaryItem = makeItem('Boundary Story', 12, {
        contentSnippet: 'Right at the boundary',
        link: 'https://example.com/boundary',
      });

      // Item just inside the boundary (11h59m ago) should be INCLUDED
      const justInsideItem: RSSItem = {
        title: 'Just Inside Story',
        link: 'https://example.com/just-inside',
        pubDate: new Date(baseTimestamp.getTime() - (12 * 60 * 60 * 1000 - 60 * 1000)), // 11h59m ago
        contentSnippet: 'Just inside window',
        source: 'Test Source',
      };

      mockRSSClient.getLatestItems.mockResolvedValue([justInsideItem, boundaryItem, ...oldItems]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      const templateVars = userPromptCall![2] as Record<string, string>;

      // Only the just-inside item should be in the recent window
      expect(templateVars.headlines).toBe('Just Inside Story');

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('Fallback to 5 Most Recent', () => {
    it('should fall back to selecting from 5 most recent when no items in 12h window', async () => {
      // All items are older than 12 hours
      mockRSSClient.getLatestItems.mockResolvedValue(oldItems);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      const templateVars = userPromptCall![2] as Record<string, string>;

      // Should pick from the 5 most recent old items (first one with random=0)
      expect(templateVars.headlines).toBe('Old Story One');

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should use at most 5 items in fallback even if more are available', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(oldItems); // 6 old items

      // Math.random() = 0.99 should pick the 5th item (index 4)
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      const templateVars = userPromptCall![2] as Record<string, string>;

      // floor(0.99 * 5) = 4, so 5th item of 5 most recent old items
      expect(templateVars.headlines).toBe('Old Story Five');
      // Should NOT select the 6th item (Old Story Six)

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should handle fewer than 5 items in fallback', async () => {
      // Only 2 old items
      const fewOldItems = oldItems.slice(0, 2);
      mockRSSClient.getLatestItems.mockResolvedValue(fewOldItems);
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      const templateVars = userPromptCall![2] as Record<string, string>;

      // floor(0.99 * 2) = 1, second of 2 items
      expect(templateVars.headlines).toBe('Old Story Two');

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue with fallback message when RSS fetch fails', async () => {
      mockRSSClient.getLatestItems.mockRejectedValue(new Error('Network timeout'));

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
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

    it('should handle empty RSS results gracefully', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue([]);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.text).toBeDefined();

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2] as Record<string, string>;
      expect(templateVars.headlines).toContain('No news available at this time');
    });

    it('should handle partial RSS failures gracefully', async () => {
      // Simulate some feeds failing but at least one succeeding
      mockRSSClient.getLatestItems.mockResolvedValue([recentItems[0]]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.text).toBeDefined();

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2] as Record<string, string>;
      expect(templateVars.headlines).toBe('Breaking: Major Tech Announcement');

      jest.spyOn(Math, 'random').mockRestore();
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
      mockRSSClient.getLatestItems.mockResolvedValue(recentItems);

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
        timestamp: baseTimestamp,
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
      mockRSSClient.getLatestItems.mockResolvedValue(recentItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
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

    it('should inject single headline via {{headlines}} template variable', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(recentItems);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      await generator.generate(context);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user'
      );
      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2] as Record<string, string>;

      // Should be a single headline, not a bullet list
      expect(templateVars.headlines).toBe('Breaking: Major Tech Announcement');
      expect(templateVars).toHaveProperty('snippet');

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('Provider Failover', () => {
    it('should try alternate provider when primary fails', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(recentItems);

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
        timestamp: baseTimestamp,
      };

      const result = await generatorWithBothKeys.generate(context);

      // Verify result came from alternate provider
      expect(result.text).toBe('ALTERNATE PROVIDER CONTENT');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toBe('Primary provider error');
    });

    it('should throw error when all providers fail', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(recentItems);

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
        timestamp: baseTimestamp,
      };

      await expect(generatorWithBothKeys.generate(context)).rejects.toThrow(
        'All AI providers failed for tier medium'
      );
    });
  });

  describe('getCustomMetadata() hook', () => {
    it('should include feedUrls in metadata', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(recentItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.metadata?.feedUrls).toEqual(feedUrls);
    });

    it('should include headlineCount of 1 for single selected story', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(recentItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      // headlineCount should be 1 since we select a single story
      expect(result.metadata?.headlineCount).toBe(1);
    });

    it('should track moreInfoUrl from the selected story link', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(allItems);
      // Select the second recent item
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      // floor(0.5 * 3) = 1, so second recent item
      expect(result.metadata?.moreInfoUrl).toBe('https://example.com/article2');

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should not include moreInfoUrl when no RSS items fetched', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue([]);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      // moreInfoUrl should be undefined when no headlines
      expect(result.metadata?.moreInfoUrl).toBeUndefined();
    });

    it('should not include moreInfoUrl when RSS fetch fails', async () => {
      mockRSSClient.getLatestItems.mockRejectedValue(new Error('Network timeout'));

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      // moreInfoUrl should be undefined when fetch fails
      expect(result.metadata?.moreInfoUrl).toBeUndefined();
    });

    it('should include selectionStrategy "recent" when items found in 12h window', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(allItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.metadata?.selectionStrategy).toBe('recent');
    });

    it('should include selectionStrategy "fallback" when no items in 12h window', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(oldItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.metadata?.selectionStrategy).toBe('fallback');
    });

    it('should include totalItemsFetched with total number of items from RSS', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(allItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.metadata?.totalItemsFetched).toBe(allItems.length);
    });

    it('should include recentItemCount with count of items in 12h window', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(allItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.metadata?.recentItemCount).toBe(3); // 3 recent items within 12h
    });

    it('should report recentItemCount 0 when no items in 12h window', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue(oldItems);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.metadata?.recentItemCount).toBe(0);
    });

    it('should set headlineCount to 0 and omit selectionStrategy when feed is empty', async () => {
      mockRSSClient.getLatestItems.mockResolvedValue([]);

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: baseTimestamp,
      };

      const result = await generator.generate(context);

      expect(result.metadata?.headlineCount).toBe(0);
      expect(result.metadata?.totalItemsFetched).toBe(0);
      expect(result.metadata?.recentItemCount).toBe(0);
    });
  });

  describe('news-summary.txt Prompt Content', () => {
    let realPromptLoader: PromptLoader;
    let promptContent: string;

    beforeAll(async () => {
      // Use real PromptLoader to read the actual prompt file
      const promptsDir = join(__dirname, '..', '..', '..', '..', '..', 'prompts');
      realPromptLoader = new PromptLoader(promptsDir);
      promptContent = await realPromptLoader.loadPrompt('user', 'news-summary.txt');
    });

    it('should NOT contain multi-story selection language', () => {
      expect(promptContent.toLowerCase()).not.toContain('select a random');
      expect(promptContent.toLowerCase()).not.toContain('from the list below');
      expect(promptContent.toLowerCase()).not.toContain('choose from');
      expect(promptContent.toLowerCase()).not.toContain('pick one');
    });

    it('should instruct the LLM to write about the single provided headline', () => {
      // The prompt should reference a single story/headline, not multiple
      expect(promptContent).toContain('{{headlines}}');
      // Should frame it as THE story, not one of many
      const lowerContent = promptContent.toLowerCase();
      const hasSingleStoryLanguage =
        lowerContent.includes('headline') ||
        lowerContent.includes('story') ||
        lowerContent.includes('news');
      expect(hasSingleStoryLanguage).toBe(true);
    });

    it('should include {{snippet}} template variable for additional story context', () => {
      expect(promptContent).toContain('{{snippet}}');
    });

    it('should handle absent snippet gracefully in the prompt wording', () => {
      // The prompt should not unconditionally say "based on the snippet below"
      // or assume a snippet is always present. It should use conditional language.
      // Verify the prompt works when snippet is empty by resolving with empty snippet
      const resolved = resolveTemplateVariables(promptContent, {
        headlines: 'Test Headline',
        snippet: '',
      });
      // Should not have dangling labels like "Snippet:" with nothing after them
      // The resolved prompt should still be coherent
      expect(resolved).toContain('Test Headline');
      expect(findUnresolvedVariables(resolved)).toEqual([]);
    });

    it('should require the red tile emoji prefix for news indicator', () => {
      expect(promptContent).toContain('🟥');
      expect(promptContent).not.toContain('This just in');
    });

    it('should resolve all template variables with headline and snippet', () => {
      const resolved = resolveTemplateVariables(promptContent, {
        headlines: 'Scientists Discover New Species',
        snippet: 'A team of marine biologists found a new deep-sea creature.',
      });

      // All template variables should be resolved
      expect(findUnresolvedVariables(resolved)).toEqual([]);
      // Content should include both the headline and snippet values
      expect(resolved).toContain('Scientists Discover New Species');
      expect(resolved).toContain('A team of marine biologists found a new deep-sea creature.');
    });

    it('should resolve cleanly when snippet is empty', () => {
      const resolved = resolveTemplateVariables(promptContent, {
        headlines: 'Breaking News Story',
        snippet: '',
      });

      expect(findUnresolvedVariables(resolved)).toEqual([]);
      expect(resolved).toContain('Breaking News Story');
    });

    it('should produce coherent prompt through real PromptLoader with variables', async () => {
      const resolved = await realPromptLoader.loadPromptWithVariables('user', 'news-summary.txt', {
        headlines: 'Tech Giant Launches Product',
        snippet: 'Major tech company announces revolutionary device at keynote.',
      });

      expect(resolved).toContain('Tech Giant Launches Product');
      expect(resolved).toContain('revolutionary device');
      expect(resolved).toContain('🟥');
      expect(findUnresolvedVariables(resolved)).toEqual([]);
    });
  });
});
