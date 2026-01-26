/**
 * Tests for CorporateHoroscopeGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency
 * - Validates prompt files exist
 * - Generates corporate horoscope content via AI provider
 * - Uses Template Method hooks correctly:
 *   - getTemplateVariables() for zodiac sign and business context injection
 *   - getCustomMetadata() for sign and context tracking
 * - Random zodiac sign selection from all 12 signs
 * - Business context randomization produces valid contexts
 * - Handles AI provider failures gracefully
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

// Helper type for accessing protected members in tests
type ProtectedCorporateHoroscopeGenerator = CorporateHoroscopeGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('CorporateHoroscopeGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

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

    // Mock createAIProvider to return a successful mock provider
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

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(CorporateHoroscopeGenerator);
    });

    it('should use LIGHT model tier for efficiency', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new CorporateHoroscopeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' }
      ) as ProtectedCorporateHoroscopeGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return corporate-horoscope.txt', () => {
      const generator = new CorporateHoroscopeGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' }
      ) as ProtectedCorporateHoroscopeGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('corporate-horoscope.txt');
    });
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

      // Run multiple times to verify random selection from valid signs
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

      // Run enough times to likely get variety (with 12 signs, 20 runs should produce multiple unique signs)
      for (let i = 0; i < 20; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        await generator.generate(mockContext);

        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        const userPromptCall = calls[1];
        const templateVars = userPromptCall[2] as Record<string, unknown>;
        selectedSigns.add(templateVars.zodiacSign as string);
      }

      // Should have selected more than one unique sign (randomness working)
      expect(selectedSigns.size).toBeGreaterThan(1);
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    it('should generate content with expected GeneratedContent structure', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result).toBeDefined();
      expect(result.text).toBe('CAPRICORN MERCURY ENTERS YOUR BANDWIDTH SECTOR');
      expect(result.outputMode).toBe('text');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.model).toBe('gpt-4.1-nano');
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
    });

    it('should return outputMode: text', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.outputMode).toBe('text');
    });

    it('should include metadata with tier, provider, personality, zodiacSign, and businessContext', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.tier).toBe(ModelTier.LIGHT);
      expect(result.metadata?.provider).toBe('openai');
      expect(result.metadata?.personality).toBeDefined();
      expect(result.metadata?.zodiacSign).toBeDefined();
      expect(result.metadata?.businessContext).toBeDefined();
    });

    it('should inject zodiacSign and businessContext into user prompt via getTemplateVariables() hook', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // Verify loadPromptWithVariables was called with zodiacSign and businessContext
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

      // Run multiple times to check randomization
      for (let i = 0; i < 5; i++) {
        mockPromptLoader.loadPromptWithVariables.mockClear();
        await generator.generate(mockContext);

        // User prompt is the second call (index 1) - system prompt is first (index 0)
        const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(2);

        const userPromptCall = calls[1];
        expect(userPromptCall[0]).toBe('user');
        expect(userPromptCall[1]).toBe('corporate-horoscope.txt');

        const templateVars = userPromptCall[2] as Record<string, unknown>;
        const context = templateVars.businessContext as string;

        expect(validContexts).toContain(context);
      }
    });

    it('should select zodiacSign from valid signs', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const validSigns = [
        'Capricorn',
        'Aquarius',
        'Pisces',
        'Aries',
        'Taurus',
        'Gemini',
        'Cancer',
        'Leo',
        'Virgo',
        'Libra',
        'Scorpio',
        'Sagittarius',
      ];

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const templateVars = userPromptCall[2] as Record<string, unknown>;
      const sign = templateVars.zodiacSign as string;

      expect(validSigns).toContain(sign);
    });

    it('should load system prompt with personality variables', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // Verify system prompt was loaded with personality variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'system',
        'major-update-base.txt',
        expect.objectContaining({
          mood: 'cheerful',
          energyLevel: 'high',
          humorStyle: 'witty',
          obsession: 'coffee',
          persona: 'Houseboy',
        })
      );
    });

    it('should use LIGHT tier for model selection', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });

    it('should handle AI provider failures gracefully', async () => {
      (createAIProvider as jest.Mock).mockReturnValue(
        createMockAIProvider({
          shouldFail: true,
          failureError: new Error('AI provider error'),
        })
      );

      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await expect(generator.generate(mockContext)).rejects.toThrow(
        /All AI providers failed for tier/
      );
    });

    it('should failover to alternate provider on primary failure', async () => {
      const primaryProvider = createMockAIProvider({
        shouldFail: true,
        failureError: new Error('Primary provider error'),
      });

      const alternateProvider = createMockAIProvider({
        response: {
          text: 'GEMINI YOUR SYNERGIES ARE MISALIGNED',
          model: 'claude-haiku-4.5',
          tokensUsed: 45,
        },
      });

      (createAIProvider as jest.Mock)
        .mockReturnValueOnce(primaryProvider)
        .mockReturnValueOnce(alternateProvider);

      mockModelTierSelector.getAlternate.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-haiku-4.5',
        tier: ModelTier.LIGHT,
      });

      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
        anthropic: 'test-key-2',
      });

      const result = await generator.generate(mockContext);

      expect(result.text).toBe('GEMINI YOUR SYNERGIES ARE MISALIGNED');
      expect(result.metadata?.provider).toBe('anthropic');
      expect(result.metadata?.failedOver).toBe(true);
      expect(result.metadata?.primaryError).toContain('Primary provider error');
    });
  });

  describe('integration with base class Template Method pattern', () => {
    it('should use getTemplateVariables() hook to inject zodiacSign and businessContext', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      // The hook should have been called, injecting both variables
      const userPromptCall = mockPromptLoader.loadPromptWithVariables.mock.calls[1];
      expect(userPromptCall[2]).toHaveProperty('zodiacSign');
      expect(userPromptCall[2]).toHaveProperty('businessContext');
    });

    it('should use getCustomMetadata() hook to track zodiacSign and businessContext', async () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      // Both should be in metadata from getCustomMetadata() hook
      expect(result.metadata?.zodiacSign).toBeDefined();
      expect(typeof result.metadata?.zodiacSign).toBe('string');
      expect(result.metadata?.businessContext).toBeDefined();
      expect(typeof result.metadata?.businessContext).toBe('string');
    });

    it('should inherit retry logic from AIPromptGenerator', () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that generate method exists (inherited from base class)
      expect(typeof generator.generate).toBe('function');
    });

    it('should inherit validation logic from AIPromptGenerator', () => {
      const generator = new CorporateHoroscopeGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that validate method exists (inherited from base class)
      expect(typeof generator.validate).toBe('function');
    });
  });
});
