/**
 * Tests for AlienFieldReportGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for cost efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Injects random log number, subject category, observation focus, and angle into prompts
 * - Covers all subject categories and observation angles
 * - Log number is within valid range (001-999) and zero-padded
 */

import { AlienFieldReportGenerator } from '@/content/generators/ai/alien-field-report-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedAlienFieldReportGenerator = AlienFieldReportGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  generateLogNumber(): string;
  selectRandomSubject(): { category: string; focus: string };
  selectRandomAngle(): string;
};

describe('AlienFieldReportGenerator', () => {
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

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(AlienFieldReportGenerator);
    });

    it('should use LIGHT model tier for cost efficiency', async () => {
      // Set up mocks for generate() call
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

      // Verify via observable behavior: modelTierSelector.select is called with LIGHT tier
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should work without API keys (default empty object)', () => {
      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(AlienFieldReportGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedAlienFieldReportGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return alien-field-report.txt', () => {
      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedAlienFieldReportGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('alien-field-report.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt exists
        .mockRejectedValueOnce(new Error('File not found: alien-field-report.txt')); // user prompt missing

      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('log number generation', () => {
    it('should generate log numbers within valid range (001-999)', () => {
      const generator = new AlienFieldReportGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedAlienFieldReportGenerator;

      // Run multiple times to test range
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

      // Run multiple times to verify padding
      for (let i = 0; i < 50; i++) {
        const logNumber = generator.generateLogNumber();

        // All log numbers should be exactly 3 characters
        expect(logNumber.length).toBe(3);
        // Should be numeric string
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

      // Run multiple times to test randomness covers all categories
      const selectedCategories = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { category } = generator.selectRandomSubject();
        selectedCategories.add(category);
        expect(validCategories).toContain(category);
      }

      // With 100 iterations, we should have hit most categories
      expect(selectedCategories.size).toBeGreaterThan(1);
    });

    it('should select valid observation focuses within each category', () => {
      const generator = new AlienFieldReportGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedAlienFieldReportGenerator;

      // Run multiple times to verify focus selection works
      for (let i = 0; i < 50; i++) {
        const { category, focus } = generator.selectRandomSubject();
        expect(category).toBeDefined();
        expect(focus).toBeDefined();
        expect(typeof focus).toBe('string');
        expect(focus.length).toBeGreaterThan(0);

        // Verify focus is from the selected category's pool
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

      // Run multiple times to test randomness
      const selectedAngles = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const angle = generator.selectRandomAngle();
        selectedAngles.add(angle);
        expect(validAngles).toContain(angle);
      }

      // With 50 iterations, we should have hit most angles
      expect(selectedAngles.size).toBeGreaterThan(1);
    });
  });

  describe('generate()', () => {
    it('should load correct prompts and use LIGHT tier', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new AlienFieldReportGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedAlienFieldReportGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('alien-field-report.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

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
        // May fail without AI provider - we're testing the prompt loading
      }

      // Verify loadPromptWithVariables was called with all four template variables
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
      // Access the static constant through the class
      const categories = AlienFieldReportGenerator.SUBJECT_CATEGORIES;

      expect(categories).toHaveProperty('SUSTENANCE');
      expect(categories).toHaveProperty('TECHNOLOGY');
      expect(categories).toHaveProperty('SOCIAL');
      expect(categories).toHaveProperty('TEMPORAL');
      expect(categories).toHaveProperty('DOMESTIC');
      expect(categories).toHaveProperty('PROFESSIONAL');
      expect(categories).toHaveProperty('RECREATIONAL');
      expect(categories).toHaveProperty('TRANSPORT');

      // Verify each category has 5 focuses
      expect(categories.SUSTENANCE.length).toBe(5);
      expect(categories.TECHNOLOGY.length).toBe(5);
      expect(categories.SOCIAL.length).toBe(5);
      expect(categories.TEMPORAL.length).toBe(5);
      expect(categories.DOMESTIC.length).toBe(5);
      expect(categories.PROFESSIONAL.length).toBe(5);
      expect(categories.RECREATIONAL.length).toBe(5);
      expect(categories.TRANSPORT.length).toBe(5);

      // Verify some specific focuses exist
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

      // Use promptsOnly mode to get metadata without needing AI
      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('logNumber');
      expect(result.metadata).toHaveProperty('category');
      expect(result.metadata).toHaveProperty('focus');
      expect(result.metadata).toHaveProperty('angle');

      // Verify the logNumber format
      const logNumber = result.metadata?.logNumber as string;
      expect(logNumber).toMatch(/^\d{3}$/);
      expect(parseInt(logNumber, 10)).toBeGreaterThanOrEqual(1);
      expect(parseInt(logNumber, 10)).toBeLessThanOrEqual(999);

      // Verify category is from valid pool
      const validCategories = Object.keys(AlienFieldReportGenerator.SUBJECT_CATEGORIES);
      expect(validCategories).toContain(result.metadata?.category);

      // Verify angle is from valid pool
      expect(AlienFieldReportGenerator.OBSERVATION_ANGLES).toContain(result.metadata?.angle);
    });
  });
});
