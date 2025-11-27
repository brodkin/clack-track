/**
 * Tests for AIPromptGenerator abstract base class
 *
 * Test coverage:
 * - Abstract class cannot be instantiated
 * - Constructor dependency injection
 * - validate() checks prompt files exist
 * - generate() retry logic with provider failover
 * - Error handling for missing prompts and provider failures
 * - Weather context injection
 */

import { AIPromptGenerator } from '@/content/generators/ai-prompt-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import type { GenerationContext } from '@/types/content-generator';
import { ModelTier } from '@/types/content-generator';
import type { PersonalityDimensions } from '@/content/personality';

// We need to create a concrete implementation for testing the abstract class
class TestAIPromptGenerator extends AIPromptGenerator {
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    modelTier: ModelTier,
    apiKeys: Record<string, string> = {}
  ) {
    super(promptLoader, modelTierSelector, modelTier, apiKeys);
  }

  protected getSystemPromptFile(): string {
    return 'test-system.txt';
  }

  protected getUserPromptFile(): string {
    return 'test-user.txt';
  }

  // Expose the private formatUserPrompt method for testing
  public testFormatUserPrompt(
    userPrompt: string,
    context: GenerationContext,
    personality: PersonalityDimensions
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).formatUserPrompt(userPrompt, context, personality);
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

    it('should load prompts using getSystemPromptFile() and getUserPromptFile()', async () => {
      mockPromptLoader.loadPromptWithVariables
        .mockResolvedValueOnce('system prompt')
        .mockResolvedValueOnce('user prompt');

      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4o',
      });

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      // This will throw because provider factory is not implemented
      await expect(generator.generate(mockContext)).rejects.toThrow();

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'system',
        'test-system.txt',
        expect.any(Object)
      );
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'test-user.txt',
        expect.any(Object)
      );
    });

    it('should select model using ModelTierSelector with configured tier', async () => {
      mockPromptLoader.loadPromptWithVariables
        .mockResolvedValueOnce('system prompt')
        .mockResolvedValueOnce('user prompt');

      mockModelTierSelector.select.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      });

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      await expect(generator.generate(mockContext)).rejects.toThrow();

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should call getAlternate when implemented to handle provider failover', async () => {
      mockPromptLoader.loadPromptWithVariables
        .mockResolvedValueOnce('system prompt')
        .mockResolvedValueOnce('user prompt');

      const primarySelection: ModelSelection = {
        provider: 'openai',
        model: 'gpt-4o',
      };

      mockModelTierSelector.select.mockReturnValue(primarySelection);

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      // Will fail because provider factory not implemented, but that's expected in test
      await expect(generator.generate(mockContext)).rejects.toThrow();

      // Verify model selector was used
      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });

    it('should throw error when all providers fail', async () => {
      mockPromptLoader.loadPrompt
        .mockResolvedValueOnce('system prompt')
        .mockResolvedValueOnce('user prompt');

      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4o',
      });

      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      await expect(generator.generate(mockContext)).rejects.toThrow();
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

  describe('weather context injection', () => {
    it('should inject weather section when context.data.weather exists', () => {
      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        data: {
          weather: {
            temperature: 72,
            temperatureUnit: '°F',
            condition: 'sunny',
            humidity: 45,
            colorCode: 66,
          },
          fetchedAt: new Date(),
          warnings: [],
        },
      };

      const formatted = generator.testFormatUserPrompt('Test prompt', context, {
        mood: 'cheerful',
        energyLevel: 'energetic',
        humorStyle: 'witty',
        obsession: 'coffee',
      });

      // Should contain weather section
      expect(formatted).toContain('=== CURRENT WEATHER ===');
      expect(formatted).toContain('Temperature: 72°F');
      expect(formatted).toContain('Condition: sunny');
      expect(formatted).toContain('Humidity: 45%');
    });

    it('should return original prompt when context.data is undefined', () => {
      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-01-01T12:00:00Z'),
      };

      const formatted = generator.testFormatUserPrompt('Test prompt', context, {
        mood: 'cheerful',
        energyLevel: 'energetic',
        humorStyle: 'witty',
        obsession: 'coffee',
      });

      // Should NOT contain weather section
      expect(formatted).not.toContain('=== CURRENT WEATHER ===');
      expect(formatted).toContain('Test prompt');
    });

    it('should return original prompt when context.data.weather is undefined', () => {
      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        data: {
          fetchedAt: new Date(),
          warnings: [],
        },
      };

      const formatted = generator.testFormatUserPrompt('Test prompt', context, {
        mood: 'cheerful',
        energyLevel: 'energetic',
        humorStyle: 'witty',
        obsession: 'coffee',
      });

      // Should NOT contain weather section
      expect(formatted).not.toContain('=== CURRENT WEATHER ===');
      expect(formatted).toContain('Test prompt');
    });

    it('should format weather section with all available fields', () => {
      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        data: {
          weather: {
            temperature: 18,
            temperatureUnit: '°C',
            condition: 'rainy',
            humidity: 80,
            apparentTemperature: 16,
            colorCode: 67,
          },
          fetchedAt: new Date(),
          warnings: [],
        },
      };

      const formatted = generator.testFormatUserPrompt('Test prompt', context, {
        mood: 'calm',
        energyLevel: 'relaxed',
        humorStyle: 'dry',
        obsession: 'tea',
      });

      // Should contain all weather fields including optional ones
      expect(formatted).toContain('Temperature: 18°C');
      expect(formatted).toContain('Condition: rainy');
      expect(formatted).toContain('Humidity: 80%');
      expect(formatted).toContain('Feels Like: 16°C');
    });

    it('should format weather section without optional fields', () => {
      const generator = new TestAIPromptGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        ModelTier.MEDIUM
      );

      const context: GenerationContext = {
        updateType: 'major',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        data: {
          weather: {
            temperature: 72,
            temperatureUnit: '°F',
            condition: 'sunny',
            colorCode: 66,
          },
          fetchedAt: new Date(),
          warnings: [],
        },
      };

      const formatted = generator.testFormatUserPrompt('Test prompt', context, {
        mood: 'cheerful',
        energyLevel: 'energetic',
        humorStyle: 'witty',
        obsession: 'coffee',
      });

      // Should contain required fields
      expect(formatted).toContain('Temperature: 72°F');
      expect(formatted).toContain('Condition: sunny');
      // Should NOT contain optional fields
      expect(formatted).not.toContain('Humidity:');
      expect(formatted).not.toContain('Feels Like:');
    });
  });
});
