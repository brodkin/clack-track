/**
 * Tests for HaikuGenerator
 *
 * Generator-specific behavior:
 * - Topic randomization from valid topics list
 * - Topic injection via getTemplateVariables() hook
 * - Topic tracking via getCustomMetadata() hook
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

  describe('topic injection via getTemplateVariables()', () => {
    it('should inject random topic into user prompt as payload variable', async () => {
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
  });

  describe('topic tracking via getCustomMetadata()', () => {
    it('should include topic in metadata', async () => {
      const generator = new HaikuGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      // Topic should be in metadata from getCustomMetadata() hook
      expect(result.metadata?.topic).toBeDefined();
      expect(typeof result.metadata?.topic).toBe('string');
    });
  });
});
