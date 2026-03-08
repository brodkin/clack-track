/**
 * Tests for TimePerspectiveGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses MEDIUM model tier
 * - Validates prompt files exist
 * - Selects random lens and observation programmatically
 * - Injects lens and observation as template variables
 */

import { TimePerspectiveGenerator } from '@/content/generators/ai/time-perspective-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedTimePerspectiveGenerator = TimePerspectiveGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('TimePerspectiveGenerator', () => {
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

  describe('LENSES static array', () => {
    it('should contain exactly 5 lenses', () => {
      expect(TimePerspectiveGenerator.LENSES).toHaveLength(5);
    });

    it('should include COSMIC, ABSURDIST, ANCESTOR, CONNECTION, and FUTURE_SELF', () => {
      expect(TimePerspectiveGenerator.LENSES).toContain('COSMIC');
      expect(TimePerspectiveGenerator.LENSES).toContain('ABSURDIST');
      expect(TimePerspectiveGenerator.LENSES).toContain('ANCESTOR');
      expect(TimePerspectiveGenerator.LENSES).toContain('CONNECTION');
      expect(TimePerspectiveGenerator.LENSES).toContain('FUTURE_SELF');
    });
  });

  describe('OBSERVATIONS static array', () => {
    it('should contain at least 20 observations', () => {
      expect(TimePerspectiveGenerator.OBSERVATIONS.length).toBeGreaterThanOrEqual(20);
    });

    it('should include key everyday observations', () => {
      expect(TimePerspectiveGenerator.OBSERVATIONS).toContain('MAKING_COFFEE');
      expect(TimePerspectiveGenerator.OBSERVATIONS).toContain('LOOKING_AT_THE_SKY');
      expect(TimePerspectiveGenerator.OBSERVATIONS).toContain('LISTENING_TO_MUSIC');
      expect(TimePerspectiveGenerator.OBSERVATIONS).toContain('COOKING_A_MEAL');
      expect(TimePerspectiveGenerator.OBSERVATIONS).toContain('DRINKING_CLEAN_WATER');
      expect(TimePerspectiveGenerator.OBSERVATIONS).toContain('TURNING_ON_A_LIGHT');
    });
  });

  describe('selectLens()', () => {
    it('should return a lens from the LENSES array', () => {
      const lens = TimePerspectiveGenerator.selectLens();
      expect(TimePerspectiveGenerator.LENSES).toContain(lens);
    });

    it('should use Math.random for selection (probabilistic)', () => {
      // Run multiple times to verify we get at least 2 different lenses
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(TimePerspectiveGenerator.selectLens());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('selectObservation()', () => {
    it('should return an observation from the OBSERVATIONS array', () => {
      const observation = TimePerspectiveGenerator.selectObservation();
      expect(TimePerspectiveGenerator.OBSERVATIONS).toContain(observation);
    });

    it('should use Math.random for selection (probabilistic)', () => {
      // Run multiple times to verify we get at least 2 different observations
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(TimePerspectiveGenerator.selectObservation());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('getTimeBucket()', () => {
    it('should return NIGHT for hours 0-5', () => {
      expect(TimePerspectiveGenerator.getTimeBucket(0)).toBe('NIGHT');
      expect(TimePerspectiveGenerator.getTimeBucket(5)).toBe('NIGHT');
    });

    it('should return MORNING for hours 6-11', () => {
      expect(TimePerspectiveGenerator.getTimeBucket(6)).toBe('MORNING');
      expect(TimePerspectiveGenerator.getTimeBucket(11)).toBe('MORNING');
    });

    it('should return AFTERNOON for hours 12-17', () => {
      expect(TimePerspectiveGenerator.getTimeBucket(12)).toBe('AFTERNOON');
      expect(TimePerspectiveGenerator.getTimeBucket(17)).toBe('AFTERNOON');
    });

    it('should return EVENING for hours 18-23', () => {
      expect(TimePerspectiveGenerator.getTimeBucket(18)).toBe('EVENING');
      expect(TimePerspectiveGenerator.getTimeBucket(23)).toBe('EVENING');
    });
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and MEDIUM tier', () => {
      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(TimePerspectiveGenerator);
    });

    it('should use MEDIUM model tier', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
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
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedTimePerspectiveGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return time-perspective.txt', () => {
      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedTimePerspectiveGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('time-perspective.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    it('should inject lens and observation as template variables', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing template variable injection
      }

      // Verify loadPromptWithVariables was called with lens and observation
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'time-perspective.txt'
      );

      expect(userPromptCall).toBeDefined();
      if (userPromptCall) {
        const variables = userPromptCall[2] as Record<string, unknown>;
        expect(variables).toHaveProperty('lens');
        expect(variables).toHaveProperty('observation');
        expect(variables).toHaveProperty('timeBucket');
        expect(TimePerspectiveGenerator.LENSES).toContain(variables.lens);
        expect(TimePerspectiveGenerator.OBSERVATIONS).toContain(variables.observation);
      }
    });
  });

  describe('variability', () => {
    it('should provide 400+ combinations (5 lenses x 20 observations x 4 time buckets)', () => {
      const lensCount = TimePerspectiveGenerator.LENSES.length;
      const observationCount = TimePerspectiveGenerator.OBSERVATIONS.length;
      const timeBucketCount = 4; // NIGHT, MORNING, AFTERNOON, EVENING

      const totalCombinations = lensCount * observationCount * timeBucketCount;

      expect(totalCombinations).toBeGreaterThanOrEqual(400);
    });
  });
});
