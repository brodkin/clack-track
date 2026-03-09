/**
 * Tests for CorporateHoroscopeGenerator
 *
 * Generator-specific behavior:
 * - Zodiac sign selection (12 signs)
 * - Business context randomization (12 contexts)
 * - Template variable injection (zodiacSign, businessContext)
 * - Custom metadata tracking
 */

import { CorporateHoroscopeGenerator } from '@/content/generators/ai/corporate-horoscope-generator';
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

describe('CorporateHoroscopeGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    (createAIProvider as jest.Mock).mockReturnValue(
      createMockAIProvider({
        response: {
          text: 'CAPRICORN MERCURY ENTERS YOUR BANDWIDTH SECTOR',
          model: 'gpt-4.1-nano',
          tokensUsed: 50,
        },
      })
    );
  });

  describe('random zodiac sign selection', () => {
    const validSigns = [
      'Aries',
      'Taurus',
      'Gemini',
      'Cancer',
      'Leo',
      'Virgo',
      'Libra',
      'Scorpio',
      'Sagittarius',
      'Capricorn',
      'Aquarius',
      'Pisces',
    ];

    it('should select zodiac sign from all 12 valid signs', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      for (let i = 0; i < 10; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        await generator.generate(mockContext);

        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        const userPromptCall = calls[1];
        const templateVars = userPromptCall[2] as Record<string, unknown>;
        const sign = templateVars.zodiacSign as string;

        expect(validSigns).toContain(sign);
      }
    });

    it('should produce variety in zodiac sign selection over multiple generations', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const selectedSigns = new Set<string>();

      for (let i = 0; i < 20; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        await generator.generate(mockContext);

        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        const userPromptCall = calls[1];
        const templateVars = userPromptCall[2] as Record<string, unknown>;
        selectedSigns.add(templateVars.zodiacSign as string);
      }

      expect(selectedSigns.size).toBeGreaterThan(1);
    });
  });

  describe('template variable injection', () => {
    it('should inject zodiacSign and businessContext into user prompt', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'corporate-horoscope.txt',
        expect.objectContaining({
          zodiacSign: expect.any(String),
          businessContext: expect.any(String),
        })
      );
    });

    it('should select businessContext from valid contexts list', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const validContexts = [
        'Q1 planning season',
        'Q2 performance reviews',
        'Q3 budget reconciliation',
        'Q4 year-end crunch',
        'annual reorg announcement',
        'mandatory team building event',
        'open enrollment period',
        'all-hands meeting prep',
        'strategic pivot initiative',
        'headcount freeze',
        'digital transformation rollout',
        'synergy optimization sprint',
      ];

      for (let i = 0; i < 5; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        await generator.generate(mockContext);

        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        const userPromptCall = calls[1];
        const templateVars = userPromptCall[2] as Record<string, unknown>;
        const context = templateVars.businessContext as string;

        expect(validContexts).toContain(context);
      }
    });
  });

  describe('custom metadata tracking', () => {
    it('should include zodiacSign and businessContext in metadata', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.zodiacSign).toBeDefined();
      expect(typeof result.metadata?.zodiacSign).toBe('string');
      expect(result.metadata?.businessContext).toBeDefined();
      expect(typeof result.metadata?.businessContext).toBe('string');
    });
  });
});
