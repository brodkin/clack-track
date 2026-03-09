/**
 * Tests for TimePerspectiveGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses MEDIUM model tier
 * - Validates prompt files exist
 * - Selects random field and disposition programmatically
 * - Injects field and disposition as template variables
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

  describe('FIELDS static array', () => {
    it('should contain at least 15 scholarly fields', () => {
      expect(TimePerspectiveGenerator.FIELDS.length).toBeGreaterThanOrEqual(15);
    });

    it('should include key scholarly disciplines', () => {
      expect(TimePerspectiveGenerator.FIELDS).toContain('ASTRONOMER');
      expect(TimePerspectiveGenerator.FIELDS).toContain('CARTOGRAPHER');
      expect(TimePerspectiveGenerator.FIELDS).toContain('PHYSICIAN');
      expect(TimePerspectiveGenerator.FIELDS).toContain('MATHEMATICIAN');
      expect(TimePerspectiveGenerator.FIELDS).toContain('BOTANIST');
      expect(TimePerspectiveGenerator.FIELDS).toContain('NAVIGATOR');
    });
  });

  describe('DISPOSITIONS static array', () => {
    it('should contain exactly 5 dispositions', () => {
      expect(TimePerspectiveGenerator.DISPOSITIONS).toHaveLength(5);
    });

    it('should include all disposition types', () => {
      expect(TimePerspectiveGenerator.DISPOSITIONS).toContain('WISTFUL');
      expect(TimePerspectiveGenerator.DISPOSITIONS).toContain('INVENTIVE');
      expect(TimePerspectiveGenerator.DISPOSITIONS).toContain('EXASPERATED');
      expect(TimePerspectiveGenerator.DISPOSITIONS).toContain('PHILOSOPHICAL');
      expect(TimePerspectiveGenerator.DISPOSITIONS).toContain('MATTER_OF_FACT');
    });
  });

  describe('selectField()', () => {
    it('should return a field from the FIELDS array', () => {
      const field = TimePerspectiveGenerator.selectField();
      expect(TimePerspectiveGenerator.FIELDS).toContain(field);
    });

    it('should produce variety across multiple selections', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(TimePerspectiveGenerator.selectField());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('selectDisposition()', () => {
    it('should return a disposition from the DISPOSITIONS array', () => {
      const disposition = TimePerspectiveGenerator.selectDisposition();
      expect(TimePerspectiveGenerator.DISPOSITIONS).toContain(disposition);
    });

    it('should produce variety across multiple selections', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(TimePerspectiveGenerator.selectDisposition());
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
    it('should create instance with MEDIUM tier', () => {
      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeInstanceOf(TimePerspectiveGenerator);
    });

    it('should select MEDIUM model tier', async () => {
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
        // Expected without real API key
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });
  });

  describe('prompt files', () => {
    it('should use major-update-base.txt as system prompt', () => {
      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedTimePerspectiveGenerator;

      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
    });

    it('should use time-perspective.txt as user prompt', () => {
      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedTimePerspectiveGenerator;

      expect(generator.getUserPromptFile()).toBe('time-perspective.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new TimePerspectiveGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    it('should inject field and disposition as template variables', async () => {
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
        // Expected without real API key
      }

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'time-perspective.txt'
      );

      expect(userPromptCall).toBeDefined();
      if (userPromptCall) {
        const variables = userPromptCall[2] as Record<string, unknown>;
        expect(variables).toHaveProperty('field');
        expect(variables).toHaveProperty('disposition');
        expect(variables).toHaveProperty('timeBucket');
        expect(TimePerspectiveGenerator.FIELDS).toContain(variables.field);
        expect(TimePerspectiveGenerator.DISPOSITIONS).toContain(variables.disposition);
      }
    });
  });

  describe('variability', () => {
    it('should provide 300+ combinations (15 fields x 5 dispositions x 4 time buckets)', () => {
      const fieldCount = TimePerspectiveGenerator.FIELDS.length;
      const dispositionCount = TimePerspectiveGenerator.DISPOSITIONS.length;
      const timeBucketCount = 4;

      const totalCombinations = fieldCount * dispositionCount * timeBucketCount;

      expect(totalCombinations).toBeGreaterThanOrEqual(300);
    });
  });
});
