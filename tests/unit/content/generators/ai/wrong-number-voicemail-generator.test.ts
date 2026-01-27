/**
 * Tests for WrongNumberVoicemailGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - CALLER_ARCHETYPES array (15 items) for caller energy types
 * - SITUATION_DOMAINS array (20 items) for chaos categories
 * - URGENCY_LEVELS array (4 items) for emotional tone
 * - getTemplateVariables() returning { callerArchetype, situationDomain, urgencyLevel }
 * - getCustomMetadata() returning selection tracking
 * - selectRandomItem<T>() utility function
 */

import { WrongNumberVoicemailGenerator } from '@/content/generators/ai/wrong-number-voicemail-generator';
import {
  CALLER_ARCHETYPES,
  SITUATION_DOMAINS,
  URGENCY_LEVELS,
  selectRandomItem,
} from '@/content/generators/ai/wrong-number-voicemail-dictionaries';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedWrongNumberVoicemailGenerator = WrongNumberVoicemailGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedArchetype: string;
  selectedDomain: string;
  selectedUrgency: string;
  modelTier: ModelTier;
};

describe('WrongNumberVoicemailGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  /**
   * Sample AI-generated voicemail content.
   */
  const mockAIContent = `HEY ITS LINDA
THE GEESE ARE BACK
AND THEYRE IN YOUR
GARAGE THIS TIME
CALL ME NOW`;

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
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    // Mock AIProvider with successful response
    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: mockAIContent,
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(WrongNumberVoicemailGenerator);
    });

    it('should use LIGHT model tier for efficiency', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should work without API keys (default empty object)', () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(WrongNumberVoicemailGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return wrong-number-voicemail.txt', () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('wrong-number-voicemail.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content')
        .mockRejectedValueOnce(new Error('File not found: wrong-number-voicemail.txt'));

      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('dictionary arrays', () => {
    it('should have CALLER_ARCHETYPES array with 15 items', () => {
      expect(CALLER_ARCHETYPES).toBeDefined();
      expect(Array.isArray(CALLER_ARCHETYPES)).toBe(true);
      expect(CALLER_ARCHETYPES).toHaveLength(15);
    });

    it('should have SITUATION_DOMAINS array with 20 items', () => {
      expect(SITUATION_DOMAINS).toBeDefined();
      expect(Array.isArray(SITUATION_DOMAINS)).toBe(true);
      expect(SITUATION_DOMAINS).toHaveLength(20);
    });

    it('should have URGENCY_LEVELS array with 4 items', () => {
      expect(URGENCY_LEVELS).toBeDefined();
      expect(Array.isArray(URGENCY_LEVELS)).toBe(true);
      expect(URGENCY_LEVELS).toHaveLength(4);
    });

    it('should have unique archetypes in CALLER_ARCHETYPES', () => {
      const uniqueArchetypes = new Set(CALLER_ARCHETYPES);
      expect(uniqueArchetypes.size).toBe(CALLER_ARCHETYPES.length);
    });

    it('should have unique domains in SITUATION_DOMAINS', () => {
      const uniqueDomains = new Set(SITUATION_DOMAINS);
      expect(uniqueDomains.size).toBe(SITUATION_DOMAINS.length);
    });

    it('should have unique levels in URGENCY_LEVELS', () => {
      const uniqueLevels = new Set(URGENCY_LEVELS);
      expect(uniqueLevels.size).toBe(URGENCY_LEVELS.length);
    });

    it('should have non-empty string values in archetypes', () => {
      CALLER_ARCHETYPES.forEach((archetype: string) => {
        expect(typeof archetype).toBe('string');
        expect(archetype.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty string values in domains', () => {
      SITUATION_DOMAINS.forEach((domain: string) => {
        expect(typeof domain).toBe('string');
        expect(domain.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty string values in urgency levels', () => {
      URGENCY_LEVELS.forEach((level: string) => {
        expect(typeof level).toBe('string');
        expect(level.length).toBeGreaterThan(0);
      });
    });

    it('should have at least 12 archetypes for caller variety', () => {
      expect(CALLER_ARCHETYPES.length).toBeGreaterThanOrEqual(12);
    });

    it('should have at least 15 domains for situation variety', () => {
      expect(SITUATION_DOMAINS.length).toBeGreaterThanOrEqual(15);
    });

    it('should produce 1200+ unique combinations', () => {
      const totalCombinations =
        CALLER_ARCHETYPES.length * SITUATION_DOMAINS.length * URGENCY_LEVELS.length;
      expect(totalCombinations).toBeGreaterThanOrEqual(1200);
    });
  });

  describe('selectRandomItem()', () => {
    it('should return an item from the array', () => {
      const testArray = ['a', 'b', 'c'] as const;
      const result = selectRandomItem(testArray);
      expect(testArray).toContain(result);
    });

    it('should throw error for empty array', () => {
      expect(() => selectRandomItem([])).toThrow('Cannot select from empty array');
    });

    it('should return different items over multiple calls (randomness)', () => {
      const testArray = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const;
      const results = new Set<string>();

      for (let i = 0; i < 50; i++) {
        results.add(selectRandomItem(testArray));
      }

      // With 50 selections from 10 items, we should see at least 3 different values
      expect(results.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return callerArchetype, situationDomain, and urgencyLevel', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.callerArchetype).toBeDefined();
      expect(templateVars.situationDomain).toBeDefined();
      expect(templateVars.urgencyLevel).toBeDefined();
    });

    it('should return archetype from CALLER_ARCHETYPES array', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(CALLER_ARCHETYPES).toContain(templateVars.callerArchetype);
    });

    it('should return domain from SITUATION_DOMAINS array', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(SITUATION_DOMAINS).toContain(templateVars.situationDomain);
    });

    it('should return urgency from URGENCY_LEVELS array', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(URGENCY_LEVELS).toContain(templateVars.urgencyLevel);
    });

    it('should store selected archetype in instance property', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedArchetype).toBe(templateVars.callerArchetype);
    });

    it('should store selected domain in instance property', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedDomain).toBe(templateVars.situationDomain);
    });

    it('should store selected urgency in instance property', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedUrgency).toBe(templateVars.urgencyLevel);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      // Generate multiple times and collect results
      const archetypeResults = new Set<string>();
      const domainResults = new Set<string>();
      const urgencyResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        archetypeResults.add(templateVars.callerArchetype);
        domainResults.add(templateVars.situationDomain);
        urgencyResults.add(templateVars.urgencyLevel);
      }

      // With random selection, we should get at least 2 different values for each
      expect(archetypeResults.size).toBeGreaterThan(1);
      expect(domainResults.size).toBeGreaterThan(1);
      expect(urgencyResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should return callerArchetype in metadata', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.callerArchetype).toBeDefined();
      expect(typeof metadata.callerArchetype).toBe('string');
    });

    it('should return situationDomain in metadata', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.situationDomain).toBeDefined();
      expect(typeof metadata.situationDomain).toBe('string');
    });

    it('should return urgencyLevel in metadata', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.urgencyLevel).toBeDefined();
      expect(typeof metadata.urgencyLevel).toBe('string');
    });

    it('should match instance properties', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.callerArchetype).toBe(generator.selectedArchetype);
      expect(metadata.situationDomain).toBe(generator.selectedDomain);
      expect(metadata.urgencyLevel).toBe(generator.selectedUrgency);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      // Mock createProviderForSelection to return our AI provider mock
      jest
        .spyOn(
          WrongNumberVoicemailGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should load correct prompts and use LIGHT tier', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('wrong-number-voicemail.txt');

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should pass template variables to PromptLoader', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalled();

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'wrong-number-voicemail.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.callerArchetype).toBeDefined();
      expect(templateVars.situationDomain).toBeDefined();
      expect(templateVars.urgencyLevel).toBeDefined();
    });

    it('should include selections in result metadata', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.callerArchetype).toBeDefined();
      expect(result.metadata?.situationDomain).toBeDefined();
      expect(result.metadata?.urgencyLevel).toBeDefined();
    });

    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-nano');
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
    });

    describe('error handling', () => {
      it('should handle AI provider failures gracefully', async () => {
        const generator = new WrongNumberVoicemailGenerator(
          mockPromptLoader,
          mockModelTierSelector,
          { openai: 'test-key' }
        );

        mockAIProvider.generate.mockRejectedValue(new Error('AI provider error'));
        mockModelTierSelector.getAlternate.mockReturnValue(null);

        await expect(generator.generate(mockContext)).rejects.toThrow(
          /All AI providers failed for tier/
        );
      });
    });
  });
});
