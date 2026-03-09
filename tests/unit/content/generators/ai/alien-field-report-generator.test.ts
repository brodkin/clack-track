/**
 * Tests for AlienFieldReportGenerator
 *
 * Generator-specific behavior:
 * - Log number generation (001-999, zero-padded)
 * - Subject category selection (8 categories x 5 focuses)
 * - Observation angle selection (5 angles)
 * - Template variable injection (logNumber, subjectCategory, observationFocus, observationAngle)
 * - SUBJECT_CATEGORIES and OBSERVATION_ANGLES constants
 * - Custom metadata tracking
 */

import { AlienFieldReportGenerator } from '@/content/generators/ai/alien-field-report-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedAlienFieldReportGenerator = AlienFieldReportGenerator & {
  generateLogNumber(): string;
  selectRandomSubject(): { category: string; focus: string };
  selectRandomAngle(): string;
};

describe('AlienFieldReportGenerator', () => {
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

  describe('log number generation', () => {
    it('should generate log numbers within valid range (001-999)', () => {
      const generator = new AlienFieldReportGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedAlienFieldReportGenerator;

      for (let i = 0; i < 100; i++) {
        const logNumber = generator.generateLogNumber();
        const numericValue = parseInt(logNumber, 10);

        expect(numericValue).toBeGreaterThanOrEqual(1);
        expect(numericValue).toBeLessThanOrEqual(999);
      }
    });

    it('should generate zero-padded log numbers', () => {
      const generator = new AlienFieldReportGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedAlienFieldReportGenerator;

      for (let i = 0; i < 50; i++) {
        const logNumber = generator.generateLogNumber();

        expect(logNumber.length).toBe(3);
        expect(logNumber).toMatch(/^\d{3}$/);
      }
    });
  });

  describe('subject selection', () => {
    it('should select from valid subject categories', () => {
      const generator = new AlienFieldReportGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedAlienFieldReportGenerator;

      const validCategories = [
        'SUSTENANCE',
        'TECHNOLOGY',
        'SOCIAL',
        'TEMPORAL',
        'DOMESTIC',
        'PROFESSIONAL',
        'RECREATIONAL',
        'TRANSPORT',
      ];

      const selectedCategories = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { category } = generator.selectRandomSubject();
        selectedCategories.add(category);
        expect(validCategories).toContain(category);
      }

      expect(selectedCategories.size).toBeGreaterThan(1);
    });

    it('should select valid observation focuses within each category', () => {
      const generator = new AlienFieldReportGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedAlienFieldReportGenerator;

      for (let i = 0; i < 50; i++) {
        const { category, focus } = generator.selectRandomSubject();
        expect(category).toBeDefined();
        expect(focus).toBeDefined();
        expect(typeof focus).toBe('string');
        expect(focus.length).toBeGreaterThan(0);

        const categoryFocuses =
          AlienFieldReportGenerator.SUBJECT_CATEGORIES[
            category as keyof typeof AlienFieldReportGenerator.SUBJECT_CATEGORIES
          ];
        expect(categoryFocuses).toContain(focus);
      }
    });
  });

  describe('observation angle selection', () => {
    it('should select from valid observation angles', () => {
      const generator = new AlienFieldReportGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedAlienFieldReportGenerator;

      const validAngles = [
        'RITUAL_ANALYSIS',
        'BIOLOGICAL_QUIRK',
        'TECHNOLOGY_WORSHIP',
        'SOCIAL_BONDING',
        'TEMPORAL_OBSESSION',
      ];

      const selectedAngles = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const angle = generator.selectRandomAngle();
        selectedAngles.add(angle);
        expect(validAngles).toContain(angle);
      }

      expect(selectedAngles.size).toBeGreaterThan(1);
    });
  });

  describe('template variable injection', () => {
    it('should inject all four template variables into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider
      }

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'alien-field-report.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('logNumber');
      expect(variables).toHaveProperty('subjectCategory');
      expect(variables).toHaveProperty('observationFocus');
      expect(variables).toHaveProperty('observationAngle');
    });
  });

  describe('SUBJECT_CATEGORIES constant', () => {
    it('should contain all required subject categories with their focuses', () => {
      const categories = AlienFieldReportGenerator.SUBJECT_CATEGORIES;

      expect(categories).toHaveProperty('SUSTENANCE');
      expect(categories).toHaveProperty('TECHNOLOGY');
      expect(categories).toHaveProperty('SOCIAL');
      expect(categories).toHaveProperty('TEMPORAL');
      expect(categories).toHaveProperty('DOMESTIC');
      expect(categories).toHaveProperty('PROFESSIONAL');
      expect(categories).toHaveProperty('RECREATIONAL');
      expect(categories).toHaveProperty('TRANSPORT');

      expect(categories.SUSTENANCE.length).toBe(5);
      expect(categories.TECHNOLOGY.length).toBe(5);
      expect(categories.SOCIAL.length).toBe(5);
      expect(categories.TEMPORAL.length).toBe(5);
      expect(categories.DOMESTIC.length).toBe(5);
      expect(categories.PROFESSIONAL.length).toBe(5);
      expect(categories.RECREATIONAL.length).toBe(5);
      expect(categories.TRANSPORT.length).toBe(5);

      expect(categories.SUSTENANCE).toContain('coffee consumption');
      expect(categories.TECHNOLOGY).toContain('phone checking');
      expect(categories.SOCIAL).toContain('small talk');
      expect(categories.TEMPORAL).toContain('alarm snoozing');
      expect(categories.DOMESTIC).toContain('laundry accumulation');
      expect(categories.PROFESSIONAL).toContain('meeting attendance');
      expect(categories.RECREATIONAL).toContain('screen binging');
      expect(categories.TRANSPORT).toContain('parking strategies');
    });

    it('should have 8 subject categories total', () => {
      const categories = AlienFieldReportGenerator.SUBJECT_CATEGORIES;
      expect(Object.keys(categories).length).toBe(8);
    });
  });

  describe('OBSERVATION_ANGLES constant', () => {
    it('should contain all required observation angles', () => {
      const angles = AlienFieldReportGenerator.OBSERVATION_ANGLES;

      expect(angles).toContain('RITUAL_ANALYSIS');
      expect(angles).toContain('BIOLOGICAL_QUIRK');
      expect(angles).toContain('TECHNOLOGY_WORSHIP');
      expect(angles).toContain('SOCIAL_BONDING');
      expect(angles).toContain('TEMPORAL_OBSESSION');
      expect(angles.length).toBe(5);
    });
  });

  describe('metadata', () => {
    it('should include logNumber, category, focus, and angle in metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('logNumber');
      expect(result.metadata).toHaveProperty('category');
      expect(result.metadata).toHaveProperty('focus');
      expect(result.metadata).toHaveProperty('angle');

      const logNumber = result.metadata?.logNumber as string;
      expect(logNumber).toMatch(/^\d{3}$/);
      expect(parseInt(logNumber, 10)).toBeGreaterThanOrEqual(1);
      expect(parseInt(logNumber, 10)).toBeLessThanOrEqual(999);

      const validCategories = Object.keys(AlienFieldReportGenerator.SUBJECT_CATEGORIES);
      expect(validCategories).toContain(result.metadata?.category);

      expect(AlienFieldReportGenerator.OBSERVATION_ANGLES).toContain(result.metadata?.angle);
    });
  });
});
