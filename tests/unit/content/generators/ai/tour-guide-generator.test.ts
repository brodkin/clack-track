/**
 * Tests for TourGuideGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Injects random location, opener, and angle into prompts
 * - Covers all location domains, openers, and angles
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
  selectRandomOpener(): string;
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

      const validDomains = ['HOME', 'WORK', 'PUBLIC', 'DIGITAL'];

      const selectedDomains = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { locationDomain } = generator.selectRandomLocation();
        selectedDomains.add(locationDomain);
        expect(validDomains).toContain(locationDomain);
      }

      // With 100 iterations, we should have hit most domains
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

  describe('opener selection', () => {
    it('should select from valid tour guide openers', () => {
      const generator = new TourGuideGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedTourGuideGenerator;

      const validOpeners = [...TourGuideGenerator.TOUR_GUIDE_OPENERS];

      const selectedOpeners = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const opener = generator.selectRandomOpener();
        selectedOpeners.add(opener);
        expect(validOpeners).toContain(opener);
      }

      expect(selectedOpeners.size).toBeGreaterThan(1);
    });
  });

  describe('angle selection', () => {
    it('should select from valid angles', () => {
      const generator = new TourGuideGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedTourGuideGenerator;

      const validAngles = ['WILDLIFE', 'HISTORICAL', 'DANGER ZONE', 'EXHIBIT', 'HAUNTED'];

      const selectedAngles = new Set<string>();
      for (let i = 0; i < 50; i++) {
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

    it('should inject location, opener, and angle variables into user prompt', async () => {
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
      expect(variables).toHaveProperty('opener');
      expect(variables).toHaveProperty('angle');
    });
  });

  describe('LOCATIONS constant', () => {
    it('should contain all required location domains with their locations', () => {
      const locations = TourGuideGenerator.LOCATIONS;

      expect(locations).toHaveProperty('HOME');
      expect(locations).toHaveProperty('WORK');
      expect(locations).toHaveProperty('PUBLIC');
      expect(locations).toHaveProperty('DIGITAL');

      expect(locations.HOME).toContain('kitchen');
      expect(locations.WORK).toContain('office');
      expect(locations.PUBLIC).toContain('supermarket');
      expect(locations.DIGITAL).toContain('email inbox');
    });
  });

  describe('TOUR_GUIDE_OPENERS constant', () => {
    it('should contain tour guide trope openers', () => {
      const openers = TourGuideGenerator.TOUR_GUIDE_OPENERS;

      expect(openers).toContain('ON YOUR LEFT YOU WILL SEE');
      expect(openers).toContain('IF YOU LOOK UP');
      expect(openers).toContain('AND HERE WE HAVE');
      expect(openers.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('ANGLES constant', () => {
    it('should contain all required angles', () => {
      const angles = TourGuideGenerator.ANGLES;

      expect(angles).toContain('WILDLIFE');
      expect(angles).toContain('HISTORICAL');
      expect(angles).toContain('DANGER ZONE');
      expect(angles).toContain('EXHIBIT');
      expect(angles).toContain('HAUNTED');
      expect(angles.length).toBe(5);
    });
  });
});
