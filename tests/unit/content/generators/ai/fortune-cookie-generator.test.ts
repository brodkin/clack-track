/**
 * Tests for FortuneCookieGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Generates fortune cookie content via AI provider
 * - Programmatic title injection: prepends 'FORTUNE COOKIE' with color bars
 * - Combined output structure: title + 3 fortune lines + lucky numbers = 5 lines
 * - formatOptions with textAlign: 'center' in metadata
 * - titleInjected: true metadata flag
 * - Handles AI provider failures gracefully
 */

import { FortuneCookieGenerator } from '@/content/generators/ai/fortune-cookie-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedFortuneCookieGenerator = FortuneCookieGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  generatedLuckyNumbers: string;
  modelTier: ModelTier;
};

/**
 * Expected programmatic title for fortune cookie content.
 * Uses red color bar emoji for visual emphasis on Vestaboard display.
 */
const EXPECTED_TITLE = '\uD83D\uDFE5 FORTUNE COOKIE \uD83D\uDFE5';

describe('FortuneCookieGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  /**
   * Sample AI-generated content (3 fortune lines + 1 lucky numbers line)
   * This simulates what the AI would generate per the updated prompt.
   */
  const mockAIContent = `WISDOM HIDES IN PATIENCE
LIKE A CAT WAITS BY
THE EMPTY FOOD BOWL
LUCKY: 7 14 28 42`;

  beforeEach(() => {
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
      loadPromptTemplateWithVariables: jest.fn(),
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
        text: mockAIContent,
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(FortuneCookieGenerator);
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

      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
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
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFortuneCookieGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return fortune-cookie.txt', () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFortuneCookieGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('fortune-cookie.txt');
    });
  });

  describe('validate()', () => {
    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('getTemplateVariables()', () => {
    it('should generate 6 random lucky numbers between 10-99', async () => {
      const generator = new FortuneCookieGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' }
      ) as ProtectedFortuneCookieGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.luckyNumbers).toBeDefined();
      const numbers = templateVars.luckyNumbers.split(' ').map(Number);
      expect(numbers).toHaveLength(6);
      numbers.forEach((num) => {
        expect(num).toBeGreaterThanOrEqual(10);
        expect(num).toBeLessThanOrEqual(99);
        expect(Number.isInteger(num)).toBe(true);
      });
    });

    it('should return space-separated numbers', async () => {
      const generator = new FortuneCookieGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' }
      ) as ProtectedFortuneCookieGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      // Should be space-separated format like '14 67 23 91 45 82'
      expect(templateVars.luckyNumbers).toMatch(/^\d{2}( \d{2}){5}$/);
    });

    it('should store generated numbers in instance property', async () => {
      const generator = new FortuneCookieGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' }
      ) as ProtectedFortuneCookieGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.generatedLuckyNumbers).toBe(templateVars.luckyNumbers);
    });

    it('should generate different numbers on each call', async () => {
      const generator = new FortuneCookieGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' }
      ) as ProtectedFortuneCookieGenerator;

      // Generate multiple times and collect results
      const results = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        results.add(templateVars.luckyNumbers);
      }

      // With random generation, we should get at least 2 different results
      // (probability of 10 identical random 6-number sequences is astronomically low)
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      // Mock createProviderForSelection to return our AI provider mock for each test
      jest
        .spyOn(
          FortuneCookieGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should load correct prompts and use LIGHT tier', async () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFortuneCookieGenerator;

      // Verify the generator uses the correct prompt files via protected methods
      expect(generator.getSystemPromptFile()).toBe('major-update-base.txt');
      expect(generator.getUserPromptFile()).toBe('fortune-cookie.txt');

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-nano');
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
    });

    describe('title injection', () => {
      it('should prepend programmatic title to AI-generated content', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);

        expect(result.text).toContain(EXPECTED_TITLE);
        expect(result.text.startsWith(EXPECTED_TITLE)).toBe(true);
      });

      it('should have AI content following the title line', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);
        const lines = result.text.split('\n');

        // First line is the title
        expect(lines[0]).toBe(EXPECTED_TITLE);
        // Remaining lines are AI content
        expect(lines.slice(1).join('\n')).toBe(mockAIContent);
      });

      it('should set titleInjected: true in metadata', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);

        expect(result.metadata?.titleInjected).toBe(true);
      });

      it('should include generatedLuckyNumbers in metadata', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);

        expect(result.metadata?.generatedLuckyNumbers).toBeDefined();
        expect(typeof result.metadata?.generatedLuckyNumbers).toBe('string');
        // Verify format: 6 two-digit numbers space-separated
        const luckyNumbers = result.metadata?.generatedLuckyNumbers as string;
        expect(luckyNumbers).toMatch(/^\d{2}( \d{2}){5}$/);
      });

      it('should produce 5 lines total (title + 3 fortune lines + lucky numbers)', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);
        const lines = result.text.split('\n');

        // Output structure:
        // Line 1: Programmatic title
        // Lines 2-4: AI-generated fortune wisdom
        // Line 5: AI-generated lucky numbers
        expect(lines).toHaveLength(5);
        expect(lines[0]).toBe(EXPECTED_TITLE);
        expect(lines[4]).toContain('LUCKY:');
      });
    });

    describe('formatOptions', () => {
      it('should return formatOptions with textAlign: center', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);

        expect(result.metadata?.formatOptions).toBeDefined();
        expect(result.metadata?.formatOptions?.textAlign).toBe('center');
      });

      it('should preserve base class metadata while adding formatOptions', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);

        // Base class metadata preserved
        expect(result.metadata?.provider).toBe('openai');
        expect(result.metadata?.model).toBe('gpt-4.1-nano');
        expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
        expect(result.metadata?.personality).toBeDefined();

        // New formatOptions added
        expect(result.metadata?.formatOptions?.textAlign).toBe('center');
        expect(result.metadata?.titleInjected).toBe(true);
      });
    });

    describe('output structure', () => {
      it('should return outputMode: text', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);

        expect(result.outputMode).toBe('text');
      });

      it('should include metadata with tier, provider, and personality', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
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

      it('should combine title with AI content separated by newline', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);

        // Verify the exact structure: title\nAI content
        const expectedOutput = `${EXPECTED_TITLE}\n${mockAIContent}`;
        expect(result.text).toBe(expectedOutput);
      });
    });

    describe('error handling', () => {
      it('should handle AI provider failures gracefully', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
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
            text: `BACKUP WISDOM HERE
FOR WHEN THINGS GO
WRONG UNEXPECTEDLY
LUCKY: 3 7 21 33`,
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

        const createProviderForSelectionSpy = jest
          .spyOn(
            FortuneCookieGenerator.prototype as { createProviderForSelection: () => unknown },
            'createProviderForSelection'
          )
          .mockReturnValueOnce(mockAIProvider)
          .mockReturnValueOnce(alternateProvider);

        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
          anthropic: 'test-key-2',
        });

        const result = await generator.generate(mockContext);

        // Title should still be prepended even on failover
        expect(result.text.startsWith(EXPECTED_TITLE)).toBe(true);
        expect(result.metadata?.provider).toBe('anthropic');
        expect(result.metadata?.failedOver).toBe(true);
        expect(result.metadata?.primaryError).toContain('Primary provider error');
        // New metadata should be preserved
        expect(result.metadata?.titleInjected).toBe(true);
        expect(result.metadata?.formatOptions?.textAlign).toBe('center');

        createProviderForSelectionSpy.mockRestore();
      });
    });
  });

  describe('integration with base class', () => {
    it('should inherit retry logic from AIPromptGenerator', () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that generate method exists (inherited from base class)
      expect(typeof generator.generate).toBe('function');
    });

    it('should inherit validation logic from AIPromptGenerator', () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that validate method exists (inherited from base class)
      expect(typeof generator.validate).toBe('function');
    });

    it('should override generate() to add title injection', async () => {
      // Mock createProviderForSelection for this test
      jest
        .spyOn(
          FortuneCookieGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);

      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      // Verify that generate() was overridden to add title
      expect(result.text.startsWith(EXPECTED_TITLE)).toBe(true);
      expect(result.metadata?.titleInjected).toBe(true);

      jest.restoreAllMocks();
    });
  });
});
