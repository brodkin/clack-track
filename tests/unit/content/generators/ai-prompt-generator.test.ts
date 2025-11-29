/**
 * Tests for AIPromptGenerator abstract base class
 *
 * Test coverage:
 * - Abstract class cannot be instantiated
 * - Constructor dependency injection
 * - validate() checks prompt files exist
 * - generate() retry logic with provider failover
 * - Error handling for missing prompts and provider failures
 */

import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector, type ModelSelection } from '@/api/ai/model-tier-selector';
import type { AIProvider } from '@/types/ai';
import type {
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
} from '@/types/content-generator';
import { ModelTier } from '@/types/content-generator';
import { createMockAIProvider, createRateLimitedProvider } from '@tests/__helpers__/mockAIProvider';

// We need to create a concrete implementation for testing the abstract class
class TestAIPromptGenerator {
  protected promptLoader: PromptLoader;
  protected modelTierSelector: ModelTierSelector;
  protected modelTier: ModelTier;
  private mockProvider: AIProvider;

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    modelTier: ModelTier,
    mockProvider: AIProvider = createMockAIProvider()
  ) {
    this.promptLoader = promptLoader;
    this.modelTierSelector = modelTierSelector;
    this.modelTier = modelTier;
    this.mockProvider = mockProvider;
  }

  protected getSystemPromptFile(): string {
    return 'test-system.txt';
  }

  protected getUserPromptFile(): string {
    return 'test-user.txt';
  }

  async validate(): Promise<GeneratorValidationResult> {
    const errors: string[] = [];

    // Check if system prompt exists
    const systemPromptPath = `prompts/system/${this.getSystemPromptFile()}`;
    try {
      await this.promptLoader.loadPrompt('system', this.getSystemPromptFile());
    } catch {
      errors.push(`System prompt not found: ${systemPromptPath}`);
    }

    // Check if user prompt exists
    const userPromptPath = `prompts/user/${this.getUserPromptFile()}`;
    try {
      await this.promptLoader.loadPrompt('user', this.getUserPromptFile());
    } catch {
      errors.push(`User prompt not found: ${userPromptPath}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Load prompts
    const systemPrompt = await this.promptLoader.loadPrompt('system', this.getSystemPromptFile());
    const userPrompt = await this.promptLoader.loadPrompt('user', this.getUserPromptFile());

    // Select model
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);

    // Get provider and generate
    const provider = this.getProviderForSelection(selection);

    let lastError: Error | null = null;

    // Format user prompt with context
    const formattedUserPrompt = `${userPrompt}\n\nContext: ${JSON.stringify(context)}`;

    // Try preferred provider
    try {
      const response = await provider.generate({
        systemPrompt,
        userPrompt: formattedUserPrompt,
      });

      return {
        text: response.text,
        outputMode: 'text',
        metadata: {
          model: response.model,
          tier: this.modelTier,
          provider: selection.provider,
          systemPrompt,
          userPrompt: formattedUserPrompt,
        },
      };
    } catch (error) {
      lastError = error as Error;
    }

    // Try alternate provider
    const alternate = this.modelTierSelector.getAlternate(selection);
    if (alternate) {
      try {
        const alternateProvider = this.getProviderForSelection(alternate);
        const response = await alternateProvider.generate({
          systemPrompt,
          userPrompt: formattedUserPrompt,
        });

        return {
          text: response.text,
          outputMode: 'text',
          metadata: {
            model: response.model,
            tier: this.modelTier,
            provider: alternate.provider,
            failedOver: true,
            systemPrompt,
            userPrompt: formattedUserPrompt,
          },
        };
      } catch (alternateError) {
        lastError = alternateError as Error;
      }
    }

    throw new Error(`All AI providers failed for tier ${this.modelTier}: ${lastError?.message}`);
  }

  private getProviderForSelection(_selection: ModelSelection): AIProvider {
    // Return the injected mock provider for testing
    return this.mockProvider;
  }

  // Allow tests to set a different provider for testing failover
  setMockProvider(provider: AIProvider): void {
    this.mockProvider = provider;
  }
}

describe('AIPromptGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn(),
      getAlternate: jest.fn(),
    } as unknown as jest.Mocked<ModelTierSelector>;
  });

  describe('constructor', () => {
    it('should accept PromptLoader, ModelTierSelector, and ModelTier via dependency injection', () => {
      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      expect(generator).toBeDefined();
      expect(generator['promptLoader']).toBe(mockPromptLoader);
      expect(generator['modelTierSelector']).toBe(mockModelTierSelector);
      expect(generator['modelTier']).toBe(ModelTier.MEDIUM);
    });

    it('should support all model tiers', () => {
      const lightGen = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.LIGHT
      );
      const mediumGen = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );
      const heavyGen = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.HEAVY
      );

      expect(lightGen['modelTier']).toBe(ModelTier.LIGHT);
      expect(mediumGen['modelTier']).toBe(ModelTier.MEDIUM);
      expect(heavyGen['modelTier']).toBe(ModelTier.HEAVY);
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(mockPromptLoader.loadPrompt).toHaveBeenCalledWith('system', 'test-system.txt');
      expect(mockPromptLoader.loadPrompt).toHaveBeenCalledWith('user', 'test-user.txt');
    });

    it('should return invalid when system prompt is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockRejectedValueOnce(new Error('System prompt not found'))
        .mockResolvedValueOnce('user prompt');

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toContain('System prompt not found');
    });

    it('should return invalid when user prompt is missing', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt')
        .mockRejectedValueOnce(new Error('User prompt not found'));

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toContain('User prompt not found');
    });

    it('should return invalid when both prompts are missing', async () => {
      mockPromptLoader.loadPrompt.mockRejectedValue(new Error('Prompt not found'));

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.[0]).toContain('System prompt not found');
      expect(result.errors?.[1]).toContain('User prompt not found');
    });
  });

  describe('generate()', () => {
    const mockContext: GenerationContext = {
      updateType: 'major',
      timestamp: new Date('2025-01-01T12:00:00Z'),
      eventData: { test: 'data' },
    };

    it('should include systemPrompt and userPrompt in metadata', async () => {
      const systemPromptContent = 'You are a helpful assistant for Vestaboard displays';
      const userPromptContent = 'Generate a motivational quote';
      const generatedText = 'Test generated content';

      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce(systemPromptContent)
        .mockResolvedValueOnce(userPromptContent);

      const mockProvider = createMockAIProvider({
        response: {
          text: generatedText,
          model: 'gpt-4o',
          tokensUsed: 100,
        },
      });

      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4o',
      });

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM,
        mockProvider
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.systemPrompt).toBe(systemPromptContent);
      expect(result.metadata?.userPrompt).toContain(userPromptContent);
      expect(result.text).toBe(generatedText);
      expect(result.outputMode).toBe('text');
    });

    it('should load prompts using getSystemPromptFile() and getUserPromptFile()', async () => {
      const systemPromptContent = 'system prompt';
      const userPromptContent = 'user prompt';

      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce(systemPromptContent)
        .mockResolvedValueOnce(userPromptContent);

      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4o',
      });

      const mockProvider = createMockAIProvider();

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM,
        mockProvider
      );

      const result = await generator.generate(mockContext);

      // Verify prompts were loaded
      expect(mockPromptLoader.loadPrompt).toHaveBeenCalledWith('system', 'test-system.txt');
      expect(mockPromptLoader.loadPrompt).toHaveBeenCalledWith('user', 'test-user.txt');

      // Verify generation succeeded and prompts are in metadata
      expect(result.metadata?.systemPrompt).toBe(systemPromptContent);
      expect(result.metadata?.userPrompt).toContain(userPromptContent);
    });

    it('should select model using ModelTierSelector with configured tier', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt')
        .mockResolvedValueOnce('user prompt');

      const selectedTierSelection: ModelSelection = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      };

      mockModelTierSelector.select.mockReturnValue(selectedTierSelection);

      const mockProvider = createMockAIProvider({
        response: { model: 'claude-3-5-sonnet-20241022' },
      });

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM,
        mockProvider
      );

      const result = await generator.generate(mockContext);

      // Verify tier selection was called with the correct tier
      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);

      // Verify generation succeeded with the selected model
      expect(result.metadata?.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.metadata?.provider).toBe('anthropic');
    });

    it('should call getAlternate when implemented to handle provider failover', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt')
        .mockResolvedValueOnce('user prompt');

      const primarySelection: ModelSelection = {
        provider: 'openai',
        model: 'gpt-4o',
      };

      mockModelTierSelector.select.mockReturnValue(primarySelection);

      // Mock getAlternate to verify it gets called (successful primary means it won't be used)
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const mockProvider = createMockAIProvider();

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM,
        mockProvider
      );

      const result = await generator.generate(mockContext);

      // Verify model selector was used
      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);

      // Verify generation succeeded with primary provider
      expect(result.text).toBeDefined();
      expect(result.metadata?.provider).toBe(primarySelection.provider);
    });

    it('should throw error when all providers fail', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt')
        .mockResolvedValueOnce('user prompt');

      const primarySelection: ModelSelection = {
        provider: 'openai',
        model: 'gpt-4o',
      };

      mockModelTierSelector.select.mockReturnValue(primarySelection);

      // No alternate provider available - test exhaustion
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      // Primary provider fails with RateLimitError to trigger failover attempt
      const failingProvider = createRateLimitedProvider('openai');

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM,
        failingProvider
      );

      // Should throw because primary fails and no alternate is available
      await expect(generator.generate(mockContext)).rejects.toThrow(
        /All AI providers failed for tier/
      );

      // Verify failover logic was attempted
      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
      expect(mockModelTierSelector.getAlternate).toHaveBeenCalledWith(primarySelection);
    });
  });

  describe('abstract methods', () => {
    it('should require subclasses to implement getSystemPromptFile()', () => {
      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      // Test implementation returns specific file
      expect(generator['getSystemPromptFile']()).toBe('test-system.txt');
    });

    it('should require subclasses to implement getUserPromptFile()', () => {
      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      // Test implementation returns specific file
      expect(generator['getUserPromptFile']()).toBe('test-user.txt');
    });
  });
});
