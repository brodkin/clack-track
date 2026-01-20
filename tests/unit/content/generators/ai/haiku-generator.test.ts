/**
 * Tests for HaikuGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency (haikus are simple)
 * - Validates prompt files exist
 * - Generates haiku content via AI provider
 * - Uses Template Method hooks correctly:
 *   - getTemplateVariables() for topic injection
 *   - getCustomMetadata() for topic tracking
 * - Topic randomization produces valid topics
 * - Handles AI provider failures gracefully
 */

import { HaikuGenerator } from '@/content/generators/ai/haiku-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';

// Mock createAIProvider function to avoid real API calls
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn(),
  AIProviderType: {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
  },
}));

// Mock personality generation for consistent tests
jest.mock('@/content/personality/index.js', () => ({
  generatePersonalityDimensions: jest.fn(() => ({
    mood: 'cheerful',
    energyLevel: 'high',
    humorStyle: 'witty',
    obsession: 'coffee',
  })),
}));

import { createAIProvider } from '@/api/ai/index.js';

// Helper type for accessing protected members in tests
type ProtectedHaikuGenerator = HaikuGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('HaikuGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

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

    // Mock createAIProvider to return a successful mock provider
    (createAIProvider as jest.Mock).mockReturnValue(
      createMockAIProvider({
        response: {
          text: 'Generated haiku content',
          model: 'gpt-4.1-nano',
          tokensUsed: 50,
        },
      })
    );
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
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

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

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
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

    it('should include metadata with tier, provider, personality, and topic', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
      expect(result.metadata?.personality).toBeDefined();
      expect(result.metadata?.personality?.mood).toBe('cheerful');
      expect(result.metadata?.personality?.energyLevel).toBe('high');
      expect(result.metadata?.personality?.humorStyle).toBe('witty');
      expect(result.metadata?.personality?.obsession).toBe('coffee');
      // Topic should be tracked via getCustomMetadata() hook
      expect(result.metadata?.topic).toBeDefined();
    });

    it('should inject random topic into user prompt via getTemplateVariables() hook', async () => {
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
          mood: 'cheerful',
          energyLevel: 'high',
          humorStyle: 'witty',
          obsession: 'coffee',
          persona: 'Houseboy',
        })
      );
    });

    it('should use LIGHT tier for model selection', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should handle AI provider failures gracefully', async () => {
      (createAIProvider as jest.Mock).mockReturnValue(
        createMockAIProvider({
          shouldFail: true,
          failureError: new Error('AI provider error'),
        })
      );

      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await expect(generator.generate(mockContext)).rejects.toThrow(
        /All AI providers failed for tier/
      );
    });

    it('should failover to alternate provider on primary failure', async () => {
      const primaryProvider = createMockAIProvider({
        shouldFail: true,
        failureError: new Error('Primary provider error'),
      });

      const alternateProvider = createMockAIProvider({
        response: {
          text: 'Alternate provider haiku',
          model: 'claude-haiku-4.5',
          tokensUsed: 45,
        },
      });

      (createAIProvider as jest.Mock)
        .mockReturnValueOnce(primaryProvider)
        .mockReturnValueOnce(alternateProvider);

      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-haiku-4.5',
        tier: ModelTier.LIGHT,
      });

      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
        anthropic: 'test-key-2',
      });

      const result = await generator.generate(mockContext);

      expect(result.text).toBe('Alternate provider haiku');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toContain('Primary provider error');
    });
  });

  describe('integration with base class Template Method pattern', () => {
    it('should use getTemplateVariables() hook to inject topic', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // The hook should have been called, injecting payload variable
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls[1];
      expect(userPromptCall[2]).toHaveProperty('payload');
    });

    it('should use getCustomMetadata() hook to track topic', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      // Topic should be in metadata from getCustomMetadata() hook
      expect(result.metadata?.topic).toBeDefined();
      expect(typeof result.metadata?.topic).toBe('string');
    });

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
