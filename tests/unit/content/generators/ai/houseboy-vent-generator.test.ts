/**
 * Tests for HouseboyVentGenerator
 *
 * Generator-specific behavior:
 * - SITUATIONS (100+), COPING_ENERGIES (20+), DRAMA_INTENSITIES (15+)
 * - Selection methods with 100-output variability
 * - Template variable injection (situation, copingEnergy, dramaIntensity)
 * - Custom metadata and design philosophy (springboard concepts, short phrases)
 */

import { HouseboyVentGenerator } from '@/content/generators/ai/houseboy-vent-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedHouseboyVentGenerator = HouseboyVentGenerator & {
  selectRandomSituation(): string;
  selectRandomCopingEnergy(): string;
  selectRandomDramaIntensity(): string;
};

describe('HouseboyVentGenerator', () => {
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

  describe('situation selection', () => {
    it('should select from valid situations', () => {
      const generator = new HouseboyVentGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHouseboyVentGenerator;

      const validSituations = HouseboyVentGenerator.SITUATIONS;

      for (let i = 0; i < 50; i++) {
        const situation = generator.selectRandomSituation();
        expect(validSituations).toContain(situation);
      }
    });

    it('should produce variety in selections (100-output variability test)', () => {
      const generator = new HouseboyVentGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHouseboyVentGenerator;

      const selectedSituations = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedSituations.add(generator.selectRandomSituation());
      }

      expect(selectedSituations.size).toBeGreaterThan(20);
    });
  });

  describe('coping energy selection', () => {
    it('should select from valid coping energies', () => {
      const generator = new HouseboyVentGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHouseboyVentGenerator;

      const validEnergies = HouseboyVentGenerator.COPING_ENERGIES;

      for (let i = 0; i < 50; i++) {
        const energy = generator.selectRandomCopingEnergy();
        expect(validEnergies).toContain(energy);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new HouseboyVentGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHouseboyVentGenerator;

      const selectedEnergies = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedEnergies.add(generator.selectRandomCopingEnergy());
      }

      expect(selectedEnergies.size).toBeGreaterThan(5);
    });
  });

  describe('drama intensity selection', () => {
    it('should select from valid drama intensities', () => {
      const generator = new HouseboyVentGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHouseboyVentGenerator;

      const validIntensities = HouseboyVentGenerator.DRAMA_INTENSITIES;

      for (let i = 0; i < 50; i++) {
        const intensity = generator.selectRandomDramaIntensity();
        expect(validIntensities).toContain(intensity);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new HouseboyVentGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHouseboyVentGenerator;

      const selectedIntensities = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedIntensities.add(generator.selectRandomDramaIntensity());
      }

      expect(selectedIntensities.size).toBeGreaterThan(5);
    });
  });

  describe('template variable injection', () => {
    it('should inject all three template variables into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider
      }

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'houseboy-vent.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('situation');
      expect(variables).toHaveProperty('copingEnergy');
      expect(variables).toHaveProperty('dramaIntensity');
    });
  });

  describe('SITUATIONS constant', () => {
    it('should have 100+ unique entries', () => {
      const situations = HouseboyVentGenerator.SITUATIONS;
      expect(situations.length).toBeGreaterThanOrEqual(100);

      const uniqueSituations = new Set(situations);
      expect(uniqueSituations.size).toBe(situations.length);
    });

    it('should contain everyday situations across multiple categories', () => {
      const situations = HouseboyVentGenerator.SITUATIONS;

      expect(situations).toContain('alarm');
      expect(situations).toContain('keys');
      expect(situations).toContain('wifi');
      expect(situations).toContain('charger');
      expect(situations).toContain('small talk');
      expect(situations).toContain('parallel parking');
    });

    it('should use simple springboard words not prescriptive scenarios', () => {
      const situations = HouseboyVentGenerator.SITUATIONS;

      const avgLength = situations.reduce((sum, s) => sum + s.length, 0) / situations.length;
      expect(avgLength).toBeLessThan(20);

      const prescriptiveCount = situations.filter(
        s => s.includes(' slow') || s.includes(' ran ') || s.includes(' broke')
      ).length;
      expect(prescriptiveCount).toBe(0);
    });
  });

  describe('COPING_ENERGIES constant', () => {
    it('should have 20+ unique entries', () => {
      const energies = HouseboyVentGenerator.COPING_ENERGIES;
      expect(energies.length).toBeGreaterThanOrEqual(20);

      const uniqueEnergies = new Set(energies);
      expect(uniqueEnergies.size).toBe(energies.length);
    });

    it('should contain pretty privilege and Gen Z energy concepts', () => {
      const energies = HouseboyVentGenerator.COPING_ENERGIES;

      expect(energies).toContain('pretty privilege');
      expect(energies).toContain('face card');
      expect(energies).toContain('main character');
      expect(energies).toContain('villain arc');
      expect(energies).toContain('manifesting');
    });
  });

  describe('DRAMA_INTENSITIES constant', () => {
    it('should have 15+ unique entries', () => {
      const intensities = HouseboyVentGenerator.DRAMA_INTENSITIES;
      expect(intensities.length).toBeGreaterThanOrEqual(15);

      const uniqueIntensities = new Set(intensities);
      expect(uniqueIntensities.size).toBe(intensities.length);
    });

    it('should range from mild to absurd drama levels', () => {
      const intensities = HouseboyVentGenerator.DRAMA_INTENSITIES;

      expect(intensities).toContain('inconvenienced');
      expect(intensities).toContain('bothered');
      expect(intensities).toContain('spiraling');
      expect(intensities).toContain('existential');
      expect(intensities).toContain('joker arc');
      expect(intensities).toContain('rock bottom');
    });
  });

  describe('metadata', () => {
    it('should include situation, copingEnergy, and dramaIntensity in metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('situation');
      expect(result.metadata).toHaveProperty('copingEnergy');
      expect(result.metadata).toHaveProperty('dramaIntensity');

      expect(HouseboyVentGenerator.SITUATIONS).toContain(result.metadata?.situation);
      expect(HouseboyVentGenerator.COPING_ENERGIES).toContain(result.metadata?.copingEnergy);
      expect(HouseboyVentGenerator.DRAMA_INTENSITIES).toContain(result.metadata?.dramaIntensity);
    });
  });

  describe('design philosophy', () => {
    it('should use springboard concepts not prescriptive scenarios', () => {
      const situations = HouseboyVentGenerator.SITUATIONS;
      const copingEnergies = HouseboyVentGenerator.COPING_ENERGIES;
      const dramaIntensities = HouseboyVentGenerator.DRAMA_INTENSITIES;

      const longSituations = situations.filter(s => s.split(' ').length > 3);
      expect(longSituations.length).toBe(0);

      const hasAbstractConcepts = copingEnergies.some(
        e =>
          e.includes('privilege') ||
          e.includes('character') ||
          e.includes('arc') ||
          e.includes('energy')
      );
      expect(hasAbstractConcepts).toBe(true);

      const hasMild = dramaIntensities.some(
        i => i.includes('inconvenienced') || i.includes('bothered')
      );
      const hasAbsurd = dramaIntensities.some(
        i => i.includes('joker') || i.includes('rock bottom') || i.includes('awakening')
      );
      expect(hasMild && hasAbsurd).toBe(true);
    });
  });
});
