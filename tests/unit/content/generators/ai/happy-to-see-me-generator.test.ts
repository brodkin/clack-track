/**
 * Tests for HappyToSeeMeGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for cost efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Injects random thing, container, and emotion into prompts
 * - Covers all dictionaries (THINGS, CONTAINERS, EMOTIONS)
 * - THINGS dictionary has 30+ unique entries
 * - CONTAINERS dictionary has 30+ unique entries
 * - EMOTIONS dictionary has 20+ unique entries
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
  selectRandomThing(): string;
  selectRandomContainer(): string;
  selectRandomEmotion(): string;
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

  describe('thing selection', () => {
    it('should select from valid things', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validThings = HappyToSeeMeGenerator.THINGS;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const thing = generator.selectRandomThing();
        expect(validThings).toContain(thing);
      }
    });

    it('should produce variety in selections (100-output variability test)', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      // Run 100 times to test variety
      const selectedThings = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedThings.add(generator.selectRandomThing());
      }

      // With 100 iterations and 30 items, should hit multiple unique values
      expect(selectedThings.size).toBeGreaterThan(5);
    });
  });

  describe('container selection', () => {
    it('should select from valid containers', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validContainers = HappyToSeeMeGenerator.CONTAINERS;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const container = generator.selectRandomContainer();
        expect(validContainers).toContain(container);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      // Run 100 times to test variety
      const selectedContainers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedContainers.add(generator.selectRandomContainer());
      }

      // With 100 iterations and 30 items, should hit multiple unique values
      expect(selectedContainers.size).toBeGreaterThan(5);
    });
  });

  describe('emotion selection', () => {
    it('should select from valid emotions', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      const validEmotions = HappyToSeeMeGenerator.EMOTIONS;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const emotion = generator.selectRandomEmotion();
        expect(validEmotions).toContain(emotion);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new HappyToSeeMeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedHappyToSeeMeGenerator;

      // Run 100 times to test variety
      const selectedEmotions = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedEmotions.add(generator.selectRandomEmotion());
      }

      // With 100 iterations and 20 items, should hit multiple unique values
      expect(selectedEmotions.size).toBeGreaterThan(5);
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

      const generator = new HappyToSeeMeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHappyToSeeMeGenerator;

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

    it('should inject all three template variables into user prompt', async () => {
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

      // Verify loadPromptWithVariables was called with all three template variables
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'happy-to-see-me.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('thing');
      expect(variables).toHaveProperty('container');
      expect(variables).toHaveProperty('emotion');
    });
  });

  describe('THINGS constant', () => {
    it('should have 30+ unique entries', () => {
      const things = HappyToSeeMeGenerator.THINGS;
      expect(things.length).toBeGreaterThanOrEqual(30);

      // Verify all entries are unique
      const uniqueThings = new Set(things);
      expect(uniqueThings.size).toBe(things.length);
    });

    it('should contain expected items', () => {
      const things = HappyToSeeMeGenerator.THINGS;

      // Verify some expected entries
      expect(things).toContain('vintage toaster');
      expect(things).toContain('sourdough starter');
      expect(things).toContain('rare vinyl record');
      expect(things).toContain('kombucha scoby');
      expect(things).toContain('mechanical keyboard');
    });
  });

  describe('CONTAINERS constant', () => {
    it('should have 30+ unique entries', () => {
      const containers = HappyToSeeMeGenerator.CONTAINERS;
      expect(containers.length).toBeGreaterThanOrEqual(30);

      // Verify all entries are unique
      const uniqueContainers = new Set(containers);
      expect(uniqueContainers.size).toBe(containers.length);
    });

    it('should contain expected items', () => {
      const containers = HappyToSeeMeGenerator.CONTAINERS;

      // Verify some expected entries
      expect(containers).toContain('cargo shorts');
      expect(containers).toContain('fanny pack');
      expect(containers).toContain('tote bag');
      expect(containers).toContain('sock drawer');
      expect(containers).toContain('glove compartment');
    });
  });

  describe('EMOTIONS constant', () => {
    it('should have 20+ unique entries', () => {
      const emotions = HappyToSeeMeGenerator.EMOTIONS;
      expect(emotions.length).toBeGreaterThanOrEqual(20);

      // Verify all entries are unique
      const uniqueEmotions = new Set(emotions);
      expect(uniqueEmotions.size).toBe(emotions.length);
    });

    it('should contain expected items', () => {
      const emotions = HappyToSeeMeGenerator.EMOTIONS;

      // Verify some expected entries (mix of standard and creative)
      expect(emotions).toContain('happy');
      expect(emotions).toContain('excited');
      expect(emotions).toContain('nostalgic');
      expect(emotions).toContain('fermented'); // creative non-standard emotion
      expect(emotions).toContain('caffeinated'); // creative non-standard emotion
    });
  });

  describe('metadata', () => {
    it('should include thing, container, and emotion in metadata', async () => {
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

      expect(result.metadata).toHaveProperty('thing');
      expect(result.metadata).toHaveProperty('container');
      expect(result.metadata).toHaveProperty('emotion');

      // Verify thing is from valid pool
      expect(HappyToSeeMeGenerator.THINGS).toContain(result.metadata?.thing);

      // Verify container is from valid pool
      expect(HappyToSeeMeGenerator.CONTAINERS).toContain(result.metadata?.container);

      // Verify emotion is from valid pool
      expect(HappyToSeeMeGenerator.EMOTIONS).toContain(result.metadata?.emotion);
    });
  });
});
