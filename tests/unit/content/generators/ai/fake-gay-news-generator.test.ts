/**
 * Tests for FakeGayNewsGenerator
 *
 * Generator-specific behavior:
 * - GAY_NEWS_TOPICS and GAY_NEWS_FORMATS variety arrays
 * - getTemplateVariables() returning { gayNewsTopic, gayNewsFormat }
 * - Instance property storage and getCustomMetadata()
 * - Template variable passing in generate()
 */

import {
  FakeGayNewsGenerator,
  GAY_NEWS_TOPICS,
  GAY_NEWS_FORMATS,
} from '@/content/generators/ai/fake-gay-news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedFakeGayNewsGenerator = FakeGayNewsGenerator & {
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedTopic: string;
  selectedFormat: string;
};

describe('FakeGayNewsGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: '🟪 AREA BOTTOM REPORTS\nMISSING HARNESS',
        model: 'gpt-4.1-mini',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('variety arrays', () => {
    it('should have GAY_NEWS_TOPICS array with unique items', () => {
      expect(GAY_NEWS_TOPICS.length).toBeGreaterThanOrEqual(30);
      const uniqueTopics = new Set(GAY_NEWS_TOPICS);
      expect(uniqueTopics.size).toBe(GAY_NEWS_TOPICS.length);
    });

    it('should have GAY_NEWS_FORMATS array with unique items', () => {
      expect(GAY_NEWS_FORMATS.length).toBeGreaterThanOrEqual(15);
      const uniqueFormats = new Set(GAY_NEWS_FORMATS);
      expect(uniqueFormats.size).toBe(GAY_NEWS_FORMATS.length);
    });

    it('should have non-empty string values in topics', () => {
      GAY_NEWS_TOPICS.forEach((topic: string) => {
        expect(typeof topic).toBe('string');
        expect(topic.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty string values in formats', () => {
      GAY_NEWS_FORMATS.forEach((format: string) => {
        expect(typeof format).toBe('string');
        expect(format.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return gayNewsTopic and gayNewsFormat', async () => {
      const generator = new FakeGayNewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFakeGayNewsGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.gayNewsTopic).toBeDefined();
      expect(templateVars.gayNewsFormat).toBeDefined();
    });

    it('should return values from valid arrays', async () => {
      const generator = new FakeGayNewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFakeGayNewsGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(GAY_NEWS_TOPICS).toContain(templateVars.gayNewsTopic);
      expect(GAY_NEWS_FORMATS).toContain(templateVars.gayNewsFormat);
    });

    it('should store selections in instance properties', async () => {
      const generator = new FakeGayNewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFakeGayNewsGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedTopic).toBe(templateVars.gayNewsTopic);
      expect(generator.selectedFormat).toBe(templateVars.gayNewsFormat);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new FakeGayNewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFakeGayNewsGenerator;

      const topicResults = new Set<string>();
      const formatResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        topicResults.add(templateVars.gayNewsTopic);
        formatResults.add(templateVars.gayNewsFormat);
      }

      expect(topicResults.size).toBeGreaterThan(1);
      expect(formatResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should match instance properties', async () => {
      const generator = new FakeGayNewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFakeGayNewsGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.selectedTopic).toBe(generator.selectedTopic);
      expect(metadata.selectedFormat).toBe(generator.selectedFormat);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      jest
        .spyOn(
          FakeGayNewsGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should pass gayNewsTopic and gayNewsFormat to PromptLoader template variables', async () => {
      const generator = new FakeGayNewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'fake-gay-news.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.gayNewsTopic).toBeDefined();
      expect(templateVars.gayNewsFormat).toBeDefined();
    });

    it('should include selectedTopic and selectedFormat in result metadata', async () => {
      const generator = new FakeGayNewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.selectedTopic).toBeDefined();
      expect(result.metadata?.selectedFormat).toBeDefined();
    });
  });
});
