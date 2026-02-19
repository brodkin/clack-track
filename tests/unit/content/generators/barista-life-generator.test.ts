/**
 * Barista Life Generator Tests
 *
 * Tests for the BaristaLifeGenerator class which creates coffee shop
 * and barista humor for the Vestaboard display.
 */

import {
  BaristaLifeGenerator,
  BARISTA_SCENARIOS,
  DELIVERY_STYLES,
  STYLE_GUIDANCE,
} from '@/content/generators/ai/barista-life-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';

// Mock createAIProvider function
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn(() =>
    createMockAIProvider({
      response: {
        text: 'MORNING RUSH IS JUST\nORGANIZED PANIC WITH\nJAZZ MUSIC',
        model: 'gpt-4.1-nano',
        tokensUsed: 50,
      },
    })
  ),
  AIProviderType: {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
  },
}));

// Mock personality generation
jest.mock('@/content/personality/index.js', () => ({
  generatePersonalityDimensions: jest.fn(() => ({
    mood: 'sassy',
    energyLevel: 'high',
    humorStyle: 'deadpan',
    obsession: 'coffee',
  })),
}));

describe('BaristaLifeGenerator', () => {
  let generator: BaristaLifeGenerator;
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPromptLoader = {
      loadPrompt: jest.fn().mockResolvedValue('prompt content'),
      loadPromptWithVariables: jest.fn().mockResolvedValue('prompt with variables'),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    generator = new BaristaLifeGenerator(mockPromptLoader, mockModelTierSelector, {
      openai: 'test-api-key',
    });
  });

  describe('constructor', () => {
    it('should create generator with LIGHT model tier', () => {
      expect(generator).toBeDefined();
    });

    it('should use major-update-base.txt as system prompt', () => {
      const systemPromptFile = (
        generator as unknown as { getSystemPromptFile: () => string }
      ).getSystemPromptFile();
      expect(systemPromptFile).toBe('major-update-base.txt');
    });

    it('should use barista-life.txt as user prompt', () => {
      const userPromptFile = (
        generator as unknown as { getUserPromptFile: () => string }
      ).getUserPromptFile();
      expect(userPromptFile).toBe('barista-life.txt');
    });
  });

  describe('BARISTA_SCENARIOS dictionary', () => {
    it('should have multiple scenario categories', () => {
      const categories = Object.keys(BARISTA_SCENARIOS);
      expect(categories.length).toBeGreaterThanOrEqual(8);
      expect(categories).toContain('PEAK_HOUR');
      expect(categories).toContain('MODIFICATIONS');
      expect(categories).toContain('SECRET_MENU');
      expect(categories).toContain('DRIVE_THRU');
      expect(categories).toContain('SHIFTS');
      expect(categories).toContain('SEASONAL');
      expect(categories).toContain('PARTNER_LIFE');
      expect(categories).toContain('CUSTOMERS');
    });

    it('should have scenarios in each category', () => {
      for (const category of Object.keys(BARISTA_SCENARIOS)) {
        const scenarios = BARISTA_SCENARIOS[category as keyof typeof BARISTA_SCENARIOS];
        expect(scenarios.length).toBeGreaterThan(0);
      }
    });

    it('should have universally relatable scenarios', () => {
      expect(BARISTA_SCENARIOS.PEAK_HOUR).toContain(
        'the morning rush with 47 mobile orders'
      );
      expect(BARISTA_SCENARIOS.SHIFTS).toContain('clopening as a lifestyle choice');
      expect(BARISTA_SCENARIOS.MODIFICATIONS).toContain(
        'a 17-modification drink that prints a receipt-length sticker'
      );
    });

    it('should be accessible via static property', () => {
      expect(BaristaLifeGenerator.BARISTA_SCENARIOS).toBe(BARISTA_SCENARIOS);
    });
  });

  describe('DELIVERY_STYLES dictionary', () => {
    it('should have multiple delivery styles', () => {
      expect(DELIVERY_STYLES.length).toBeGreaterThanOrEqual(7);
    });

    it('should include all defined styles', () => {
      expect(DELIVERY_STYLES).toContain('DEADPAN');
      expect(DELIVERY_STYLES).toContain('VENTING');
      expect(DELIVERY_STYLES).toContain('WAR_CORRESPONDENT');
      expect(DELIVERY_STYLES).toContain('THERAPIST_NOTES');
      expect(DELIVERY_STYLES).toContain('NATURE_DOCUMENTARY');
      expect(DELIVERY_STYLES).toContain('SURVIVAL_GUIDE');
      expect(DELIVERY_STYLES).toContain('SPORTS_COMMENTARY');
    });

    it('should be accessible via static property', () => {
      expect(BaristaLifeGenerator.DELIVERY_STYLES).toBe(DELIVERY_STYLES);
    });
  });

  describe('STYLE_GUIDANCE dictionary', () => {
    it('should have guidance for each style', () => {
      for (const style of DELIVERY_STYLES) {
        expect(STYLE_GUIDANCE[style]).toBeDefined();
        expect(typeof STYLE_GUIDANCE[style]).toBe('string');
        expect(STYLE_GUIDANCE[style].length).toBeGreaterThan(0);
      }
    });

    it('should have distinct guidance for each style', () => {
      const guidances = Object.values(STYLE_GUIDANCE);
      const uniqueGuidances = new Set(guidances);
      expect(uniqueGuidances.size).toBe(guidances.length);
    });

    it('should be accessible via static property', () => {
      expect(BaristaLifeGenerator.STYLE_GUIDANCE).toBe(STYLE_GUIDANCE);
    });
  });

  describe('selectRandomScenario', () => {
    it('should return a valid category and scenario', () => {
      const { category, scenario } = generator.selectRandomScenario();

      expect(Object.keys(BARISTA_SCENARIOS)).toContain(category);
      const categoryScenarios =
        BARISTA_SCENARIOS[category as keyof typeof BARISTA_SCENARIOS];
      expect(categoryScenarios).toContain(scenario);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const { scenario } = generator.selectRandomScenario();
        results.add(scenario);
      }
      // With 45+ scenarios and 50 tries, should get reasonable variety
      expect(results.size).toBeGreaterThan(5);
    });
  });

  describe('selectRandomStyle', () => {
    it('should return a valid delivery style', () => {
      const style = generator.selectRandomStyle();
      expect(DELIVERY_STYLES).toContain(style);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(generator.selectRandomStyle());
      }
      // With 7 styles and 50 tries, should hit most of them
      expect(results.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('generate', () => {
    it('should generate content successfully', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      const result = await generator.generate(context);

      expect(result.text).toContain('MORNING RUSH');
      expect(result.outputMode).toBe('text');
    });

    it('should include selection choices in metadata', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      const result = await generator.generate(context);

      expect(result.metadata).toHaveProperty('category');
      expect(result.metadata).toHaveProperty('scenario');
      expect(result.metadata).toHaveProperty('style');

      // Verify metadata contains valid selections
      const { category, scenario, style } = result.metadata as {
        category: string;
        scenario: string;
        style: string;
      };

      expect(Object.keys(BARISTA_SCENARIOS)).toContain(category);
      expect(DELIVERY_STYLES).toContain(style);

      // Scenario should be from the selected category
      const categoryScenarios =
        BARISTA_SCENARIOS[category as keyof typeof BARISTA_SCENARIOS];
      expect(categoryScenarios).toContain(scenario);
    });

    it('should inject template variables for scenario, style, and guidance', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      // Check that loadPromptWithVariables was called with template variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'barista-life.txt',
        expect.objectContaining({
          baristaScenario: expect.any(String),
          deliveryStyle: expect.any(String),
          styleGuidance: expect.any(String),
        })
      );
    });

    it('should inject correct style guidance based on selected style', async () => {
      // Mock selectRandomStyle to return a specific style
      jest.spyOn(generator, 'selectRandomStyle').mockReturnValue('WAR_CORRESPONDENT');

      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'barista-life.txt',
        expect.objectContaining({
          styleGuidance: STYLE_GUIDANCE.WAR_CORRESPONDENT,
        })
      );
    });
  });

  describe('template variable injection', () => {
    it('should use LIGHT model tier for cost efficiency', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });
  });
});
