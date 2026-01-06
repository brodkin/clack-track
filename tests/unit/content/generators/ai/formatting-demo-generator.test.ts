/**
 * Tests for FormattingDemoGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with custom formatting options
 * - Uses reduced dimensions (maxLines=3, maxCharsPerLine=18)
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Generates demo content demonstrating formatting features
 * - Includes formatOptions in generated content metadata
 * - Handles AI provider failures gracefully
 *
 * This generator serves as documentation and integration test for the
 * new formatting features introduced in the GeneratorFormatOptions system.
 */

import { FormattingDemoGenerator } from '@/content/generators/ai/formatting-demo-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext, GeneratorFormatOptions } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedFormattingDemoGenerator = FormattingDemoGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('FormattingDemoGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  /**
   * Expected formatting options for the demo generator.
   * These demonstrate the new formatting features:
   * - Reduced dimensions (3 lines x 18 chars)
   * - Left alignment
   * - Word wrap disabled
   */
  const expectedFormatOptions: GeneratorFormatOptions = {
    maxLines: 3,
    maxCharsPerLine: 18,
    textAlign: 'left',
    wordWrap: false,
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
        text: 'DEMO CONTENT\nFORMATTED NICELY\nTHREE LINES',
        model: 'gpt-4.1-nano',
        tokensUsed: 30,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(FormattingDemoGenerator);
    });

    it('should use LIGHT model tier for efficiency', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator['modelTier']).toBe(ModelTier.LIGHT);
    });

    it('should configure custom format options with reduced dimensions', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Access the private formatOptions via the base class
      const formatOptions = generator['formatOptions'];

      expect(formatOptions).toBeDefined();
      expect(formatOptions).toEqual(expectedFormatOptions);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return formatting-demo.txt for custom system prompt', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFormattingDemoGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('formatting-demo.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return formatting-demo.txt for user prompt', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFormattingDemoGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('formatting-demo.txt');
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
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
      // Mock createProviderForSelection to return our AI provider mock
      jest
        .spyOn(
          FormattingDemoGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.text).toBe('DEMO CONTENT\nFORMATTED NICELY\nTHREE LINES');
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-nano');
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
    });

    it('should include formatOptions in metadata', async () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.formatOptions).toBeDefined();
      expect(result.metadata?.formatOptions).toEqual(expectedFormatOptions);
    });

    it('should return outputMode: text', async () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.outputMode).toBe('text');
    });

    it('should include metadata with tier, provider, and personality', async () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
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

    it('should load system prompt with personality variables', async () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // Verify system prompt was loaded with personality variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'system',
        'formatting-demo.txt',
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
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFormattingDemoGenerator;

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should handle AI provider failures gracefully', async () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
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
          text: 'ALTERNATE DEMO\nCONTENT HERE\nTHREE LINES',
          model: 'claude-haiku-4.5',
          tokensUsed: 35,
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
        .spyOn(
          FormattingDemoGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValueOnce(mockAIProvider)
        .mockReturnValueOnce(alternateProvider);

      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
        anthropic: 'test-key-2',
      });

      const result = await generator.generate(mockContext);

      expect(result.text).toBe('ALTERNATE DEMO\nCONTENT HERE\nTHREE LINES');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toContain('Primary provider error');
      // Should still include formatOptions even on failover
      expect(result.metadata?.formatOptions).toEqual(expectedFormatOptions);

      createProviderSpy.mockRestore();
    });
  });

  describe('formatting options integration', () => {
    it('should pass custom dimensions to DimensionSubstitutor via base class', async () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // The formatOptions should be configured on the base class
      // and used by DimensionSubstitutor during prompt processing
      const formatOptions = generator['formatOptions'];

      expect(formatOptions?.maxLines).toBe(3);
      expect(formatOptions?.maxCharsPerLine).toBe(18);
    });

    it('should configure left text alignment', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const formatOptions = generator['formatOptions'];

      expect(formatOptions?.textAlign).toBe('left');
    });

    it('should configure word wrap disabled', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const formatOptions = generator['formatOptions'];

      expect(formatOptions?.wordWrap).toBe(false);
    });
  });

  describe('integration with base class', () => {
    it('should inherit retry logic from AIPromptGenerator', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that generate method exists (inherited from base class)
      expect(typeof generator.generate).toBe('function');
    });

    it('should inherit validation logic from AIPromptGenerator', () => {
      const generator = new FormattingDemoGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that validate method exists (inherited from base class)
      expect(typeof generator.validate).toBe('function');
    });
  });
});
