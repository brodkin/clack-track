/**
 * Tests for ZaydeWisdomGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses MEDIUM model tier (character voice needs context)
 * - Returns correct system and user prompt file names
 * - TOPICS array with 12 kvetch-worthy subjects
 * - APPROACHES array with 10 delivery styles
 * - APPROACH_GUIDANCE record with guidance for each approach
 * - getTemplateVariables() returning { payload, approach, approachGuidance }
 * - getCustomMetadata() returning topic and approach tracking
 * - Dual dictionary randomization produces valid combinations
 */

import { ZaydeWisdomGenerator, TOPICS, APPROACHES, APPROACH_GUIDANCE } from '@/content/generators/ai/zayde-wisdom-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedZaydeWisdomGenerator = ZaydeWisdomGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedTopic: string;
  selectedApproach: string;
  modelTier: ModelTier;
};

describe('ZaydeWisdomGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  const mockAIContent = `OY THE PRICE OF EGGS
YOU COULD BUY A HOUSE
IN THE BRONX FOR WHAT
THEY CHARGE NOW BUT
WHAT DO I KNOW`;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
      loadPromptTemplateWithVariables: jest.fn(),
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

    // Mock AIProvider with successful response
    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: mockAIContent,
        model: 'gpt-4.1-mini',
        tokensUsed: 80,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and MEDIUM tier', () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(ZaydeWisdomGenerator);
    });

    it('should use MEDIUM model tier for character voice depth', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should work without API keys (default empty object)', () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(ZaydeWisdomGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return zayde-wisdom.txt', () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('zayde-wisdom.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content')
        .mockRejectedValueOnce(new Error('File not found: zayde-wisdom.txt'));

      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('topics array', () => {
    it('should have TOPICS array with 12 kvetch-worthy subjects', () => {
      expect(TOPICS).toBeDefined();
      expect(Array.isArray(TOPICS)).toBe(true);
      expect(TOPICS).toHaveLength(12);
    });

    it('should have unique topics', () => {
      const uniqueTopics = new Set(TOPICS);
      expect(uniqueTopics.size).toBe(TOPICS.length);
    });

    it('should have non-empty string values in topics', () => {
      TOPICS.forEach((topic: string) => {
        expect(typeof topic).toBe('string');
        expect(topic.length).toBeGreaterThan(0);
      });
    });

    it('should include the specified topics from requirements', () => {
      const requiredTopics = [
        'the price of things',
        'telemarketers',
        'the doctor',
        'technology',
        'the weather',
        'kids today',
        'the old neighborhood',
        'his knees',
        'restaurants',
        'traffic',
        'the news',
        'grocery shopping',
      ];

      requiredTopics.forEach(topic => {
        expect(TOPICS).toContain(topic);
      });
    });
  });

  describe('approaches array', () => {
    it('should have APPROACHES array with 10 delivery styles', () => {
      expect(APPROACHES).toBeDefined();
      expect(Array.isArray(APPROACHES)).toBe(true);
      expect(APPROACHES).toHaveLength(10);
    });

    it('should have unique approaches', () => {
      const uniqueApproaches = new Set(APPROACHES);
      expect(uniqueApproaches.size).toBe(APPROACHES.length);
    });

    it('should have non-empty string values in approaches', () => {
      APPROACHES.forEach((approach: string) => {
        expect(typeof approach).toBe('string');
        expect(approach.length).toBeGreaterThan(0);
      });
    });

    it('should have APPROACH_GUIDANCE for every approach', () => {
      APPROACHES.forEach(approach => {
        expect(APPROACH_GUIDANCE[approach]).toBeDefined();
        expect(typeof APPROACH_GUIDANCE[approach]).toBe('string');
        expect(APPROACH_GUIDANCE[approach].length).toBeGreaterThan(0);
      });
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return payload with selected topic', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.payload).toBeDefined();
      expect(typeof templateVars.payload).toBe('string');
    });

    it('should return topic from TOPICS array', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(TOPICS).toContain(templateVars.payload);
    });

    it('should return approach with selected delivery style', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.approach).toBeDefined();
      expect(APPROACHES).toContain(templateVars.approach);
    });

    it('should return approachGuidance matching the selected approach', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.approachGuidance).toBeDefined();
      expect(templateVars.approachGuidance).toBe(
        APPROACH_GUIDANCE[templateVars.approach as (typeof APPROACHES)[number]]
      );
    });

    it('should store selected topic and approach in instance properties', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedTopic).toBe(templateVars.payload);
      expect(generator.selectedApproach).toBe(templateVars.approach);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      const topicResults = new Set<string>();

      for (let i = 0; i < 30; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        topicResults.add(templateVars.payload);
      }

      // With random selection from 12 topics, we should get at least 2 different values
      expect(topicResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should return topic and approach in metadata', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.topic).toBeDefined();
      expect(typeof metadata.topic).toBe('string');
      expect(metadata.approach).toBeDefined();
      expect(typeof metadata.approach).toBe('string');
    });

    it('should match instance properties', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.topic).toBe(generator.selectedTopic);
      expect(metadata.approach).toBe(generator.selectedApproach);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      jest
        .spyOn(
          ZaydeWisdomGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should load correct prompts and use MEDIUM tier', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedZaydeWisdomGenerator;

      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('zayde-wisdom.txt');

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should pass payload, approach, and approachGuidance to PromptLoader template variables', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalled();

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'zayde-wisdom.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.payload).toBeDefined();
      expect(TOPICS).toContain(templateVars.payload);
      expect(templateVars.approach).toBeDefined();
      expect(APPROACHES).toContain(templateVars.approach);
      expect(templateVars.approachGuidance).toBeDefined();
    });

    it('should include topic and approach in result metadata', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.topic).toBeDefined();
      expect(result.metadata?.approach).toBeDefined();
    });

    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-mini');
      expect(result.metadata?.tier).toBe(ModelTier.MEDIUM);
      expect(result.metadata?.provider).toBe('openai');
    });

    describe('error handling', () => {
      it('should handle AI provider failures gracefully', async () => {
        const generator = new ZaydeWisdomGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        mockAIProvider.generate.mockRejectedValue(new Error('AI provider error'));
        mockModelTierSelector.getAlternate.mockReturnValue(null);

        await expect(generator.generate(mockContext)).rejects.toThrow(
          /All AI providers failed for tier/
        );
      });
    });
  });
});
