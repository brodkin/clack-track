/**
 * Tests for CorporateHoroscopeGenerator
 *
 * Generator-specific behavior:
 * - Zodiac sign selection (12 signs)
 * - Business context randomization (12 contexts)
 * - Buzzword selection (5 from pool of 34)
 * - Template variable injection (zodiacSign, businessContext, selectedBuzzwords)
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
          selectedBuzzwords: expect.any(String),
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

  describe('buzzword selection', () => {
    const validBuzzwords = [
      'synergy',
      'leverage',
      'bandwidth',
      'deliverables',
      'circle back',
      'take offline',
      'low-hanging fruit',
      'move the needle',
      'deep dive',
      'pivot',
      'actionable',
      'stakeholder',
      'optimize',
      'scalable',
      'runway',
      'align',
      'unpack',
      'ecosystem',
      'paradigm shift',
      'value proposition',
      'thought leadership',
      'boil the ocean',
      'net-net',
      'tiger team',
      'north star',
      'right-size',
      'ideate',
      'cross-pollinate',
      'cadence',
      'guardrails',
      'swim lane',
      'table stakes',
      'headwinds',
      'double-click',
    ];

    it('should inject 5 valid buzzwords as a comma-separated string', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;
      const buzzwordString = templateVars.selectedBuzzwords as string;
      const buzzwords = buzzwordString.split(', ');

      expect(buzzwords).toHaveLength(5);
      buzzwords.forEach(bw => {
        expect(validBuzzwords).toContain(bw);
      });
    });

    it('should select unique buzzwords with no duplicates within one generation', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      for (let i = 0; i < 10; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        await generator.generate(mockContext);

        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        const templateVars = calls[1][2] as Record<string, unknown>;
        const buzzwords = (templateVars.selectedBuzzwords as string).split(', ');
        const unique = new Set(buzzwords);

        expect(unique.size).toBe(buzzwords.length);
      }
    });

    it('should produce variety in buzzword selection over multiple generations', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const allSelected = new Set<string>();

      for (let i = 0; i < 20; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        await generator.generate(mockContext);

        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        const templateVars = calls[1][2] as Record<string, unknown>;
        const buzzwords = (templateVars.selectedBuzzwords as string).split(', ');
        buzzwords.forEach(bw => allSelected.add(bw));
      }

      expect(allSelected.size).toBeGreaterThan(10);
    });
  });

  describe('custom metadata tracking', () => {
    it('should include zodiacSign, businessContext, and selectedBuzzwords in metadata', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.zodiacSign).toBeDefined();
      expect(typeof result.metadata?.zodiacSign).toBe('string');
      expect(result.metadata?.businessContext).toBeDefined();
      expect(typeof result.metadata?.businessContext).toBe('string');
      expect(result.metadata?.selectedBuzzwords).toBeDefined();
      expect(Array.isArray(result.metadata?.selectedBuzzwords)).toBe(true);
      expect((result.metadata?.selectedBuzzwords as string[]).length).toBe(5);
    });
  });
});
