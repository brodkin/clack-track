/**
 * Tests for TourGuideGenerator
 *
 * Generator-specific behavior:
 * - LOCATIONS constant (HOME, WORK, PUBLIC, DIGITAL, SOCIAL domains)
 * - ANGLES constant (10 observational/personal angles)
 * - selectRandomLocation() and selectRandomAngle() methods
 * - Template variable injection (location, angle)
 */

import { TourGuideGenerator } from '@/content/generators/ai/tour-guide-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedTourGuideGenerator = TourGuideGenerator & {
  selectRandomLocation(): { locationDomain: string; location: string };
  selectRandomAngle(): string;
};

describe('TourGuideGenerator', () => {
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

      expect(angles).toContain('WILDLIFE');
      expect(angles).toContain('HISTORICAL');
      expect(angles).toContain('DANGER ZONE');
      expect(angles).toContain('EXHIBIT');
      expect(angles).toContain('HAUNTED');
      expect(angles).toContain('CRIME SCENE');
      expect(angles).toContain('REAL ESTATE LISTING');

      expect(angles).toContain('DEVASTATING MEMORIES');
      expect(angles).toContain('CONFESSIONAL');
      expect(angles).toContain('FIVE STAR REVIEW');

      expect(angles.length).toBe(10);
    });
  });

  describe('template variable injection', () => {
    let mockAIProvider: jest.Mocked<AIProvider>;

    beforeEach(() => {
      mockAIProvider = {
        generate: jest.fn().mockResolvedValue({
          text: 'MOCK CONTENT',
          model: 'gpt-4.1-nano',
          tokensUsed: 50,
        }),
        validateConnection: jest.fn().mockResolvedValue(true),
      } as unknown as jest.Mocked<AIProvider>;

      jest
        .spyOn(
          TourGuideGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
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

      await generator.generate({ updateType: 'major', timestamp: new Date() });

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
});
