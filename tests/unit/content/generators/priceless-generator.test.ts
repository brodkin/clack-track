/**
 * Priceless Generator Tests
 *
 * Tests for the PricelessGenerator class which creates Mastercard
 * "Priceless" parody content with setup-and-reveal structure.
 */

import { PricelessGenerator } from '@/content/generators/ai/priceless-generator';
import {
  PRICELESS_SCENARIOS,
  PRICELESS_TROPES,
  PRICELESS_TONES,
  selectRandomItem,
  selectRandomCategory,
  selectRandomScenario,
  getRandomTrope,
  getRandomTone,
  type PricelessScenarioCategory,
} from '@/content/generators/ai/priceless-dictionaries';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';

// Mock createAIProvider function
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn(() =>
    createMockAIProvider({
      response: {
        text: 'NEW SUIT: $400\nHAIRCUT: $35\nRESUMES: $12\nTHE INTERVIEWERS FACE\nPRICELESS',
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
    mood: 'mischievous',
    energyLevel: 'high',
    humorStyle: 'deadpan',
    obsession: 'irony',
  })),
}));

describe('PricelessGenerator', () => {
  let generator: PricelessGenerator;
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

    generator = new PricelessGenerator(mockPromptLoader, mockModelTierSelector, {
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

    it('should use priceless.txt as user prompt', () => {
      const userPromptFile = (
        generator as unknown as { getUserPromptFile: () => string }
      ).getUserPromptFile();
      expect(userPromptFile).toBe('priceless.txt');
    });
  });

  describe('PRICELESS_SCENARIOS dictionary', () => {
    it('should have multiple scenario categories', () => {
      const categories = Object.keys(PRICELESS_SCENARIOS);
      expect(categories.length).toBeGreaterThanOrEqual(12);
      expect(categories).toContain('PROFESSIONAL');
      expect(categories).toContain('SOCIAL');
      expect(categories).toContain('FAMILY');
      expect(categories).toContain('ROMANTIC');
      expect(categories).toContain('DAILY_LIFE');
      expect(categories).toContain('TECHNOLOGY');
      expect(categories).toContain('DINING');
      expect(categories).toContain('FITNESS');
      expect(categories).toContain('TRAVEL');
      expect(categories).toContain('SHOPPING');
      expect(categories).toContain('EDUCATION');
      expect(categories).toContain('CELEBRATIONS');
    });

    it('should have scenarios in each category', () => {
      for (const category of Object.keys(PRICELESS_SCENARIOS)) {
        const scenarios = PRICELESS_SCENARIOS[category as PricelessScenarioCategory];
        expect(scenarios.length).toBeGreaterThan(0);
      }
    });

    it('should have broadly relatable scenarios', () => {
      expect(PRICELESS_SCENARIOS.PROFESSIONAL).toContain('job interview');
      expect(PRICELESS_SCENARIOS.SOCIAL).toContain('first date');
      expect(PRICELESS_SCENARIOS.FAMILY).toContain('thanksgiving');
    });

    it('should be accessible via static property', () => {
      expect(PricelessGenerator.PRICELESS_SCENARIOS).toBe(PRICELESS_SCENARIOS);
    });
  });

  describe('PRICELESS_TROPES dictionary', () => {
    it('should have a large set of comedy tropes', () => {
      expect(PRICELESS_TROPES.length).toBeGreaterThanOrEqual(70);
    });

    it('should contain tropes from different comedy families', () => {
      // Exposure
      expect(PRICELESS_TROPES).toContain('accidental broadcast');
      // Wrong target
      expect(PRICELESS_TROPES).toContain('wrong recipient');
      // Timing
      expect(PRICELESS_TROPES).toContain('unfortunate timing');
      // Self-inflicted
      expect(PRICELESS_TROPES).toContain('the confident mistake');
      // Technology
      expect(PRICELESS_TROPES).toContain('autocorrect chaos');
      // Irony
      expect(PRICELESS_TROPES).toContain('dramatic irony');
    });

    it('should be accessible via static property', () => {
      expect(PricelessGenerator.PRICELESS_TROPES).toBe(PRICELESS_TROPES);
    });
  });

  describe('PRICELESS_TONES dictionary', () => {
    it('should have multiple tone registers', () => {
      expect(PRICELESS_TONES.length).toBeGreaterThanOrEqual(15);
    });

    it('should include diverse delivery styles', () => {
      expect(PRICELESS_TONES).toContain('deadpan corporate');
      expect(PRICELESS_TONES).toContain('nature documentary narrator');
      expect(PRICELESS_TONES).toContain('reality tv confessional');
    });

    it('should be accessible via static property', () => {
      expect(PricelessGenerator.PRICELESS_TONES).toBe(PRICELESS_TONES);
    });
  });

  describe('dictionary selection functions', () => {
    describe('selectRandomItem', () => {
      it('should return an element from the array', () => {
        const item = selectRandomItem(PRICELESS_TROPES);
        expect(PRICELESS_TROPES).toContain(item);
      });

      it('should throw on empty array', () => {
        expect(() => selectRandomItem([])).toThrow('Cannot select from empty array');
      });
    });

    describe('selectRandomCategory', () => {
      it('should return a valid category key', () => {
        const category = selectRandomCategory();
        expect(Object.keys(PRICELESS_SCENARIOS)).toContain(category);
      });
    });

    describe('selectRandomScenario', () => {
      it('should return a scenario from the given category', () => {
        const scenario = selectRandomScenario('PROFESSIONAL');
        expect(PRICELESS_SCENARIOS.PROFESSIONAL).toContain(scenario);
      });
    });

    describe('getRandomTrope', () => {
      it('should return a valid trope', () => {
        const trope = getRandomTrope();
        expect(PRICELESS_TROPES).toContain(trope);
      });
    });

    describe('getRandomTone', () => {
      it('should return a valid tone', () => {
        const tone = getRandomTone();
        expect(PRICELESS_TONES).toContain(tone);
      });
    });
  });

  describe('selectRandomScenario (generator method)', () => {
    it('should return a valid category and scenario', () => {
      const { category, scenario } = generator.selectRandomScenario();

      expect(Object.keys(PRICELESS_SCENARIOS)).toContain(category);
      const categoryScenarios = PRICELESS_SCENARIOS[category as PricelessScenarioCategory];
      expect(categoryScenarios).toContain(scenario);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const { scenario } = generator.selectRandomScenario();
        results.add(scenario);
      }
      expect(results.size).toBeGreaterThan(5);
    });
  });

  describe('selectRandomTrope', () => {
    it('should return a valid comedy trope', () => {
      const trope = generator.selectRandomTrope();
      expect(PRICELESS_TROPES).toContain(trope);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(generator.selectRandomTrope());
      }
      expect(results.size).toBeGreaterThan(10);
    });
  });

  describe('selectRandomTone', () => {
    it('should return a valid tone register', () => {
      const tone = generator.selectRandomTone();
      expect(PRICELESS_TONES).toContain(tone);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(generator.selectRandomTone());
      }
      expect(results.size).toBeGreaterThan(5);
    });
  });

  describe('generate', () => {
    it('should generate content successfully', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      const result = await generator.generate(context);

      expect(result.text).toContain('PRICELESS');
      expect(result.outputMode).toBe('text');
    });

    it('should include all selection choices in metadata', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      const result = await generator.generate(context);

      expect(result.metadata).toHaveProperty('category');
      expect(result.metadata).toHaveProperty('scenario');
      expect(result.metadata).toHaveProperty('trope');
      expect(result.metadata).toHaveProperty('tone');

      const { category, scenario, trope, tone } = result.metadata as {
        category: string;
        scenario: string;
        trope: string;
        tone: string;
      };

      expect(Object.keys(PRICELESS_SCENARIOS)).toContain(category);
      expect(PRICELESS_TROPES).toContain(trope);
      expect(PRICELESS_TONES).toContain(tone);

      // Scenario should be from the selected category
      const categoryScenarios = PRICELESS_SCENARIOS[category as PricelessScenarioCategory];
      expect(categoryScenarios).toContain(scenario);
    });

    it('should inject template variables for scenario, trope, and tone', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'priceless.txt',
        expect.objectContaining({
          pricelessScenario: expect.any(String),
          pricelessTrope: expect.any(String),
          pricelessTone: expect.any(String),
        })
      );
    });

    it('should use MEDIUM model tier for comedic reasoning quality', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.MEDIUM);
    });
  });
});
