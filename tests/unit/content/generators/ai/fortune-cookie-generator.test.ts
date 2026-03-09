/**
 * Tests for FortuneCookieGenerator
 *
 * Generator-specific behavior:
 * - Lucky numbers generation (6 random 2-digit numbers, space-separated)
 * - Programmatic title injection (FORTUNE COOKIE with color bars)
 * - formatOptions with textAlign: center
 * - Combined output structure (title + fortune lines + lucky numbers = 5 lines)
 * - Title preserved on failover
 */

import { FortuneCookieGenerator } from '@/content/generators/ai/fortune-cookie-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedFortuneCookieGenerator = FortuneCookieGenerator & {
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  generatedLuckyNumbers: string;
};

const EXPECTED_TITLE = '\uD83D\uDFE5 FORTUNE COOKIE \uD83D\uDFE5';

describe('FortuneCookieGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  const mockAIContent = `WISDOM HIDES IN PATIENCE
LIKE A CAT WAITS BY
THE EMPTY FOOD BOWL
LUCKY: 7 14 28 42`;

  beforeEach(() => {
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
      loadPromptTemplateWithVariables: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: mockAIContent,
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('getTemplateVariables()', () => {
    it('should generate 6 random lucky numbers between 10-99', async () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFortuneCookieGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.luckyNumbers).toBeDefined();
      const numbers = templateVars.luckyNumbers.split(' ').map(Number);
      expect(numbers).toHaveLength(6);
      numbers.forEach(num => {
        expect(num).toBeGreaterThanOrEqual(10);
        expect(num).toBeLessThanOrEqual(99);
        expect(Number.isInteger(num)).toBe(true);
      });
    });

    it('should return space-separated numbers', async () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFortuneCookieGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.luckyNumbers).toMatch(/^\d{2}( \d{2}){5}$/);
    });

    it('should store generated numbers in instance property', async () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFortuneCookieGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.generatedLuckyNumbers).toBe(templateVars.luckyNumbers);
    });

    it('should generate different numbers on each call', async () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedFortuneCookieGenerator;

      const results = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        results.add(templateVars.luckyNumbers);
      }

      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
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

    it('should pass luckyNumbers to PromptLoader template variables', async () => {
      const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'fortune-cookie.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.luckyNumbers).toBeDefined();
      expect(templateVars.luckyNumbers).toMatch(/^\d{2}( \d{2}){5}$/);
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

        expect(lines[0]).toBe(EXPECTED_TITLE);
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
        const luckyNumbers = result.metadata?.generatedLuckyNumbers as string;
        expect(luckyNumbers).toMatch(/^\d{2}( \d{2}){5}$/);
      });

      it('should produce 5 lines total (title + 3 fortune lines + lucky numbers)', async () => {
        const generator = new FortuneCookieGenerator(mockPromptLoader, mockModelTierSelector, {
          openai: 'test-key',
        });

        const result = await generator.generate(mockContext);
        const lines = result.text.split('\n');

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
    });

    describe('title preserved on failover', () => {
      it('should preserve title when failing over to alternate provider', async () => {
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

        expect(result.text.startsWith(EXPECTED_TITLE)).toBe(true);
        expect(result.metadata?.titleInjected).toBe(true);
        expect(result.metadata?.formatOptions?.textAlign).toBe('center');

        createProviderForSelectionSpy.mockRestore();
      });
    });
  });
});
