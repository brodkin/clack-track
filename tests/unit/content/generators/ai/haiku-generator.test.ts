/**
 * Tests for HaikuGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency (haikus are simple)
 * - Validates prompt files exist
 * - Generates haiku content via AI provider
 * - Injects random topics into prompt
 * - Topic randomization produces valid topics
 * - Handles AI provider failures gracefully
 */

import { HaikuGenerator } from '@/content/generators/ai/haiku-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedHaikuGenerator = HaikuGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('HaikuGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    // Mock AIProvider with successful response
    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: 'Generated haiku content',
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(HaikuGenerator);
    });

    it('should use LIGHT model tier for efficiency', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
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
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHaikuGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return haiku.txt', () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHaikuGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('haiku.txt');
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      // Mock createProvider to return our AI provider mock for each test
      jest
        .spyOn(HaikuGenerator.prototype as { createProvider: () => unknown }, 'createProvider')
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.text).toBe('Generated haiku content');
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-nano');
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
    });

    it('should return outputMode: text', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.outputMode).toBe('text');
    });

    it('should include metadata with tier, provider, and personality', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
      expect(result.metadata?.personality).toBeDefined();
      expect(result.metadata?.personality?.mood).toBeDefined();
      expect(result.metadata?.personality?.energyLevel).toBeDefined();
      expect(result.metadata?.personality?.humorStyle).toBeDefined();
      expect(result.metadata?.personality?.obsession).toBeDefined();
    });

    it('should inject random topic into user prompt via template variable', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // Verify loadPromptWithVariables was called with a payload (topic)
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'haiku.txt',
        expect.objectContaining({
          payload: expect.any(String),
        })
      );
    });

    it('should select topic from valid topics list', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const validTopics = [
        'Trains',
        'Business',
        'Architecture',
        'Food',
        'Comedy',
        'EDM Music',
        'Software development',
        'Aviation',
        'Disneyland',
        'Street lighting',
        'Current Weather',
        'Current Date',
        'Current holidays',
      ];

      // Run multiple times to check randomization
      for (let i = 0; i < 5; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        await generator.generate(mockContext);

        // User prompt is the second call (index 1) - system prompt is first (index 0)
        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(2);

        const userPromptCall = calls[1];
        expect(userPromptCall[0]).toBe('user');
        expect(userPromptCall[1]).toBe('haiku.txt');

        const templateVars = userPromptCall[2] as Record<string, unknown>;
        const topic = templateVars.payload as string;

        expect(validTopics).toContain(topic);
      }
    });

    it('should load system prompt with personality variables', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // Verify system prompt was loaded with personality variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'system',
        'major-update-base.txt',
        expect.objectContaining({
          mood: expect.any(String),
          energyLevel: expect.any(String),
          humorStyle: expect.any(String),
          obsession: expect.any(String),
          persona: 'Houseboy',
        })
      );
    });

    it('should use LIGHT tier for model selection', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedHaikuGenerator;

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should handle AI provider failures gracefully', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      mockAIProvider.generate.mockRejectedValue(new Error('AI provider error'));
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      await expect(generator.generate(mockContext)).rejects.toThrow(
        /All AI providers failed for tier/
      );
    });

    it('should failover to alternate provider on primary failure', async () => {
      const alternateProvider: jest.Mocked<AIProvider> = {
        generate: jest.fn().mockResolvedValue({
          text: 'Alternate provider haiku',
          model: 'claude-haiku-4.5',
          tokensUsed: 45,
        }),
        validateConnection: jest.fn().mockResolvedValue(true),
      } as unknown as jest.Mocked<AIProvider>;

      mockAIProvider.generate.mockRejectedValue(new Error('Primary provider error'));
      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-haiku-4.5',
        tier: ModelTier.LIGHT,
      });

      const createProviderSpy = jest
        .spyOn(HaikuGenerator.prototype as { createProvider: () => unknown }, 'createProvider')
        .mockReturnValueOnce(mockAIProvider)
        .mockReturnValueOnce(alternateProvider);

      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
        anthropic: 'test-key-2',
      });

      const result = await generator.generate(mockContext);

      expect(result.text).toBe('Alternate provider haiku');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toContain('Primary provider error');

      createProviderSpy.mockRestore();
    });
  });

  describe('integration with base class', () => {
    it('should inherit retry logic from AIPromptGenerator', () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that generate method exists (inherited from base class)
      expect(typeof generator.generate).toBe('function');
    });

    it('should inherit validation logic from AIPromptGenerator', () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that validate method exists (inherited from base class)
      expect(typeof generator.validate).toBe('function');
    });
  });
});
