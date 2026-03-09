/**
 * Tests for WrongNumberVoicemailGenerator
 *
 * Generator-specific behavior:
 * - CALLER_ARCHETYPES (15), SITUATION_DOMAINS (20), URGENCY_LEVELS (4) arrays
 * - selectRandomItem() utility function
 * - getTemplateVariables() returning { callerArchetype, situationDomain, urgencyLevel }
 * - Instance property storage and getCustomMetadata()
 * - Template variable passing in generate()
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
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedArchetype: string;
  selectedDomain: string;
  selectedUrgency: string;
};

describe('WrongNumberVoicemailGenerator', () => {
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
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: 'HEY ITS LINDA\nTHE GEESE ARE BACK\nCALL ME NOW',
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('dictionary arrays', () => {
    it('should have CALLER_ARCHETYPES array with 15 unique items', () => {
      expect(CALLER_ARCHETYPES).toHaveLength(15);
      const unique = new Set(CALLER_ARCHETYPES);
      expect(unique.size).toBe(CALLER_ARCHETYPES.length);
    });

    it('should have SITUATION_DOMAINS array with 20 unique items', () => {
      expect(SITUATION_DOMAINS).toHaveLength(20);
      const unique = new Set(SITUATION_DOMAINS);
      expect(unique.size).toBe(SITUATION_DOMAINS.length);
    });

    it('should have URGENCY_LEVELS array with 4 unique items', () => {
      expect(URGENCY_LEVELS).toHaveLength(4);
      const unique = new Set(URGENCY_LEVELS);
      expect(unique.size).toBe(URGENCY_LEVELS.length);
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

      expect(results.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return callerArchetype, situationDomain, and urgencyLevel from valid arrays', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(CALLER_ARCHETYPES).toContain(templateVars.callerArchetype);
      expect(SITUATION_DOMAINS).toContain(templateVars.situationDomain);
      expect(URGENCY_LEVELS).toContain(templateVars.urgencyLevel);
    });

    it('should store selections in instance properties', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedArchetype).toBe(templateVars.callerArchetype);
      expect(generator.selectedDomain).toBe(templateVars.situationDomain);
      expect(generator.selectedUrgency).toBe(templateVars.urgencyLevel);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWrongNumberVoicemailGenerator;

      const archetypeResults = new Set<string>();
      const domainResults = new Set<string>();
      const urgencyResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        archetypeResults.add(templateVars.callerArchetype);
        domainResults.add(templateVars.situationDomain);
        urgencyResults.add(templateVars.urgencyLevel);
      }

      expect(archetypeResults.size).toBeGreaterThan(1);
      expect(domainResults.size).toBeGreaterThan(1);
      expect(urgencyResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
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

    it('should pass template variables to PromptLoader', async () => {
      const generator = new WrongNumberVoicemailGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

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
  });
});
