/**
 * Tests for WikipediaFactGenerator
 *
 * Test coverage:
 * - Constructor creates instance with MEDIUM tier
 * - getSystemPromptFile() returns 'major-update-base.txt'
 * - getUserPromptFile() returns 'wikipedia-fact.txt'
 * - getTemplateVariables() injects Wikipedia article data correctly
 * - getCustomMetadata() tracks article fetching status
 * - Fallback values used on API failure
 * - Mock WikipediaClient for isolation
 */

import { WikipediaFactGenerator } from '@/content/generators/ai/wikipedia-fact-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { WikipediaClient, type WikipediaArticle } from '@/api/data-sources/wikipedia';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
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

// Helper type for accessing protected members in tests
type ProtectedWikipediaFactGenerator = WikipediaFactGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('WikipediaFactGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockWikipediaClient: jest.Mocked<WikipediaClient>;

  const mockArticle: WikipediaArticle = {
    title: 'Octopus',
    extract:
      'An octopus is a soft-bodied, eight-limbed mollusc of the order Octopoda. The order consists of some 300 species and is grouped within the class Cephalopoda with squids, cuttlefish, and nautiloids. Like other cephalopods, an octopus is bilaterally symmetric with two eyes and a beaked mouth at the center point of the eight limbs. The soft body can radically alter its shape, enabling octopuses to squeeze through small gaps. They trail their eight appendages behind them as they swim. The siphon is used both for respiration and for locomotion, by expelling a jet of water.',
    description: 'Soft-bodied eight-limbed mollusc',
    url: 'https://en.wikipedia.org/wiki/Octopus',
  };

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    // Mock WikipediaClient
    mockWikipediaClient = {
      getRandomArticleSummary: jest.fn().mockResolvedValue(mockArticle),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<WikipediaClient>;

    // Mock createAIProvider to return a successful mock provider
    (createAIProvider as jest.Mock).mockReturnValue(
      createMockAIProvider({
        response: {
          text: 'DID YOU KNOW?\nOCTOPUSES HAVE THREE\nHEARTS AND BLUE BLOOD',
          model: 'gpt-4.1-mini',
          tokensUsed: 100,
        },
      })
    );
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and MEDIUM tier', () => {
      const generator = new WikipediaFactGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(WikipediaFactGenerator);
    });

    it('should accept optional WikipediaClient dependency', () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(WikipediaFactGenerator);
    });

    it('should use MEDIUM model tier for creative fact extraction', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new WikipediaFactGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWikipediaFactGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return wikipedia-fact.txt', () => {
      const generator = new WikipediaFactGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWikipediaFactGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('wikipedia-fact.txt');
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new WikipediaFactGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new WikipediaFactGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('getTemplateVariables()', () => {
    it('should fetch Wikipedia article from WikipediaClient when provided', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await generator.generate(mockContext);

      expect(mockWikipediaClient.getRandomArticleSummary).toHaveBeenCalledWith(800);
    });

    it('should inject article title into user prompt', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await generator.generate(mockContext);

      // Verify loadPromptWithVariables was called with article data
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'wikipedia-fact.txt',
        expect.objectContaining({
          articleTitle: 'Octopus',
        })
      );
    });

    it('should inject article summary into user prompt', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'wikipedia-fact.txt',
        expect.objectContaining({
          articleSummary: expect.stringContaining('octopus'),
        })
      );
    });

    it('should truncate article summary to 800 characters max', async () => {
      const longArticle: WikipediaArticle = {
        title: 'Test Article',
        extract: 'A'.repeat(1000), // 1000 chars
        url: 'https://en.wikipedia.org/wiki/Test',
      };

      mockWikipediaClient.getRandomArticleSummary.mockResolvedValue(longArticle);

      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await generator.generate(mockContext);

      // Summary should be truncated via WikipediaClient
      expect(mockWikipediaClient.getRandomArticleSummary).toHaveBeenCalledWith(800);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should track wikipediaDataFetched status', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.wikipediaDataFetched).toBe(true);
    });

    it('should track article title', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.articleTitle).toBe('Octopus');
    });

    it('should track article URL', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.articleUrl).toBe('https://en.wikipedia.org/wiki/Octopus');
    });

    it('should track article description', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.articleDescription).toBe('Soft-bodied eight-limbed mollusc');
    });
  });

  describe('fallback values on API failure', () => {
    it('should use fallback values when WikipediaClient throws error', async () => {
      mockWikipediaClient.getRandomArticleSummary.mockRejectedValue(
        new Error('Wikipedia API down')
      );

      // Spy on console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await generator.generate(mockContext);

      // Verify fallback values were used
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'wikipedia-fact.txt',
        expect.objectContaining({
          articleTitle: 'The Internet',
          articleSummary: expect.stringContaining('global system of interconnected'),
        })
      );

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch Wikipedia article for prompt:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should set wikipediaDataFetched to false on API failure', async () => {
      mockWikipediaClient.getRandomArticleSummary.mockRejectedValue(
        new Error('Wikipedia API down')
      );
      jest.spyOn(console, 'error').mockImplementation();

      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.wikipediaDataFetched).toBe(false);
    });

    it('should use fallback article URL on API failure', async () => {
      mockWikipediaClient.getRandomArticleSummary.mockRejectedValue(
        new Error('Wikipedia API down')
      );
      jest.spyOn(console, 'error').mockImplementation();

      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.articleUrl).toBe('https://en.wikipedia.org/wiki/Internet');
    });
  });

  describe('generate()', () => {
    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.text).toBe('DID YOU KNOW?\nOCTOPUSES HAVE THREE\nHEARTS AND BLUE BLOOD');
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-mini');
      expect(result.metadata?.tier).toBe(ModelTier.MEDIUM);
      expect(result.metadata?.provider).toBe('openai');
    });

    it('should load system prompt with personality variables', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await generator.generate(mockContext);

      // Verify system prompt was loaded with personality variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'system',
        'major-update-base.txt',
        expect.objectContaining({
          mood: 'cheerful',
          energyLevel: 'high',
          humorStyle: 'witty',
          obsession: 'coffee',
          persona: 'Houseboy',
        })
      );
    });

    it('should handle AI provider failures gracefully', async () => {
      (createAIProvider as jest.Mock).mockReturnValue(
        createMockAIProvider({
          shouldFail: true,
          failureError: new Error('AI provider error'),
        })
      );

      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await expect(generator.generate(mockContext)).rejects.toThrow(
        /All AI providers failed for tier/
      );
    });

    it('should failover to alternate provider on primary failure', async () => {
      const primaryProvider = createMockAIProvider({
        shouldFail: true,
        failureError: new Error('Primary provider error'),
      });

      const alternateProvider = createMockAIProvider({
        response: {
          text: 'Alternate provider content',
          model: 'claude-sonnet-4.5',
          tokensUsed: 45,
        },
      });

      (createAIProvider as jest.Mock)
        .mockReturnValueOnce(primaryProvider)
        .mockReturnValueOnce(alternateProvider);

      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        tier: ModelTier.MEDIUM,
      });

      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key', anthropic: 'test-key-2' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      expect(result.text).toBe('Alternate provider content');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toContain('Primary provider error');
    });
  });

  describe('integration with base class Template Method pattern', () => {
    it('should use getTemplateVariables() hook to inject Wikipedia data', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      await generator.generate(mockContext);

      // The hook should have been called, injecting article variables
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls[1];
      expect(userPromptCall[2]).toHaveProperty('articleTitle');
      expect(userPromptCall[2]).toHaveProperty('articleSummary');
    });

    it('should use getCustomMetadata() hook to track Wikipedia data', async () => {
      const generator = new WikipediaFactGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWikipediaClient
      );

      const result = await generator.generate(mockContext);

      // Wikipedia tracking data should be in metadata from getCustomMetadata() hook
      expect(result.metadata?.wikipediaDataFetched).toBeDefined();
      expect(result.metadata?.articleTitle).toBeDefined();
      expect(result.metadata?.articleUrl).toBeDefined();
    });

    it('should inherit retry logic from AIPromptGenerator', () => {
      const generator = new WikipediaFactGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that generate method exists (inherited from base class)
      expect(typeof generator.generate).toBe('function');
    });

    it('should inherit validation logic from AIPromptGenerator', () => {
      const generator = new WikipediaFactGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that validate method exists (inherited from base class)
      expect(typeof generator.validate).toBe('function');
    });
  });
});
