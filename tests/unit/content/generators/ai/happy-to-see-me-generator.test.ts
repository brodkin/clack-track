/**
 * Tests for HappyToSeeMeGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for cost efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Injects thematic vibes (not literal items) into prompts
 * - Covers all vibe dictionaries (THING_VIBES, LOCATION_VIBES, EMOTION_VIBES)
 * - THING_VIBES has 20+ unique entries
 * - LOCATION_VIBES has 20+ unique entries
 * - EMOTION_VIBES has 20+ unique entries
 * - Random selection produces variety (100-output variability test)
 */

import { HappyToSeeMeGenerator } from '@/content/generators/ai/happy-to-see-me-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedHappyToSeeMeGenerator = HappyToSeeMeGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  selectRandomThingVibe(): string;
  selectRandomLocationVibe(): string;
  selectRandomEmotionVibe(): string;
};

describe('HappyToSeeMeGenerator', () => {
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
      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(HappyToSeeMeGenerator);
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

      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(HappyToSeeMeGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHappyToSeeMeGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return happy-to-see-me.txt', () => {
      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHappyToSeeMeGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('happy-to-see-me.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt exists
        .mockRejectedValueOnce(new Error('File not found: happy-to-see-me.txt')); // user prompt missing

      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('thing vibe selection', () => {
    it('should select from valid thing vibes', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validVibes = HappyToSeeMeGenerator.THING_VIBES;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomThingVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections (100-output variability test)', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      // Run 100 times to test variety
      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomThingVibe());
      }

      // With 100 iterations and 20 items, should hit multiple unique values
      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('location vibe selection', () => {
    it('should select from valid location vibes', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validVibes = HappyToSeeMeGenerator.LOCATION_VIBES;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomLocationVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      // Run 100 times to test variety
      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomLocationVibe());
      }

      // With 100 iterations and 20 items, should hit multiple unique values
      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('emotion vibe selection', () => {
    it('should select from valid emotion vibes', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validVibes = HappyToSeeMeGenerator.EMOTION_VIBES;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomEmotionVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      // Run 100 times to test variety
      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomEmotionVibe());
      }

      // With 100 iterations and 20 items, should hit multiple unique values
      expect(selectedVibes.size).toBeGreaterThan(5);
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

      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {
          openai: 'test-key',
        }
      ) as ProtectedHappyToSeeMeGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('happy-to-see-me.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should inject all three vibe template variables into user prompt', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the prompt loading
      }

      // Verify loadPromptWithVariables was called with all three vibe template variables
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'happy-to-see-me.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('thingVibe');
      expect(variables).toHaveProperty('locationVibe');
      expect(variables).toHaveProperty('emotionVibe');
    });
  });

  describe('THING_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = HappyToSeeMeGenerator.THING_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      // Verify all entries are unique
      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = HappyToSeeMeGenerator.THING_VIBES;

      // Verify some expected thematic entries
      expect(vibes).toContain('retro tech nostalgia');
      expect(vibes).toContain('artisanal food culture');
      expect(vibes).toContain('wellness obsession');
      expect(vibes).toContain('hipster accessories');
    });
  });

  describe('LOCATION_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = HappyToSeeMeGenerator.LOCATION_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      // Verify all entries are unique
      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = HappyToSeeMeGenerator.LOCATION_VIBES;

      // Verify some expected thematic entries
      expect(vibes).toContain('domestic hiding spots');
      expect(vibes).toContain('travel storage chaos');
      expect(vibes).toContain('office desk archaeology');
      expect(vibes).toContain('pocket ecosystems');
    });
  });

  describe('EMOTION_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = HappyToSeeMeGenerator.EMOTION_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      // Verify all entries are unique
      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = HappyToSeeMeGenerator.EMOTION_VIBES;

      // Verify some expected thematic entries (non-standard emotions)
      expect(vibes).toContain('caffeinated energy');
      expect(vibes).toContain('fermented patience');
      expect(vibes).toContain('organized chaos');
      expect(vibes).toContain('nostalgic yearning');
    });
  });

  describe('metadata', () => {
    it('should include thingVibe, locationVibe, and emotionVibe in metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Use promptsOnly mode to get metadata without needing AI
      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('thingVibe');
      expect(result.metadata).toHaveProperty('locationVibe');
      expect(result.metadata).toHaveProperty('emotionVibe');

      // Verify vibes are from valid pools
      expect(HappyToSeeMeGenerator.THING_VIBES).toContain(result.metadata?.thingVibe);
      expect(HappyToSeeMeGenerator.LOCATION_VIBES).toContain(result.metadata?.locationVibe);
      expect(HappyToSeeMeGenerator.EMOTION_VIBES).toContain(result.metadata?.emotionVibe);
    });
  });

  describe('design philosophy', () => {
    it('should use vibes as inspiration not literal requirements', () => {
      // This is a documentation/design test - vibes should be thematic, not specific items
      const thingVibes = HappyToSeeMeGenerator.THING_VIBES;
      const locationVibes = HappyToSeeMeGenerator.LOCATION_VIBES;
      const emotionVibes = HappyToSeeMeGenerator.EMOTION_VIBES;

      // Vibes should be descriptive themes, not specific items
      // They should contain words like "vibes", "energy", "culture", "aesthetics", etc.
      const thematicWords = ['vibes', 'energy', 'culture', 'aesthetics', 'chaos', 'obsession'];
      const hasThematicContent = thingVibes.some(vibe =>
        thematicWords.some(word => vibe.includes(word))
      );
      expect(hasThematicContent).toBe(true);

      // Location vibes should be conceptual, not literal places
      const conceptualWords = ['archaeology', 'ecosystems', 'portals', 'dimensions', 'mysteries'];
      const hasConceptualLocations = locationVibes.some(vibe =>
        conceptualWords.some(word => vibe.includes(word))
      );
      expect(hasConceptualLocations).toBe(true);

      // Emotion vibes should be non-standard emotions/states
      const nonStandardEmotions = emotionVibes.filter(vibe =>
        !['happy', 'sad', 'angry', 'excited', 'scared'].some(basic => vibe.includes(basic))
      );
      expect(nonStandardEmotions.length).toBeGreaterThan(15); // Most should be non-standard
    });
  });
});
