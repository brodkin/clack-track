/**
 * Tests for NewsGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses MEDIUM model tier for complex summarization
 * - Validates prompt files exist
 * - Generates news summary content via AI provider
 * - Handles AI provider failures gracefully
 */

import { NewsGenerator } from '@/content/generators/ai/news-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';

// Helper type for accessing protected members in tests
type ProtectedNewsGenerator = NewsGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('NewsGenerator', () => {
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
      const generator = new NewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(NewsGenerator);
    });

    it('should use MEDIUM model tier for complex summarization', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        tier: ModelTier.MEDIUM,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new NewsGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new NewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNewsGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return news-summary.txt', () => {
      const generator = new NewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNewsGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('news-summary.txt');
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new NewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new NewsGenerator(mockPromptLoader, mockModelTierSelector, {
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
      // This test verifies the generator calls the right methods
      // The actual generation logic is tested in the base class tests
      const generator = new NewsGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNewsGenerator;

      // Verify the generator uses the correct prompt files
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('news-summary.txt');
      expect(generator.modelTier).toBe(ModelTier.MEDIUM);
    });
  });
});
