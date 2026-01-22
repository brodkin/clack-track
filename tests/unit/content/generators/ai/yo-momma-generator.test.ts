/**
 * Tests for YoMommaGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for cost efficiency
 * - Validates prompt files exist
 * - Returns correct system and user prompt file names
 * - Injects thematic vibes (not literal items) into prompts
 * - Covers all vibe dictionaries (QUALITY_VIBES, ACTION_VIBES, TONE_VIBES)
 * - QUALITY_VIBES has 20+ unique entries
 * - ACTION_VIBES has 20+ unique entries
 * - TONE_VIBES has 20+ unique entries
 * - Random selection produces variety (100-output variability test)
 */

import { YoMommaGenerator } from '@/content/generators/ai/yo-momma-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedYoMommaGenerator = YoMommaGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
  selectRandomQualityVibe(): string;
  selectRandomActionVibe(): string;
  selectRandomToneVibe(): string;
};

describe('YoMommaGenerator', () => {
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
      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(YoMommaGenerator);
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

      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(YoMommaGenerator);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedYoMommaGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return yo-momma.txt', () => {
      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedYoMommaGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('yo-momma.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when user prompt file is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt content') // system prompt exists
        .mockRejectedValueOnce(new Error('File not found: yo-momma.txt')); // user prompt missing

      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('quality vibe selection', () => {
    it('should select from valid quality vibes', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const validVibes = YoMommaGenerator.QUALITY_VIBES;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomQualityVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections (100-output variability test)', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      // Run 100 times to test variety
      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomQualityVibe());
      }

      // With 100 iterations and 20 items, should hit multiple unique values
      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('action vibe selection', () => {
    it('should select from valid action vibes', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const validVibes = YoMommaGenerator.ACTION_VIBES;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomActionVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      // Run 100 times to test variety
      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomActionVibe());
      }

      // With 100 iterations and 20 items, should hit multiple unique values
      expect(selectedVibes.size).toBeGreaterThan(5);
    });
  });

  describe('tone vibe selection', () => {
    it('should select from valid tone vibes', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      const validVibes = YoMommaGenerator.TONE_VIBES;

      // Run multiple times to test randomness
      for (let i = 0; i < 50; i++) {
        const vibe = generator.selectRandomToneVibe();
        expect(validVibes).toContain(vibe);
      }
    });

    it('should produce variety in selections', () => {
      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {}
      ) as ProtectedYoMommaGenerator;

      // Run 100 times to test variety
      const selectedVibes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        selectedVibes.add(generator.selectRandomToneVibe());
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

      const generator = new YoMommaGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        {
          openai: 'test-key',
        }
      ) as ProtectedYoMommaGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('yo-momma.txt');

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

      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the prompt loading
      }

      // Verify loadPromptWithVariables was called with all three vibe template variables
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'yo-momma.txt'
      );

      expect(userPromptCall).toBeDefined();
      const variables = userPromptCall?.[2];
      expect(variables).toHaveProperty('qualityVibe');
      expect(variables).toHaveProperty('actionVibe');
      expect(variables).toHaveProperty('toneVibe');
    });
  });

  describe('QUALITY_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = YoMommaGenerator.QUALITY_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      // Verify all entries are unique
      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = YoMommaGenerator.QUALITY_VIBES;

      // Verify some expected thematic entries
      expect(vibes).toContain('athletic prowess');
      expect(vibes).toContain('intellectual brilliance');
      expect(vibes).toContain('culinary mastery');
      expect(vibes).toContain('generous spirit');
    });
  });

  describe('ACTION_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = YoMommaGenerator.ACTION_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      // Verify all entries are unique
      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = YoMommaGenerator.ACTION_VIBES;

      // Verify some expected thematic entries
      expect(vibes).toContain('household miracle feats');
      expect(vibes).toContain('food-related achievements');
      expect(vibes).toContain('technology mishaps triumphs');
      expect(vibes).toContain('celebrity encounters');
    });
  });

  describe('TONE_VIBES constant', () => {
    it('should have 20+ unique entries', () => {
      const vibes = YoMommaGenerator.TONE_VIBES;
      expect(vibes.length).toBeGreaterThanOrEqual(20);

      // Verify all entries are unique
      const uniqueVibes = new Set(vibes);
      expect(uniqueVibes.size).toBe(vibes.length);
    });

    it('should contain thematic inspiration items', () => {
      const vibes = YoMommaGenerator.TONE_VIBES;

      // Verify some expected thematic entries (burn vs compliment tones)
      expect(vibes).toContain('sick burn');
      expect(vibes).toContain('backhanded compliment');
      expect(vibes).toContain('genuine hype');
      expect(vibes).toContain('wholesome flex');
    });
  });

  describe('metadata', () => {
    it('should include qualityVibe, actionVibe, and toneVibe in metadata', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new YoMommaGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Use promptsOnly mode to get metadata without needing AI
      const result = await generator.generate({
        updateType: 'major',
        timestamp: new Date(),
        promptsOnly: true,
      });

      expect(result.metadata).toHaveProperty('qualityVibe');
      expect(result.metadata).toHaveProperty('actionVibe');
      expect(result.metadata).toHaveProperty('toneVibe');

      // Verify vibes are from valid pools
      expect(YoMommaGenerator.QUALITY_VIBES).toContain(result.metadata?.qualityVibe);
      expect(YoMommaGenerator.ACTION_VIBES).toContain(result.metadata?.actionVibe);
      expect(YoMommaGenerator.TONE_VIBES).toContain(result.metadata?.toneVibe);
    });
  });

  describe('design philosophy', () => {
    it('should use vibes as inspiration not literal requirements', () => {
      // This is a documentation/design test - vibes should be thematic, not specific items
      const qualityVibes = YoMommaGenerator.QUALITY_VIBES;
      const actionVibes = YoMommaGenerator.ACTION_VIBES;
      const toneVibes = YoMommaGenerator.TONE_VIBES;

      // Quality vibes should be abstract qualities, not specific adjectives
      const qualityThematicWords = ['prowess', 'brilliance', 'mastery', 'spirit', 'genius', 'savviness'];
      const hasQualityThematicContent = qualityVibes.some(vibe =>
        qualityThematicWords.some(word => vibe.includes(word))
      );
      expect(hasQualityThematicContent).toBe(true);

      // Action vibes should be conceptual categories, not literal actions
      const actionConceptualWords = ['feats', 'achievements', 'mishaps', 'encounters', 'powers', 'legends'];
      const hasConceptualActions = actionVibes.some(vibe =>
        actionConceptualWords.some(word => vibe.includes(word))
      );
      expect(hasConceptualActions).toBe(true);

      // Tone vibes should include both burn and compliment categories
      const burnTones = toneVibes.filter(vibe =>
        ['burn', 'roast', 'shade', 'dig', 'mockery', 'ribbing'].some(word => vibe.includes(word))
      );
      const complimentTones = toneVibes.filter(vibe =>
        ['hype', 'praise', 'flex', 'tribute', 'celebration', 'flattery', 'appreciation'].some(word =>
          vibe.includes(word)
        )
      );

      // Should have both categories
      expect(burnTones.length).toBeGreaterThan(3);
      expect(complimentTones.length).toBeGreaterThan(3);
    });
  });
});
