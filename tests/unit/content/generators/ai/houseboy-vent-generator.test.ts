/**
 * Tests for HouseboyVentGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for cost efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Injects inspiration vibes (situation, copingEnergy, dramaIntensity) into prompts
 * - SITUATIONS has 100+ unique entries
 * - COPING_ENERGIES has 20+ unique entries
 * - DRAMA_INTENSITIES has 15+ unique entries
 * - Random selection produces variety (100-output variability test)
 */

import { HouseboyVentGenerator } from '@/content/generators/ai/houseboy-vent-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedHouseboyVentGenerator = HouseboyVentGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  selectRandomSituation(): string;
  selectRandomCopingEnergy(): string;
  selectRandomDramaIntensity(): string;
};

describe('HouseboyVentGenerator', () => {
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
      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(HouseboyVentGenerator);
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

      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(HouseboyVentGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHouseboyVentGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return houseboy-vent.txt', () => {
      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHouseboyVentGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('houseboy-vent.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt exists
        .mockRejectedValueOnce(new Error('File not found: houseboy-vent.txt')); // user prompt missing

      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('situation selection', () => {
    it('should select from valid situations', () => {
      const generator = new HouseboyVentGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHouseboyVentGenerator;

      const validSituations = HouseboyVentGenerator.SITUATIONS;

      // Run multiple times to test randomness
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

      // Run 100 times to test variety
      const selectedSituations = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedSituations.add(generator.selectRandomSituation());
      }

      // With 100 iterations and 100+ items, should hit many unique values
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

      // Run multiple times to test randomness
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

      // Run 100 times to test variety
      const selectedEnergies = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedEnergies.add(generator.selectRandomCopingEnergy());
      }

      // With 100 iterations and 20+ items, should hit multiple unique values
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

      // Run multiple times to test randomness
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

      // Run 100 times to test variety
      const selectedIntensities = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedIntensities.add(generator.selectRandomDramaIntensity());
      }

      // With 100 iterations and 15+ items, should hit multiple unique values
      expect(selectedIntensities.size).toBeGreaterThan(5);
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

      const generator = new HouseboyVentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHouseboyVentGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('houseboy-vent.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

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
        // May fail without AI provider - we're testing the prompt loading
      }

      // Verify loadPromptWithVariables was called with all three template variables
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

      // Verify all entries are unique
      const uniqueSituations = new Set(situations);
      expect(uniqueSituations.size).toBe(situations.length);
    });

    it('should contain everyday situations across multiple categories', () => {
      const situations = HouseboyVentGenerator.SITUATIONS;

      // Morning routine
      expect(situations).toContain('alarm');
      expect(situations).toContain('keys');

      // Technology
      expect(situations).toContain('wifi');
      expect(situations).toContain('charger');

      // Social
      expect(situations).toContain('small talk');
      expect(situations).toContain('eye contact');

      // Transportation
      expect(situations).toContain('parallel parking');
      expect(situations).toContain('traffic');
    });

    it('should use simple springboard words not prescriptive scenarios', () => {
      const situations = HouseboyVentGenerator.SITUATIONS;

      // Should be short springboards
      const avgLength = situations.reduce((sum, s) => sum + s.length, 0) / situations.length;
      expect(avgLength).toBeLessThan(20); // Short average length

      // Should NOT contain prescriptive phrases like "being slow" or "ran out"
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

      // Verify all entries are unique
      const uniqueEnergies = new Set(energies);
      expect(uniqueEnergies.size).toBe(energies.length);
    });

    it('should contain pretty privilege and Gen Z energy concepts', () => {
      const energies = HouseboyVentGenerator.COPING_ENERGIES;

      // Pretty privilege
      expect(energies).toContain('pretty privilege');
      expect(energies).toContain('face card');

      // Gen Z energy
      expect(energies).toContain('main character');
      expect(energies).toContain('villain arc');
      expect(energies).toContain('manifesting');
    });
  });

  describe('DRAMA_INTENSITIES constant', () => {
    it('should have 15+ unique entries', () => {
      const intensities = HouseboyVentGenerator.DRAMA_INTENSITIES;
      expect(intensities.length).toBeGreaterThanOrEqual(15);

      // Verify all entries are unique
      const uniqueIntensities = new Set(intensities);
      expect(uniqueIntensities.size).toBe(intensities.length);
    });

    it('should range from mild to absurd drama levels', () => {
      const intensities = HouseboyVentGenerator.DRAMA_INTENSITIES;

      // Mild
      expect(intensities).toContain('inconvenienced');
      expect(intensities).toContain('bothered');

      // High
      expect(intensities).toContain('spiraling');
      expect(intensities).toContain('existential');

      // Absurd
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

      // Use promptsOnly mode to get metadata without needing AI
      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('situation');
      expect(result.metadata).toHaveProperty('copingEnergy');
      expect(result.metadata).toHaveProperty('dramaIntensity');

      // Verify values are from valid pools
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

      // Situations should be single words or short phrases (springboards)
      const longSituations = situations.filter(s => s.split(' ').length > 3);
      expect(longSituations.length).toBe(0); // No situations with 4+ words

      // Coping energies should be abstract concepts
      const hasAbstractConcepts = copingEnergies.some(
        e =>
          e.includes('privilege') ||
          e.includes('character') ||
          e.includes('arc') ||
          e.includes('energy')
      );
      expect(hasAbstractConcepts).toBe(true);

      // Drama intensities should range from mild to absurd
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
