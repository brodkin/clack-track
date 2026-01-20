/**
 * Tests for NovelInsightGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses MEDIUM model tier for complex reasoning (fresh perspectives need more reasoning)
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Works without API keys (default empty object)
 * - Integration with PromptLoader (mock the loader)
 * - Handles missing prompt files gracefully
 * - TOPICS array contains 100+ topics organized by category
 * - OUTPUT_STYLES array contains multiple distinct style definitions
 * - Programmatic topic selection using Math.random()
 * - Template variable injection for topic and outputStyle
 * - Successful generation with AI provider
 * - Alternate provider failover on primary failure
 */

import { NovelInsightGenerator } from '@/content/generators/ai/novel-insight-generator';
import { AIPromptGenerator } from '@/content/generators/ai-prompt-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import { createAIProvider } from '@/api/ai/index';
import type { AIProvider } from '@/types/ai';

// Mock the AI provider factory
jest.mock('@/api/ai/index', () => ({
  createAIProvider: jest.fn(),
  AIProviderType: {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
  },
}));

// Mock personality generation for consistent tests (avoid consuming Math.random)
jest.mock('@/content/personality/index.js', () => ({
  generatePersonalityDimensions: jest.fn(() => ({
    mood: 'cheerful',
    energyLevel: 'high',
    humorStyle: 'witty',
    obsession: 'coffee',
  })),
}));

// Helper type for accessing protected members in tests
type ProtectedNovelInsightGenerator = NovelInsightGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  promptLoader: PromptLoader;
  modelTierSelector: ModelTierSelector;
};

describe('NovelInsightGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn(),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;
  });

  describe('class inheritance', () => {
    it('should extend AIPromptGenerator', () => {
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeInstanceOf(AIPromptGenerator);
    });
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and MEDIUM tier', () => {
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(NovelInsightGenerator);
    });

    it('should use MEDIUM model tier for complex reasoning', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify via observable behavior: modelTierSelector.select is called with MEDIUM tier
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should work without API keys (default empty object)', () => {
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(NovelInsightGenerator);
    });

    it('should store the PromptLoader instance', () => {
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNovelInsightGenerator;

      expect(generator.promptLoader).toBe(mockPromptLoader);
    });

    it('should store the ModelTierSelector instance', () => {
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNovelInsightGenerator;

      expect(generator.modelTierSelector).toBe(mockModelTierSelector);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNovelInsightGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return novel-insight.txt', () => {
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNovelInsightGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('novel-insight.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when system prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockRejectedValueOnce(new Error('File not found: major-update-base.txt')) // system prompt missing
        .mockResolvedValueOnce('user prompt content'); // user prompt exists

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt exists
        .mockRejectedValueOnce(new Error('File not found: novel-insight.txt')); // user prompt missing

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should return invalid when both prompt files are missing', async () => {
      mockPromptLoader.loadPrompt
        .mockRejectedValueOnce(new Error('File not found: major-update-base.txt'))
        .mockRejectedValueOnce(new Error('File not found: novel-insight.txt'));

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBe(2);
    });

    it('should call PromptLoader.loadPrompt with correct arguments', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.validate();

      expect(mockPromptLoader.loadPrompt).toHaveBeenCalledTimes(2);
      expect(mockPromptLoader.loadPrompt).toHaveBeenCalledWith('system', 'major-update-base.txt');
      expect(mockPromptLoader.loadPrompt).toHaveBeenCalledWith('user', 'novel-insight.txt');
    });
  });

  describe('generate()', () => {
    it('should load correct prompts and use MEDIUM tier', () => {
      // This test verifies the generator calls the right methods
      // The actual generation logic is tested in the base class tests
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNovelInsightGenerator;

      // Verify the generator uses the correct prompt files
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('novel-insight.txt');
      expect(generator.modelTier).toBe(ModelTier.MEDIUM);
    });
  });

  describe('TOPICS static array', () => {
    it('should have at least 100 topics', () => {
      expect(NovelInsightGenerator.TOPICS.length).toBeGreaterThanOrEqual(100);
    });

    it('should be a readonly array', () => {
      // TypeScript enforces readonly at compile time, but we can verify
      // the array exists and is accessible as a static property
      expect(Array.isArray(NovelInsightGenerator.TOPICS)).toBe(true);
    });

    it('should contain only non-empty strings', () => {
      NovelInsightGenerator.TOPICS.forEach(topic => {
        expect(typeof topic).toBe('string');
        expect(topic.trim().length).toBeGreaterThan(0);
      });
    });

    it('should not contain duplicate topics', () => {
      const uniqueTopics = new Set(NovelInsightGenerator.TOPICS);
      expect(uniqueTopics.size).toBe(NovelInsightGenerator.TOPICS.length);
    });

    it('should cover multiple knowledge domains', () => {
      // Check for diversity by looking for keywords from different domains
      const topics = NovelInsightGenerator.TOPICS.join(' ').toLowerCase();

      // Physics domain
      expect(topics).toMatch(/quantum|entropy|relativity|particle/);
      // Mathematics domain
      expect(topics).toMatch(/prime|infinity|fractal|geometry/);
      // Biology domain
      expect(topics).toMatch(/dna|evolution|cell|gene/);
      // Psychology domain
      expect(topics).toMatch(/bias|cognitive|memory|perception/);
      // Philosophy domain
      expect(topics).toMatch(/paradox|determinism|consciousness|identity/);
    });
  });

  describe('OUTPUT_STYLES static array', () => {
    it('should have at least 3 output styles for variety', () => {
      expect(NovelInsightGenerator.OUTPUT_STYLES.length).toBeGreaterThanOrEqual(3);
    });

    it('should be a readonly array', () => {
      expect(Array.isArray(NovelInsightGenerator.OUTPUT_STYLES)).toBe(true);
    });

    it('should have unique styles with no duplicates', () => {
      const uniqueStyles = new Set(NovelInsightGenerator.OUTPUT_STYLES);
      expect(uniqueStyles.size).toBe(NovelInsightGenerator.OUTPUT_STYLES.length);
    });

    it('should have each style follow NAME: description format', () => {
      NovelInsightGenerator.OUTPUT_STYLES.forEach(style => {
        // Each style should have a name followed by colon and description
        expect(style).toMatch(/^[A-Z][A-Z\s-]+:/);
        // Description should be at least 20 chars
        const description = style.split(':')[1];
        expect(description.trim().length).toBeGreaterThan(20);
      });
    });

    it('should contain only non-empty strings', () => {
      NovelInsightGenerator.OUTPUT_STYLES.forEach(style => {
        expect(typeof style).toBe('string');
        expect(style.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('programmatic topic selection', () => {
    let originalRandom: () => number;

    beforeEach(() => {
      originalRandom = Math.random;
    });

    afterEach(() => {
      Math.random = originalRandom;
    });

    it('should select first topic when Math.random returns 0', () => {
      Math.random = jest.fn().mockReturnValue(0);

      const selectedTopic = NovelInsightGenerator.selectTopic();

      expect(selectedTopic).toBe(NovelInsightGenerator.TOPICS[0]);
    });

    it('should select last topic when Math.random returns 0.999...', () => {
      Math.random = jest.fn().mockReturnValue(0.9999999);

      const selectedTopic = NovelInsightGenerator.selectTopic();

      expect(selectedTopic).toBe(
        NovelInsightGenerator.TOPICS[NovelInsightGenerator.TOPICS.length - 1]
      );
    });

    it('should select topic at calculated index based on Math.random', () => {
      // Mock to return 0.5 - should select middle topic
      Math.random = jest.fn().mockReturnValue(0.5);

      const selectedTopic = NovelInsightGenerator.selectTopic();
      const expectedIndex = Math.floor(0.5 * NovelInsightGenerator.TOPICS.length);

      expect(selectedTopic).toBe(NovelInsightGenerator.TOPICS[expectedIndex]);
    });

    it('should select first style when Math.random returns 0', () => {
      Math.random = jest.fn().mockReturnValue(0);

      const selectedStyle = NovelInsightGenerator.selectOutputStyle();

      expect(selectedStyle).toBe(NovelInsightGenerator.OUTPUT_STYLES[0]);
    });

    it('should select style at calculated index based on Math.random', () => {
      const randomValue = 0.9;
      Math.random = jest.fn().mockReturnValue(randomValue);

      const selectedStyle = NovelInsightGenerator.selectOutputStyle();
      const expectedIndex = Math.floor(randomValue * NovelInsightGenerator.OUTPUT_STYLES.length);

      expect(selectedStyle).toBe(NovelInsightGenerator.OUTPUT_STYLES[expectedIndex]);
    });
  });

  describe('generate() with template variable injection', () => {
    let originalRandom: () => number;

    beforeEach(() => {
      originalRandom = Math.random;
      // Reset mocks
      mockPromptLoader.loadPromptWithVariables.mockReset();
      mockModelTierSelector.select.mockReset();
      mockModelTierSelector.getAlternate.mockReset();
    });

    afterEach(() => {
      Math.random = originalRandom;
    });

    it('should throw error when API key is not found', async () => {
      Math.random = jest.fn().mockReturnValue(0);
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      // Create generator WITHOUT API keys
      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {});

      await expect(
        generator.generate({
          timestamp: new Date('2024-01-15T10:00:00Z'),
          updateType: 'major',
        })
      ).rejects.toThrow('API key not found for provider: openai');
    });

    it('should inject selected topic into user prompt variables', async () => {
      // Mock deterministic random selection
      Math.random = jest
        .fn()
        .mockReturnValueOnce(0) // First call for topic selection
        .mockReturnValueOnce(0); // Second call for style selection

      // Mock the prompt loader to capture the variables passed
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');

      // Mock model selection
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Generate will fail without proper AI provider mock, but we can check the prompt loader calls
      try {
        await generator.generate({
          timestamp: new Date('2024-01-15T10:00:00Z'),
          updateType: 'major',
        });
      } catch {
        // Expected to fail - we just want to verify the prompt loading
      }

      // Find the call for the user prompt
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'novel-insight.txt'
      );

      expect(userPromptCall).toBeDefined();
      // The third argument should contain the template variables
      const templateVars = userPromptCall![2];
      expect(templateVars).toHaveProperty('topic');
      expect(templateVars.topic).toBe(NovelInsightGenerator.TOPICS[0]);
    });

    it('should inject selected outputStyle into user prompt variables', async () => {
      // Mock deterministic random selection
      Math.random = jest
        .fn()
        .mockReturnValueOnce(0) // First call for topic selection
        .mockReturnValueOnce(0.5); // Second call for style selection (middle)

      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({
          timestamp: new Date('2024-01-15T10:00:00Z'),
          updateType: 'major',
        });
      } catch {
        // Expected to fail
      }

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'novel-insight.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall![2];
      expect(templateVars).toHaveProperty('outputStyle');
      // Verify outputStyle matches dynamically calculated index
      const expectedStyleIndex = Math.floor(0.5 * NovelInsightGenerator.OUTPUT_STYLES.length);
      expect(templateVars.outputStyle).toBe(
        NovelInsightGenerator.OUTPUT_STYLES[expectedStyleIndex]
      );
    });

    it('should use different topics when Math.random returns different values', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // First generation with random at 0.1
      Math.random = jest.fn().mockReturnValue(0.1);
      try {
        await generator.generate({
          timestamp: new Date('2024-01-15T10:00:00Z'),
          updateType: 'major',
        });
      } catch {
        // Expected
      }

      const firstCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'novel-insight.txt'
      );
      const firstTopic = firstCall![2].topic;

      // Reset mocks for second generation
      mockPromptLoader.loadPromptWithVariables.mockClear();

      // Second generation with random at 0.9
      Math.random = jest.fn().mockReturnValue(0.9);
      try {
        await generator.generate({
          timestamp: new Date('2024-01-15T10:00:00Z'),
          updateType: 'major',
        });
      } catch {
        // Expected
      }

      const secondCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'novel-insight.txt'
      );
      const secondTopic = secondCall![2].topic;

      // Topics should be different
      expect(firstTopic).not.toBe(secondTopic);
    });
  });

  describe('generate() with mocked AI provider', () => {
    let originalRandom: () => number;
    let mockAIProvider: jest.Mocked<AIProvider>;
    const mockCreateAIProvider = createAIProvider as jest.MockedFunction<typeof createAIProvider>;

    beforeEach(() => {
      originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0);

      // Reset all mocks
      mockPromptLoader.loadPromptWithVariables.mockReset();
      mockModelTierSelector.select.mockReset();
      mockModelTierSelector.getAlternate.mockReset();
      mockCreateAIProvider.mockReset();

      // Create a mock AI provider
      mockAIProvider = {
        generate: jest.fn(),
        validateConnection: jest.fn(),
      } as unknown as jest.Mocked<AIProvider>;
    });

    afterEach(() => {
      Math.random = originalRandom;
    });

    it('should successfully generate content with preferred provider', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      // Mock successful AI generation
      mockAIProvider.generate.mockResolvedValue({
        text: 'DID YOU KNOW THAT\nQUANTUM ENTANGLEMENT\nIS LIKE COSMIC WIFI',
        model: 'gpt-4.1-mini',
        tokensUsed: 50,
      });
      mockCreateAIProvider.mockReturnValue(mockAIProvider);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate({
        timestamp: new Date('2024-01-15T10:00:00Z'),
        updateType: 'major',
      });

      expect(result.text).toBe('DID YOU KNOW THAT\nQUANTUM ENTANGLEMENT\nIS LIKE COSMIC WIFI');
      expect(result.outputMode).toBe('text');
      expect(result.metadata?.provider).toBe('openai');
      expect(result.metadata?.model).toBe('gpt-4.1-mini');
      expect(result.metadata?.tier).toBe(ModelTier.MEDIUM);
      expect(result.metadata?.selectedTopic).toBe(NovelInsightGenerator.TOPICS[0]);
      expect(result.metadata?.selectedStyle).toBe(NovelInsightGenerator.OUTPUT_STYLES[0]);
    });

    it('should failover to alternate provider when primary fails', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
      });

      // Create separate mock providers for primary and alternate
      const primaryProvider: jest.Mocked<AIProvider> = {
        generate: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
        validateConnection: jest.fn(),
      } as unknown as jest.Mocked<AIProvider>;

      const alternateProvider: jest.Mocked<AIProvider> = {
        generate: jest.fn().mockResolvedValue({
          text: 'WHAT IF MEMORIES\nARE JUST STORIES\nWE TELL OURSELVES',
          model: 'claude-sonnet-4.5',
          tokensUsed: 45,
        }),
        validateConnection: jest.fn(),
      } as unknown as jest.Mocked<AIProvider>;

      // First call returns primary (which fails), second returns alternate
      mockCreateAIProvider
        .mockReturnValueOnce(primaryProvider)
        .mockReturnValueOnce(alternateProvider);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
        anthropic: 'test-anthropic-key',
      });

      const result = await generator.generate({
        timestamp: new Date('2024-01-15T10:00:00Z'),
        updateType: 'major',
      });

      expect(result.text).toBe('WHAT IF MEMORIES\nARE JUST STORIES\nWE TELL OURSELVES');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.model).toBe('claude-sonnet-4.5');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toBe('Rate limit exceeded');
      expect(result.metadata?.selectedTopic).toBe(NovelInsightGenerator.TOPICS[0]);
    });

    it('should throw error when all providers fail', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
      });

      // Both providers fail
      const failingProvider: jest.Mocked<AIProvider> = {
        generate: jest.fn().mockRejectedValue(new Error('Service unavailable')),
        validateConnection: jest.fn(),
      } as unknown as jest.Mocked<AIProvider>;

      mockCreateAIProvider.mockReturnValue(failingProvider);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
        anthropic: 'test-anthropic-key',
      });

      await expect(
        generator.generate({
          timestamp: new Date('2024-01-15T10:00:00Z'),
          updateType: 'major',
        })
      ).rejects.toThrow('All AI providers failed for tier medium: Service unavailable');
    });

    it('should include personality in metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      mockAIProvider.generate.mockResolvedValue({
        text: 'TEST CONTENT',
        model: 'gpt-4.1-mini',
        tokensUsed: 20,
      });
      mockCreateAIProvider.mockReturnValue(mockAIProvider);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate({
        timestamp: new Date('2024-01-15T10:00:00Z'),
        updateType: 'major',
      });

      expect(result.metadata?.personality).toBeDefined();
      expect(result.metadata?.personality).toHaveProperty('mood');
      expect(result.metadata?.personality).toHaveProperty('energyLevel');
      expect(result.metadata?.personality).toHaveProperty('humorStyle');
      expect(result.metadata?.personality).toHaveProperty('obsession');
    });

    it('should apply dimension substitution to system prompt', async () => {
      // System prompt contains {{maxChars}} and {{maxLines}} placeholders
      const systemPromptWithPlaceholders =
        'Content must fit {{maxChars}} chars per line across {{maxLines}} lines.';
      const expectedSubstitutedPrompt = 'Content must fit 21 chars per line across 5 lines.';

      mockPromptLoader.loadPromptWithVariables.mockImplementation(
        async (type: string, _file: string, _vars?: Record<string, unknown>) => {
          if (type === 'system') {
            return systemPromptWithPlaceholders;
          }
          return 'user prompt content';
        }
      );

      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      mockAIProvider.generate.mockResolvedValue({
        text: 'GENERATED CONTENT',
        model: 'gpt-4.1-mini',
        tokensUsed: 30,
      });
      mockCreateAIProvider.mockReturnValue(mockAIProvider);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate({
        timestamp: new Date('2024-01-15T10:00:00Z'),
        updateType: 'major',
      });

      // Verify the AI provider was called with the substituted system prompt
      expect(mockAIProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expectedSubstitutedPrompt,
        })
      );
    });

    it('should include date template variable in system prompt loading', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      mockAIProvider.generate.mockResolvedValue({
        text: 'GENERATED CONTENT',
        model: 'gpt-4.1-mini',
        tokensUsed: 30,
      });
      mockCreateAIProvider.mockReturnValue(mockAIProvider);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const testDate = new Date('2024-01-15T10:00:00Z');
      await generator.generate({
        timestamp: testDate,
        updateType: 'major',
      });

      // Find the call for the system prompt
      const systemPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'system' && call[1] === 'major-update-base.txt'
      );

      expect(systemPromptCall).toBeDefined();
      const templateVars = systemPromptCall![2] as Record<string, unknown>;

      // Verify date template variable is included
      expect(templateVars).toHaveProperty('date');
      // The date should be formatted like "Monday, January 15, 2024"
      expect(templateVars.date).toBe('Monday, January 15, 2024');
    });
  });
});
