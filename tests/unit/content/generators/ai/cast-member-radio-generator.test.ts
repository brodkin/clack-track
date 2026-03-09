/**
 * Tests for CastMemberRadioGenerator
 *
 * Generator-specific behavior:
 * - Dictionary arrays (CALLER_STATIONS, SITUATION_DOMAINS, URGENCY_LEVELS, SHIFT_MOMENTS)
 * - selectRandomItem() utility
 * - getTemplateVariables() (callerStation, situationDomain, urgencyLevel, shiftMoment)
 * - Instance property storage and getCustomMetadata()
 * - Template variable passing in generate()
 */

import { CastMemberRadioGenerator } from '@/content/generators/ai/cast-member-radio-generator';
import {
  CALLER_STATIONS,
  SITUATION_DOMAINS,
  URGENCY_LEVELS,
  SHIFT_MOMENTS,
  selectRandomItem,
} from '@/content/generators/ai/cast-member-radio-dictionaries';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedCastMemberRadioGenerator = CastMemberRadioGenerator & {
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedStation: string;
  selectedDomain: string;
  selectedUrgency: string;
  selectedMoment: string;
};

describe('CastMemberRadioGenerator', () => {
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
        text: 'JUNGLE CRUISE TO BASE\nHIPPO 3 IS STUCK AGAIN',
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('dictionary arrays', () => {
    it('should have CALLER_STATIONS array with 25 unique items', () => {
      expect(CALLER_STATIONS).toHaveLength(25);
      const uniqueStations = new Set(CALLER_STATIONS);
      expect(uniqueStations.size).toBe(CALLER_STATIONS.length);
    });

    it('should have SITUATION_DOMAINS array with 20 unique items', () => {
      expect(SITUATION_DOMAINS).toHaveLength(20);
      const uniqueDomains = new Set(SITUATION_DOMAINS);
      expect(uniqueDomains.size).toBe(SITUATION_DOMAINS.length);
    });

    it('should have URGENCY_LEVELS array with 5 unique items', () => {
      expect(URGENCY_LEVELS).toHaveLength(5);
      const uniqueLevels = new Set(URGENCY_LEVELS);
      expect(uniqueLevels.size).toBe(URGENCY_LEVELS.length);
    });

    it('should have SHIFT_MOMENTS array with 8 unique items', () => {
      expect(SHIFT_MOMENTS).toHaveLength(8);
      const uniqueMoments = new Set(SHIFT_MOMENTS);
      expect(uniqueMoments.size).toBe(SHIFT_MOMENTS.length);
    });

    it('should produce 20000+ unique combinations', () => {
      const totalCombinations =
        CALLER_STATIONS.length *
        SITUATION_DOMAINS.length *
        URGENCY_LEVELS.length *
        SHIFT_MOMENTS.length;
      expect(totalCombinations).toBeGreaterThanOrEqual(20000);
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
    it('should return callerStation, situationDomain, urgencyLevel, and shiftMoment', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.callerStation).toBeDefined();
      expect(templateVars.situationDomain).toBeDefined();
      expect(templateVars.urgencyLevel).toBeDefined();
      expect(templateVars.shiftMoment).toBeDefined();
    });

    it('should return values from valid dictionary arrays', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(CALLER_STATIONS).toContain(templateVars.callerStation);
      expect(SITUATION_DOMAINS).toContain(templateVars.situationDomain);
      expect(URGENCY_LEVELS).toContain(templateVars.urgencyLevel);
      expect(SHIFT_MOMENTS).toContain(templateVars.shiftMoment);
    });

    it('should store selections in instance properties', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedStation).toBe(templateVars.callerStation);
      expect(generator.selectedDomain).toBe(templateVars.situationDomain);
      expect(generator.selectedUrgency).toBe(templateVars.urgencyLevel);
      expect(generator.selectedMoment).toBe(templateVars.shiftMoment);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const stationResults = new Set<string>();
      const domainResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        stationResults.add(templateVars.callerStation);
        domainResults.add(templateVars.situationDomain);
      }

      expect(stationResults.size).toBeGreaterThan(1);
      expect(domainResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should return all selections matching instance properties', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.callerStation).toBe(generator.selectedStation);
      expect(metadata.situationDomain).toBe(generator.selectedDomain);
      expect(metadata.urgencyLevel).toBe(generator.selectedUrgency);
      expect(metadata.shiftMoment).toBe(generator.selectedMoment);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      jest
        .spyOn(
          CastMemberRadioGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should pass template variables to PromptLoader', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'cast-member-radio.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.callerStation).toBeDefined();
      expect(templateVars.situationDomain).toBeDefined();
      expect(templateVars.urgencyLevel).toBeDefined();
      expect(templateVars.shiftMoment).toBeDefined();
    });

    it('should include selections in result metadata', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.callerStation).toBeDefined();
      expect(result.metadata?.situationDomain).toBeDefined();
      expect(result.metadata?.urgencyLevel).toBeDefined();
      expect(result.metadata?.shiftMoment).toBeDefined();
    });
  });
});
