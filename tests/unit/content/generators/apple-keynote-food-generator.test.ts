/**
 * Apple Keynote Food Generator Tests
 *
 * Tests for the AppleKeynoteFoodGenerator class which creates parodies
 * of tech keynote presentations applied to Americana foods.
 */

import {
  AppleKeynoteFoodGenerator,
  FOOD_ITEMS,
  KEYNOTE_STYLES,
  STYLE_GUIDANCE,
  PRODUCT_MODIFIERS,
} from '@/content/generators/ai/apple-keynote-food-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';

// Mock createAIProvider function
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn(() =>
    createMockAIProvider({
      response: {
        text: 'INTRODUCING\nFRIES ULTRA\n47% MORE CRISP\nWE CANT WAIT TO SEE\nWHAT YOU DIP',
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
    mood: 'confident',
    energyLevel: 'high',
    humorStyle: 'deadpan',
    obsession: 'product launches',
  })),
}));

describe('AppleKeynoteFoodGenerator', () => {
  let generator: AppleKeynoteFoodGenerator;
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

    generator = new AppleKeynoteFoodGenerator(mockPromptLoader, mockModelTierSelector, {
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

    it('should use apple-keynote-food.txt as user prompt', () => {
      const userPromptFile = (
        generator as unknown as { getUserPromptFile: () => string }
      ).getUserPromptFile();
      expect(userPromptFile).toBe('apple-keynote-food.txt');
    });
  });

  describe('FOOD_ITEMS dictionary', () => {
    it('should have multiple food categories', () => {
      const categories = Object.keys(FOOD_ITEMS);
      expect(categories.length).toBeGreaterThanOrEqual(10);
      expect(categories).toContain('BURGERS');
      expect(categories).toContain('FRIES');
      expect(categories).toContain('SHAKES_DRINKS');
      expect(categories).toContain('BREAKFAST');
      expect(categories).toContain('SANDWICHES');
      expect(categories).toContain('PIZZA');
      expect(categories).toContain('SIDES_APPS');
      expect(categories).toContain('HOT_DOGS');
      expect(categories).toContain('DESSERTS');
      expect(categories).toContain('CONDIMENTS');
      expect(categories).toContain('DINER_CLASSICS');
    });

    it('should have items in each category', () => {
      for (const category of Object.keys(FOOD_ITEMS)) {
        const items = FOOD_ITEMS[category as keyof typeof FOOD_ITEMS];
        expect(items.length).toBeGreaterThan(0);
      }
    });

    it('should have recognizable Americana foods', () => {
      expect(FOOD_ITEMS.BURGERS).toContain('cheeseburger');
      expect(FOOD_ITEMS.FRIES).toContain('curly fries');
      expect(FOOD_ITEMS.SHAKES_DRINKS).toContain('chocolate milkshake');
    });

    it('should be accessible via static property', () => {
      expect(AppleKeynoteFoodGenerator.FOOD_ITEMS).toBe(FOOD_ITEMS);
    });
  });

  describe('KEYNOTE_STYLES dictionary', () => {
    it('should have multiple keynote styles', () => {
      expect(KEYNOTE_STYLES.length).toBeGreaterThanOrEqual(16);
    });

    it('should include key rhetoric patterns', () => {
      expect(KEYNOTE_STYLES).toContain('product_launch');
      expect(KEYNOTE_STYLES).toContain('spec_reveal');
      expect(KEYNOTE_STYLES).toContain('one_more_thing');
      expect(KEYNOTE_STYLES).toContain('courage_moment');
      expect(KEYNOTE_STYLES).toContain('paradigm_shift');
    });

    it('should be accessible via static property', () => {
      expect(AppleKeynoteFoodGenerator.KEYNOTE_STYLES).toBe(KEYNOTE_STYLES);
    });
  });

  describe('STYLE_GUIDANCE dictionary', () => {
    it('should have guidance for each keynote style', () => {
      for (const style of KEYNOTE_STYLES) {
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
      expect(AppleKeynoteFoodGenerator.STYLE_GUIDANCE).toBe(STYLE_GUIDANCE);
    });
  });

  describe('PRODUCT_MODIFIERS dictionary', () => {
    it('should have multiple modifiers', () => {
      expect(PRODUCT_MODIFIERS.length).toBeGreaterThanOrEqual(20);
    });

    it('should include tech-inspired names', () => {
      expect(PRODUCT_MODIFIERS).toContain('Ultra');
      expect(PRODUCT_MODIFIERS).toContain('Titanium');
      expect(PRODUCT_MODIFIERS).toContain('Quantum');
      expect(PRODUCT_MODIFIERS).toContain('Limited Edition');
    });

    it('should be accessible via static property', () => {
      expect(AppleKeynoteFoodGenerator.PRODUCT_MODIFIERS).toBe(PRODUCT_MODIFIERS);
    });
  });

  describe('selectRandomFood', () => {
    it('should return a valid category and food item', () => {
      const { category, food } = generator.selectRandomFood();

      expect(Object.keys(FOOD_ITEMS)).toContain(category);
      const categoryItems = FOOD_ITEMS[category as keyof typeof FOOD_ITEMS];
      expect(categoryItems).toContain(food);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const { food } = generator.selectRandomFood();
        results.add(food);
      }
      expect(results.size).toBeGreaterThan(5);
    });
  });

  describe('selectRandomStyle', () => {
    it('should return a valid keynote style', () => {
      const style = generator.selectRandomStyle();
      expect(KEYNOTE_STYLES).toContain(style);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(generator.selectRandomStyle());
      }
      expect(results.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('selectRandomModifier', () => {
    it('should return a valid product modifier', () => {
      const modifier = generator.selectRandomModifier();
      expect(PRODUCT_MODIFIERS).toContain(modifier);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(generator.selectRandomModifier());
      }
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

      expect(result.text).toContain('FRIES ULTRA');
      expect(result.outputMode).toBe('text');
    });

    it('should include selection choices in metadata', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      const result = await generator.generate(context);

      expect(result.metadata).toHaveProperty('foodCategory');
      expect(result.metadata).toHaveProperty('foodItem');
      expect(result.metadata).toHaveProperty('keynoteStyle');
      expect(result.metadata).toHaveProperty('productModifier');

      const { foodCategory, foodItem, keynoteStyle, productModifier } = result.metadata as {
        foodCategory: string;
        foodItem: string;
        keynoteStyle: string;
        productModifier: string;
      };

      expect(Object.keys(FOOD_ITEMS)).toContain(foodCategory);
      expect(KEYNOTE_STYLES).toContain(keynoteStyle);
      expect(PRODUCT_MODIFIERS).toContain(productModifier);

      const categoryItems = FOOD_ITEMS[foodCategory as keyof typeof FOOD_ITEMS];
      expect(categoryItems).toContain(foodItem);
    });

    it('should inject template variables for food, style, and modifier', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'apple-keynote-food.txt',
        expect.objectContaining({
          foodItem: expect.any(String),
          keynoteStyle: expect.any(String),
          keynoteStyleGuidance: expect.any(String),
          productModifier: expect.any(String),
        })
      );
    });

    it('should inject correct style guidance based on selected style', async () => {
      jest.spyOn(generator, 'selectRandomStyle').mockReturnValue('one_more_thing');

      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'apple-keynote-food.txt',
        expect.objectContaining({
          keynoteStyleGuidance: STYLE_GUIDANCE.one_more_thing,
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
