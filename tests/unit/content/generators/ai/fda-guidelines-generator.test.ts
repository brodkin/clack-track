/**
 * Tests for FdaGuidelinesGenerator
 *
 * Generator-specific behavior:
 * - REGULATORY_BODIES (12), TOPIC_CATEGORIES (10 categories, ~80 sub-topics),
 *   PRESENTATION_ANGLES (8) arrays
 * - getTemplateVariables() returning { regulatoryBody, topicArea, presentationAngle }
 * - Instance property storage and getCustomMetadata()
 * - Template variable passing in generate()
 */

import { FdaGuidelinesGenerator } from '@/content/generators/ai/fda-guidelines-generator';
import {
  REGULATORY_BODIES,
  TOPIC_CATEGORIES,
  PRESENTATION_ANGLES,
  selectRandomItem,
  selectRandomCategory,
  selectRandomTopic,
  type TopicCategory,
} from '@/content/generators/ai/fda-guidelines-dictionaries';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedFdaGuidelinesGenerator = FdaGuidelinesGenerator & {
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedBody: string;
  selectedCategory: string;
  selectedTopic: string;
  selectedAngle: string;
};

describe('FdaGuidelinesGenerator', () => {
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
        text: 'FDA: ICE CREAM MUST\nCONTAIN 10% MILKFAT',
        model: 'gpt-4.1-mini',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('dictionary arrays', () => {
    it('should have REGULATORY_BODIES array with 12 unique items', () => {
      expect(REGULATORY_BODIES).toHaveLength(12);
      const unique = new Set(REGULATORY_BODIES);
      expect(unique.size).toBe(REGULATORY_BODIES.length);
    });

    it('should have TOPIC_CATEGORIES with 10 category keys', () => {
      const categoryKeys = Object.keys(TOPIC_CATEGORIES);
      expect(categoryKeys).toHaveLength(10);
    });

    it('should have at least 8 sub-topics per category', () => {
      const categoryKeys = Object.keys(TOPIC_CATEGORIES) as TopicCategory[];
      categoryKeys.forEach(category => {
        expect(TOPIC_CATEGORIES[category].length).toBeGreaterThanOrEqual(8);
      });
    });

    it('should have PRESENTATION_ANGLES array with 8 unique items', () => {
      expect(PRESENTATION_ANGLES).toHaveLength(8);
      const unique = new Set(PRESENTATION_ANGLES);
      expect(unique.size).toBe(PRESENTATION_ANGLES.length);
    });

    it('should have non-empty string values in REGULATORY_BODIES', () => {
      REGULATORY_BODIES.forEach((body: string) => {
        expect(typeof body).toBe('string');
        expect(body.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty string values in all TOPIC_CATEGORIES sub-topics', () => {
      const categoryKeys = Object.keys(TOPIC_CATEGORIES) as TopicCategory[];
      categoryKeys.forEach(category => {
        TOPIC_CATEGORIES[category].forEach((topic: string) => {
          expect(typeof topic).toBe('string');
          expect(topic.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have non-empty string values in PRESENTATION_ANGLES', () => {
      PRESENTATION_ANGLES.forEach((angle: string) => {
        expect(typeof angle).toBe('string');
        expect(angle.length).toBeGreaterThan(0);
      });
    });

    it('should have at least 7000 total combinations', () => {
      const categoryKeys = Object.keys(TOPIC_CATEGORIES) as TopicCategory[];
      const totalSubTopics = categoryKeys.reduce(
        (sum, cat) => sum + TOPIC_CATEGORIES[cat].length,
        0
      );
      const totalCombinations =
        REGULATORY_BODIES.length * totalSubTopics * PRESENTATION_ANGLES.length;
      expect(totalCombinations).toBeGreaterThanOrEqual(7000);
    });
  });

  describe('selectRandomItem()', () => {
    it('should return an item from the provided array', () => {
      const result = selectRandomItem(REGULATORY_BODIES);
      expect(REGULATORY_BODIES).toContain(result);
    });

    it('should throw error for empty array', () => {
      expect(() => selectRandomItem([])).toThrow('Cannot select from empty array');
    });
  });

  describe('selectRandomCategory()', () => {
    it('should return a valid TopicCategory key', () => {
      const category = selectRandomCategory();
      expect(Object.keys(TOPIC_CATEGORIES)).toContain(category);
    });
  });

  describe('selectRandomTopic()', () => {
    it('should return a string from the correct category array', () => {
      const category: TopicCategory = 'FOOD_DEFINITIONS';
      const topic = selectRandomTopic(category);
      expect(TOPIC_CATEGORIES[category]).toContain(topic);
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return regulatoryBody, topicArea, and presentationAngle', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFdaGuidelinesGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.regulatoryBody).toBeDefined();
      expect(templateVars.topicArea).toBeDefined();
      expect(templateVars.presentationAngle).toBeDefined();
    });

    it('should return values from valid arrays', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFdaGuidelinesGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(REGULATORY_BODIES).toContain(templateVars.regulatoryBody);
      expect(PRESENTATION_ANGLES).toContain(templateVars.presentationAngle);
      // topicArea comes from a nested category, verify it's a non-empty string
      expect(typeof templateVars.topicArea).toBe('string');
      expect(templateVars.topicArea.length).toBeGreaterThan(0);
    });

    it('should store selections in instance properties', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFdaGuidelinesGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedBody).toBe(templateVars.regulatoryBody);
      expect(generator.selectedTopic).toBe(templateVars.topicArea);
      expect(generator.selectedAngle).toBe(templateVars.presentationAngle);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFdaGuidelinesGenerator;

      const bodyResults = new Set<string>();
      const topicResults = new Set<string>();
      const angleResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        bodyResults.add(templateVars.regulatoryBody);
        topicResults.add(templateVars.topicArea);
        angleResults.add(templateVars.presentationAngle);
      }

      expect(bodyResults.size).toBeGreaterThan(1);
      expect(topicResults.size).toBeGreaterThan(1);
      expect(angleResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should match instance properties', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFdaGuidelinesGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.regulatoryBody).toBe(generator.selectedBody);
      expect(metadata.topicCategory).toBe(generator.selectedCategory);
      expect(metadata.topicArea).toBe(generator.selectedTopic);
      expect(metadata.presentationAngle).toBe(generator.selectedAngle);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      jest
        .spyOn(
          FdaGuidelinesGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should pass template variables to PromptLoader', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'fda-guidelines.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.regulatoryBody).toBeDefined();
      expect(templateVars.topicArea).toBeDefined();
      expect(templateVars.presentationAngle).toBeDefined();
    });

    it('should include selections in result metadata', async () => {
      const generator = new FdaGuidelinesGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.regulatoryBody).toBeDefined();
      expect(result.metadata?.topicCategory).toBeDefined();
      expect(result.metadata?.topicArea).toBeDefined();
      expect(result.metadata?.presentationAngle).toBeDefined();
    });
  });
});
