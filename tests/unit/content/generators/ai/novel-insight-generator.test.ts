/**
 * Tests for NovelInsightGenerator
 *
 * Generator-specific behavior:
 * - TOPICS (100+) and OUTPUT_STYLES (3+) static arrays
 * - Programmatic selection with Math.random (selectTopic, selectOutputStyle)
 * - Template variable injection (topic, outputStyle)
 * - Custom metadata (selectedTopic, selectedStyle)
 */

import { NovelInsightGenerator } from '@/content/generators/ai/novel-insight-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';

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

import { createAIProvider } from '@/api/ai/index';
import type { AIProvider } from '@/types/ai';

describe('NovelInsightGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  beforeEach(() => {
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn(),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;
  });

  describe('TOPICS static array', () => {
    it('should have at least 100 topics', () => {
      expect(NovelInsightGenerator.TOPICS.length).toBeGreaterThanOrEqual(100);
    });

    it('should not contain duplicate topics', () => {
      const uniqueTopics = new Set(NovelInsightGenerator.TOPICS);
      expect(uniqueTopics.size).toBe(NovelInsightGenerator.TOPICS.length);
    });

    it('should cover multiple knowledge domains', () => {
      const topics = NovelInsightGenerator.TOPICS.join(' ').toLowerCase();

      expect(topics).toMatch(/quantum|entropy|relativity|particle/);
      expect(topics).toMatch(/prime|infinity|fractal|geometry/);
      expect(topics).toMatch(/dna|evolution|cell|gene/);
      expect(topics).toMatch(/bias|cognitive|memory|perception/);
      expect(topics).toMatch(/paradox|determinism|consciousness|identity/);
    });
  });

  describe('OUTPUT_STYLES static array', () => {
    it('should have at least 3 output styles for variety', () => {
      expect(NovelInsightGenerator.OUTPUT_STYLES.length).toBeGreaterThanOrEqual(3);
    });

    it('should have unique styles with no duplicates', () => {
      const uniqueStyles = new Set(NovelInsightGenerator.OUTPUT_STYLES);
      expect(uniqueStyles.size).toBe(NovelInsightGenerator.OUTPUT_STYLES.length);
    });

    it('should have each style follow NAME: description format', () => {
      NovelInsightGenerator.OUTPUT_STYLES.forEach(style => {
        expect(style).toMatch(/^[A-Z][A-Z\s-]+:/);
        const description = style.split(':')[1];
        expect(description.trim().length).toBeGreaterThan(20);
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
      Math.random = jest.fn().mockReturnValue(0.5);
      const selectedTopic = NovelInsightGenerator.selectTopic();
      const expectedIndex = Math.floor(0.5 * NovelInsightGenerator.TOPICS.length);
      expect(selectedTopic).toBe(NovelInsightGenerator.TOPICS[expectedIndex]);
    });

    it('should select style at calculated index based on Math.random', () => {
      const randomValue = 0.9;
      Math.random = jest.fn().mockReturnValue(randomValue);
      const selectedStyle = NovelInsightGenerator.selectOutputStyle();
      const expectedIndex = Math.floor(randomValue * NovelInsightGenerator.OUTPUT_STYLES.length);
      expect(selectedStyle).toBe(NovelInsightGenerator.OUTPUT_STYLES[expectedIndex]);
    });
  });

  describe('template variable injection', () => {
    let originalRandom: () => number;

    beforeEach(() => {
      originalRandom = Math.random;
      mockPromptLoader.loadPromptWithVariables.mockReset();
      mockModelTierSelector.select.mockReset();
      mockModelTierSelector.getAlternate.mockReset();
    });

    afterEach(() => {
      Math.random = originalRandom;
    });

    it('should inject selected topic into user prompt variables', async () => {
      Math.random = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(0);

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
      expect(templateVars).toHaveProperty('topic');
      expect(templateVars.topic).toBe(NovelInsightGenerator.TOPICS[0]);
    });

    it('should inject selected outputStyle into user prompt variables', async () => {
      Math.random = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.5);

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
      const expectedStyleIndex = Math.floor(0.5 * NovelInsightGenerator.OUTPUT_STYLES.length);
      expect(templateVars.outputStyle).toBe(
        NovelInsightGenerator.OUTPUT_STYLES[expectedStyleIndex]
      );
    });
  });

  describe('custom metadata', () => {
    let originalRandom: () => number;

    beforeEach(() => {
      originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0);
    });

    afterEach(() => {
      Math.random = originalRandom;
    });

    it('should include selectedTopic and selectedStyle in result metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const mockAIProvider: jest.Mocked<AIProvider> = {
        generate: jest.fn().mockResolvedValue({
          text: 'DID YOU KNOW THAT\nQUANTUM ENTANGLEMENT\nIS LIKE COSMIC WIFI',
          model: 'gpt-4.1-mini',
          tokensUsed: 50,
        }),
        validateConnection: jest.fn(),
      } as unknown as jest.Mocked<AIProvider>;
      (createAIProvider as jest.Mock).mockReturnValue(mockAIProvider);

      const generator = new NovelInsightGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate({
        timestamp: new Date('2024-01-15T10:00:00Z'),
        updateType: 'major',
      });

      expect(result.metadata?.selectedTopic).toBe(NovelInsightGenerator.TOPICS[0]);
      expect(result.metadata?.selectedStyle).toBe(NovelInsightGenerator.OUTPUT_STYLES[0]);
    });
  });
});
