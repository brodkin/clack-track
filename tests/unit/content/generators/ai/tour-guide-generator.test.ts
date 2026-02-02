/**
 * Tests for TourGuideGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Injects random location and angle into prompts
 * - Covers all location domains and angles
 */

import { TourGuideGenerator } from '@/content/generators/ai/tour-guide-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedTourGuideGenerator = TourGuideGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  selectRandomLocation(): { locationDomain: string; location: string };
  selectRandomAngle(): string;
};

describe('TourGuideGenerator', () => {
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
      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(TourGuideGenerator);
    });

    it('should use LIGHT model tier', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(TourGuideGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedTourGuideGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return tour-guide.txt', () => {
      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedTourGuideGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('tour-guide.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content')
        .mockRejectedValueOnce(new Error('File not found: tour-guide.txt'));

      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('location selection', () => {
    it('should select from valid location domains', () => {
      const generator = new TourGuideGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedTourGuideGenerator;

      const validDomains = ['HOME', 'WORK', 'PUBLIC', 'DIGITAL', 'SOCIAL'];

      const selectedDomains = new Set<string>();
      for (let i = 0; i < 200; i++) {
        const { locationDomain } = generator.selectRandomLocation();
        selectedDomains.add(locationDomain);
        expect(validDomains).toContain(locationDomain);
      }

      // With 200 iterations, we should have hit most domains
      expect(selectedDomains.size).toBeGreaterThan(1);
    });

    it('should select valid locations within each domain', () => {
      const generator = new TourGuideGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedTourGuideGenerator;

      for (let i = 0; i < 50; i++) {
        const { locationDomain, location } = generator.selectRandomLocation();
        expect(locationDomain).toBeDefined();
        expect(location).toBeDefined();
        expect(typeof location).toBe('string');
        expect(location.length).toBeGreaterThan(0);
      }
    });
  });

  describe('angle selection', () => {
    it('should select from valid angles', () => {
      const generator = new TourGuideGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedTourGuideGenerator;

      const validAngles = [...TourGuideGenerator.ANGLES];

      const selectedAngles = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const angle = generator.selectRandomAngle();
        selectedAngles.add(angle);
        expect(validAngles).toContain(angle);
      }

      expect(selectedAngles.size).toBeGreaterThan(1);
    });
  });

  describe('generate()', () => {
    it('should load correct prompts and use LIGHT tier', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedTourGuideGenerator;

      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('tour-guide.txt');

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should inject location and angle variables into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new TourGuideGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the prompt loading
      }

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'tour-guide.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('location');
      expect(variables).toHaveProperty('angle');
      expect(variables).not.toHaveProperty('opener');
    });
  });

  describe('LOCATIONS constant', () => {
    it('should contain all required location domains with their locations', () => {
      const locations = TourGuideGenerator.LOCATIONS;

      expect(locations).toHaveProperty('HOME');
      expect(locations).toHaveProperty('WORK');
      expect(locations).toHaveProperty('PUBLIC');
      expect(locations).toHaveProperty('DIGITAL');
      expect(locations).toHaveProperty('SOCIAL');

      expect(locations.HOME).toContain('kitchen');
      expect(locations.HOME).toContain('junk drawer');
      expect(locations.WORK).toContain('office');
      expect(locations.PUBLIC).toContain('supermarket');
      expect(locations.PUBLIC).toContain('DMV');
      expect(locations.DIGITAL).toContain('email inbox');
      expect(locations.DIGITAL).toContain('dating app');
      expect(locations.SOCIAL).toContain('first date');
      expect(locations.SOCIAL).toContain('brunch');
    });
  });

  describe('ANGLES constant', () => {
    it('should contain all required angles including houseboy-personal ones', () => {
      const angles = TourGuideGenerator.ANGLES;

      // Observational angles
      expect(angles).toContain('WILDLIFE');
      expect(angles).toContain('HISTORICAL');
      expect(angles).toContain('DANGER ZONE');
      expect(angles).toContain('EXHIBIT');
      expect(angles).toContain('HAUNTED');
      expect(angles).toContain('CRIME SCENE');
      expect(angles).toContain('REAL ESTATE LISTING');

      // Houseboy-personal angles
      expect(angles).toContain('DEVASTATING MEMORIES');
      expect(angles).toContain('CONFESSIONAL');
      expect(angles).toContain('FIVE STAR REVIEW');

      expect(angles.length).toBe(10);
    });
  });
});
