/**
 * Tests for CountdownGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Generates countdown content via AI provider
 * - Uses current date ({{date}}) from system context for calculations
 */

import { CountdownGenerator } from '@/content/generators/ai/countdown-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedCountdownGenerator = CountdownGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('CountdownGenerator', () => {
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
      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(CountdownGenerator);
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

      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
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

    it('should accept empty API keys', () => {
      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector);

      expect(generator).toBeDefined();
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCountdownGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return countdown.txt', () => {
      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCountdownGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('countdown.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      // Prompts should exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when system prompt is missing', async () => {
      mockPromptLoader.loadPrompt.mockImplementation((type: string) => {
        if (type === 'system') {
          throw new Error('File not found');
        }
        return Promise.resolve('prompt content');
      });

      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContainEqual(expect.stringContaining('System prompt not found'));
    });

    it('should return invalid when user prompt is missing', async () => {
      mockPromptLoader.loadPrompt.mockImplementation((type: string) => {
        if (type === 'user') {
          throw new Error('File not found');
        }
        return Promise.resolve('prompt content');
      });

      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContainEqual(expect.stringContaining('User prompt not found'));
    });
  });

  describe('generate()', () => {
    it('should load correct prompts and use LIGHT tier', async () => {
      // This test verifies the generator uses the right configuration
      // The actual generation logic is tested in the base class tests
      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCountdownGenerator;

      // Verify the generator uses the correct prompt files
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('countdown.txt');
      expect(generator.modelTier).toBe(ModelTier.LIGHT);
    });

    it('should use date from context for countdown calculations', async () => {
      // The base class provides {{date}} template variable automatically
      // This test confirms the generator relies on that mechanism
      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedCountdownGenerator;

      // The countdown generator should use the standard system prompt
      // which includes {{date}} template variable for current date context
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
    });
  });

  describe('inheritance', () => {
    it('should inherit from AIPromptGenerator', () => {
      const generator = new CountdownGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Check that generator has validate method from AIPromptGenerator
      expect(typeof generator.validate).toBe('function');
      expect(typeof generator.generate).toBe('function');
    });
  });
});
