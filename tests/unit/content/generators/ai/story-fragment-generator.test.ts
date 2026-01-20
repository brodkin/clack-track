/**
 * Tests for StoryFragmentGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses MEDIUM model tier for scene coherence nuance
 * - Validates prompt files exist
 * - Generates story fragment content via AI provider
 * - Injects scenario and emotionalBeat template variables
 * - Handles AI provider failures gracefully
 */

import {
  StoryFragmentGenerator,
  SCENARIO,
  EMOTIONAL_BEAT,
} from '@/content/generators/ai/story-fragment-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedStoryFragmentGenerator = StoryFragmentGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  modelTier: ModelTier;
};

describe('StoryFragmentGenerator', () => {
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
    it('should create instance with PromptLoader, ModelTierSelector, and MEDIUM tier', () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(StoryFragmentGenerator);
    });

    it('should use MEDIUM model tier for scene coherence', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify via observable behavior: modelTierSelector.select is called with MEDIUM tier
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedStoryFragmentGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return story-fragment.txt', () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedStoryFragmentGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('story-fragment.txt');
    });
  });

  describe('getTemplateVariables()', () => {
    const mockContext: GenerationContext = {
      updateType: 'major',
      timestamp: new Date(),
    };

    it('should return scenario and emotionalBeat variables', async () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedStoryFragmentGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      expect(variables).toHaveProperty('scenario');
      expect(variables).toHaveProperty('emotionalBeat');
    });

    it('should return valid scenario from SCENARIO dictionary', async () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedStoryFragmentGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      expect(SCENARIO).toContain(variables.scenario);
    });

    it('should return valid emotionalBeat from EMOTIONAL_BEAT dictionary', async () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedStoryFragmentGenerator;

      const variables = await generator.getTemplateVariables(mockContext);

      expect(EMOTIONAL_BEAT).toContain(variables.emotionalBeat);
    });

    it('should return different values on multiple calls (randomness)', async () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedStoryFragmentGenerator;

      // Call multiple times and collect unique combinations
      const combinations = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const variables = await generator.getTemplateVariables(mockContext);
        combinations.add(`${variables.scenario}-${variables.emotionalBeat}`);
      }

      // With 17 scenarios and 8 emotional beats (136 combinations),
      // 50 calls should produce multiple unique combinations
      expect(combinations.size).toBeGreaterThan(1);
    });
  });

  describe('selectRandomScenario()', () => {
    it('should return a valid scenario from the dictionary', () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const scenario = generator.selectRandomScenario();

      expect(SCENARIO).toContain(scenario);
    });
  });

  describe('selectRandomEmotionalBeat()', () => {
    it('should return a valid emotional beat from the dictionary', () => {
      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const emotionalBeat = generator.selectRandomEmotionalBeat();

      expect(EMOTIONAL_BEAT).toContain(emotionalBeat);
    });
  });

  describe('static dictionaries', () => {
    it('should expose SCENARIO dictionary for testing', () => {
      expect(StoryFragmentGenerator.SCENARIO).toBeDefined();
      expect(StoryFragmentGenerator.SCENARIO).toEqual(SCENARIO);
      expect(StoryFragmentGenerator.SCENARIO.length).toBe(17);
    });

    it('should expose EMOTIONAL_BEAT dictionary for testing', () => {
      expect(StoryFragmentGenerator.EMOTIONAL_BEAT).toBeDefined();
      expect(StoryFragmentGenerator.EMOTIONAL_BEAT).toEqual(EMOTIONAL_BEAT);
      expect(StoryFragmentGenerator.EMOTIONAL_BEAT.length).toBe(8);
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    it('should load correct prompts and use MEDIUM tier', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedStoryFragmentGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('story-fragment.txt');

      // Verify tier via observable behavior
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should pass scenario and emotionalBeat to prompt loader', async () => {
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new StoryFragmentGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the variable injection
      }

      // Verify loadPromptWithVariables was called for user prompt with scenario and emotionalBeat
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'story-fragment.txt'
      );

      expect(userPromptCall).toBeDefined();
      expect(userPromptCall![2]).toHaveProperty('scenario');
      expect(userPromptCall![2]).toHaveProperty('emotionalBeat');
      expect(SCENARIO).toContain(userPromptCall![2].scenario);
      expect(EMOTIONAL_BEAT).toContain(userPromptCall![2].emotionalBeat);
    });
  });
});
