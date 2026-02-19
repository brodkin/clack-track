/**
 * Tests for CastMemberRadioGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - CALLER_STATIONS array (25 items) for Disneyland locations/roles
 * - SITUATION_DOMAINS array (20 items) for incident categories
 * - URGENCY_LEVELS array (5 items) for radio communication tone
 * - getTemplateVariables() returning { callerStation, situationDomain, urgencyLevel }
 * - getCustomMetadata() returning selection tracking
 * - selectRandomItem<T>() utility function
 */

import { CastMemberRadioGenerator } from '@/content/generators/ai/cast-member-radio-generator';
import {
  CALLER_STATIONS,
  SITUATION_DOMAINS,
  URGENCY_LEVELS,
  selectRandomItem,
} from '@/content/generators/ai/cast-member-radio-dictionaries';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedCastMemberRadioGenerator = CastMemberRadioGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedStation: string;
  selectedDomain: string;
  selectedUrgency: string;
  modelTier: ModelTier;
};

describe('CastMemberRadioGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  /**
   * Sample AI-generated radio chatter content.
   */
  const mockAIContent = `JUNGLE CRUISE TO BASE
HIPPO 3 IS STUCK AGAIN
GUEST TRIED TO FEED IT
A TURKEY LEG
SEND MAINTENANCE`;

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
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(CastMemberRadioGenerator);
    });

    it('should use LIGHT model tier for efficiency', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(CastMemberRadioGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return cast-member-radio.txt', () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('cast-member-radio.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content')
        .mockRejectedValueOnce(new Error('File not found: cast-member-radio.txt'));

      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('dictionary arrays', () => {
    it('should have CALLER_STATIONS array with 25 items', () => {
      expect(CALLER_STATIONS).toBeDefined();
      expect(Array.isArray(CALLER_STATIONS)).toBe(true);
      expect(CALLER_STATIONS).toHaveLength(25);
    });

    it('should have SITUATION_DOMAINS array with 20 items', () => {
      expect(SITUATION_DOMAINS).toBeDefined();
      expect(Array.isArray(SITUATION_DOMAINS)).toBe(true);
      expect(SITUATION_DOMAINS).toHaveLength(20);
    });

    it('should have URGENCY_LEVELS array with 5 items', () => {
      expect(URGENCY_LEVELS).toBeDefined();
      expect(Array.isArray(URGENCY_LEVELS)).toBe(true);
      expect(URGENCY_LEVELS).toHaveLength(5);
    });

    it('should have unique stations in CALLER_STATIONS', () => {
      const uniqueStations = new Set(CALLER_STATIONS);
      expect(uniqueStations.size).toBe(CALLER_STATIONS.length);
    });

    it('should have unique domains in SITUATION_DOMAINS', () => {
      const uniqueDomains = new Set(SITUATION_DOMAINS);
      expect(uniqueDomains.size).toBe(SITUATION_DOMAINS.length);
    });

    it('should have unique levels in URGENCY_LEVELS', () => {
      const uniqueLevels = new Set(URGENCY_LEVELS);
      expect(uniqueLevels.size).toBe(URGENCY_LEVELS.length);
    });

    it('should have non-empty string values in stations', () => {
      CALLER_STATIONS.forEach((station: string) => {
        expect(typeof station).toBe('string');
        expect(station.length).toBeGreaterThan(0);
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

    it('should have at least 20 stations for location variety', () => {
      expect(CALLER_STATIONS.length).toBeGreaterThanOrEqual(20);
    });

    it('should have at least 15 domains for situation variety', () => {
      expect(SITUATION_DOMAINS.length).toBeGreaterThanOrEqual(15);
    });

    it('should produce 2500+ unique combinations', () => {
      const totalCombinations =
        CALLER_STATIONS.length * SITUATION_DOMAINS.length * URGENCY_LEVELS.length;
      expect(totalCombinations).toBeGreaterThanOrEqual(2500);
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
    it('should return callerStation, situationDomain, and urgencyLevel', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.callerStation).toBeDefined();
      expect(templateVars.situationDomain).toBeDefined();
      expect(templateVars.urgencyLevel).toBeDefined();
    });

    it('should return station from CALLER_STATIONS array', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(CALLER_STATIONS).toContain(templateVars.callerStation);
    });

    it('should return domain from SITUATION_DOMAINS array', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(SITUATION_DOMAINS).toContain(templateVars.situationDomain);
    });

    it('should return urgency from URGENCY_LEVELS array', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(URGENCY_LEVELS).toContain(templateVars.urgencyLevel);
    });

    it('should store selected station in instance property', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedStation).toBe(templateVars.callerStation);
    });

    it('should store selected domain in instance property', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedDomain).toBe(templateVars.situationDomain);
    });

    it('should store selected urgency in instance property', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedUrgency).toBe(templateVars.urgencyLevel);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      // Generate multiple times and collect results
      const stationResults = new Set<string>();
      const domainResults = new Set<string>();
      const urgencyResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        stationResults.add(templateVars.callerStation);
        domainResults.add(templateVars.situationDomain);
        urgencyResults.add(templateVars.urgencyLevel);
      }

      // With random selection, we should get at least 2 different values for each
      expect(stationResults.size).toBeGreaterThan(1);
      expect(domainResults.size).toBeGreaterThan(1);
      expect(urgencyResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should return callerStation in metadata', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.callerStation).toBeDefined();
      expect(typeof metadata.callerStation).toBe('string');
    });

    it('should return situationDomain in metadata', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.situationDomain).toBeDefined();
      expect(typeof metadata.situationDomain).toBe('string');
    });

    it('should return urgencyLevel in metadata', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.urgencyLevel).toBeDefined();
      expect(typeof metadata.urgencyLevel).toBe('string');
    });

    it('should match instance properties', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.callerStation).toBe(generator.selectedStation);
      expect(metadata.situationDomain).toBe(generator.selectedDomain);
      expect(metadata.urgencyLevel).toBe(generator.selectedUrgency);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      // Mock createProviderForSelection to return our AI provider mock
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

    it('should load correct prompts and use LIGHT tier', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCastMemberRadioGenerator;

      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('cast-member-radio.txt');

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should pass template variables to PromptLoader', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalled();

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'cast-member-radio.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.callerStation).toBeDefined();
      expect(templateVars.situationDomain).toBeDefined();
      expect(templateVars.urgencyLevel).toBeDefined();
    });

    it('should include selections in result metadata', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.callerStation).toBeDefined();
      expect(result.metadata?.situationDomain).toBeDefined();
      expect(result.metadata?.urgencyLevel).toBeDefined();
    });

    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
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
        const generator = new CastMemberRadioGenerator(mockPromptLoader, mockModelTierSelector, {
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
