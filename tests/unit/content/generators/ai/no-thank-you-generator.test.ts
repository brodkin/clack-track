/**
 * Tests for NoThankYouGenerator
 *
 * Generator-specific behavior:
 * - NO_THANK_YOU_SCENARIOS (64 items) and NO_THANK_YOU_TONES (16 items) arrays
 * - getTemplateVariables() returning { scenario, tone }
 * - Instance property storage and getCustomMetadata()
 * - Template variable passing in generate()
 */

import {
  NoThankYouGenerator,
  NO_THANK_YOU_SCENARIOS,
  NO_THANK_YOU_TONES,
} from '@/content/generators/ai/no-thank-you-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedNoThankYouGenerator = NoThankYouGenerator & {
  getTemplateVariables(context: GenerationContext): Promise<Record<string, string>>;
  getCustomMetadata(): Record<string, unknown>;
  selectedScenario: string;
  selectedTone: string;
};

describe('NoThankYouGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

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
        text: 'NO THANK YOU,\nBROUGHT MY OWN TEQUILA',
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('variety arrays', () => {
    it('should have NO_THANK_YOU_SCENARIOS array with 64 unique items', () => {
      expect(NO_THANK_YOU_SCENARIOS).toHaveLength(64);
      const uniqueScenarios = new Set(NO_THANK_YOU_SCENARIOS);
      expect(uniqueScenarios.size).toBe(NO_THANK_YOU_SCENARIOS.length);
    });

    it('should have NO_THANK_YOU_TONES array with 16 unique items', () => {
      expect(NO_THANK_YOU_TONES).toHaveLength(16);
      const uniqueTones = new Set(NO_THANK_YOU_TONES);
      expect(uniqueTones.size).toBe(NO_THANK_YOU_TONES.length);
    });

    it('should have non-empty string values in scenarios', () => {
      NO_THANK_YOU_SCENARIOS.forEach((scenario: string) => {
        expect(typeof scenario).toBe('string');
        expect(scenario.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty string values in tones', () => {
      NO_THANK_YOU_TONES.forEach((tone: string) => {
        expect(typeof tone).toBe('string');
        expect(tone.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getTemplateVariables()', () => {
    it('should return scenario and tone', async () => {
      const generator = new NoThankYouGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNoThankYouGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(templateVars.scenario).toBeDefined();
      expect(templateVars.tone).toBeDefined();
    });

    it('should return values from valid arrays', async () => {
      const generator = new NoThankYouGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNoThankYouGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(NO_THANK_YOU_SCENARIOS).toContain(templateVars.scenario);
      expect(NO_THANK_YOU_TONES).toContain(templateVars.tone);
    });

    it('should store selections in instance properties', async () => {
      const generator = new NoThankYouGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNoThankYouGenerator;

      const templateVars = await generator.getTemplateVariables(mockContext);

      expect(generator.selectedScenario).toBe(templateVars.scenario);
      expect(generator.selectedTone).toBe(templateVars.tone);
    });

    it('should generate different selections on multiple calls', async () => {
      const generator = new NoThankYouGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNoThankYouGenerator;

      const scenarioResults = new Set<string>();
      const toneResults = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const templateVars = await generator.getTemplateVariables(mockContext);
        scenarioResults.add(templateVars.scenario);
        toneResults.add(templateVars.tone);
      }

      expect(scenarioResults.size).toBeGreaterThan(1);
      expect(toneResults.size).toBeGreaterThan(1);
    });
  });

  describe('getCustomMetadata()', () => {
    it('should match instance properties', async () => {
      const generator = new NoThankYouGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedNoThankYouGenerator;

      await generator.getTemplateVariables(mockContext);
      const metadata = generator.getCustomMetadata();

      expect(metadata.selectedScenario).toBe(generator.selectedScenario);
      expect(metadata.selectedTone).toBe(generator.selectedTone);
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      jest
        .spyOn(
          NoThankYouGenerator.prototype as { createProviderForSelection: () => unknown },
          'createProviderForSelection'
        )
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should pass scenario and tone to PromptLoader template variables', async () => {
      const generator = new NoThankYouGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls.find(
        call => call[0] === 'user' && call[1] === 'no-thank-you.txt'
      );

      expect(userPromptCall).toBeDefined();
      const templateVars = userPromptCall?.[2] as Record<string, string>;
      expect(templateVars.scenario).toBeDefined();
      expect(templateVars.tone).toBeDefined();
    });

    it('should include selectedScenario and selectedTone in result metadata', async () => {
      const generator = new NoThankYouGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.selectedScenario).toBeDefined();
      expect(result.metadata?.selectedTone).toBeDefined();
    });
  });
});
