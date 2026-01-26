/**
 * One-Star Review Generator Tests
 *
 * Tests for the OneStarReviewGenerator class which creates satirical
 * one-star reviews of concepts and phenomena that cannot be rated.
 */

import {
  OneStarReviewGenerator,
  REVIEW_SUBJECTS,
  REVIEW_STYLES,
  STYLE_GUIDANCE,
} from '@/content/generators/ai/one-star-review-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { ModelTier } from '@/types/content-generator';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';

// Mock createAIProvider function
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn(() =>
    createMockAIProvider({
      response: {
        text: '1 STAR\nGRAVITY DISAPPOINTS\nCONSTANT DOWNWARD PULL\nNO OFF SWITCH\nWOULD NOT RECOMMEND',
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
    mood: 'grumpy',
    energyLevel: 'low',
    humorStyle: 'dry',
    obsession: 'complaints',
  })),
}));

describe('OneStarReviewGenerator', () => {
  let generator: OneStarReviewGenerator;
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

    generator = new OneStarReviewGenerator(mockPromptLoader, mockModelTierSelector, {
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

    it('should use one-star-review.txt as user prompt', () => {
      const userPromptFile = (
        generator as unknown as { getUserPromptFile: () => string }
      ).getUserPromptFile();
      expect(userPromptFile).toBe('one-star-review.txt');
    });
  });

  describe('REVIEW_SUBJECTS dictionary', () => {
    it('should have multiple subject categories', () => {
      const categories = Object.keys(REVIEW_SUBJECTS);
      expect(categories.length).toBeGreaterThanOrEqual(7);
      expect(categories).toContain('COSMIC');
      expect(categories).toContain('NATURAL');
      expect(categories).toContain('TEMPORAL');
      expect(categories).toContain('SOCIAL');
      expect(categories).toContain('MODERN');
      expect(categories).toContain('PHYSICAL');
      expect(categories).toContain('EXPECTATIONS');
    });

    it('should have subjects in each category', () => {
      for (const category of Object.keys(REVIEW_SUBJECTS)) {
        const subjects = REVIEW_SUBJECTS[category as keyof typeof REVIEW_SUBJECTS];
        expect(subjects.length).toBeGreaterThan(0);
      }
    });

    it('should have universally relatable subjects', () => {
      expect(REVIEW_SUBJECTS.COSMIC).toContain('existence');
      expect(REVIEW_SUBJECTS.NATURAL).toContain('gravity');
      expect(REVIEW_SUBJECTS.TEMPORAL).toContain('Mondays');
    });

    it('should be accessible via static property', () => {
      expect(OneStarReviewGenerator.REVIEW_SUBJECTS).toBe(REVIEW_SUBJECTS);
    });
  });

  describe('REVIEW_STYLES dictionary', () => {
    it('should have multiple review styles', () => {
      expect(REVIEW_STYLES.length).toBeGreaterThanOrEqual(7);
    });

    it('should include all defined styles', () => {
      expect(REVIEW_STYLES).toContain('VENTING');
      expect(REVIEW_STYLES).toContain('SATIRIC');
      expect(REVIEW_STYLES).toContain('ACADEMIC');
      expect(REVIEW_STYLES).toContain('MAD_AT_MANAGEMENT');
      expect(REVIEW_STYLES).toContain('ENTITLED_CUSTOMER');
      expect(REVIEW_STYLES).toContain('DISAPPOINTED_EXPECTATIONS');
      expect(REVIEW_STYLES).toContain('WOULD_NOT_RECOMMEND');
    });

    it('should be accessible via static property', () => {
      expect(OneStarReviewGenerator.REVIEW_STYLES).toBe(REVIEW_STYLES);
    });
  });

  describe('STYLE_GUIDANCE dictionary', () => {
    it('should have guidance for each style', () => {
      for (const style of REVIEW_STYLES) {
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
      expect(OneStarReviewGenerator.STYLE_GUIDANCE).toBe(STYLE_GUIDANCE);
    });
  });

  describe('selectRandomSubject', () => {
    it('should return a valid category and subject', () => {
      const { category, subject } = generator.selectRandomSubject();

      expect(Object.keys(REVIEW_SUBJECTS)).toContain(category);
      const categorySubjects = REVIEW_SUBJECTS[category as keyof typeof REVIEW_SUBJECTS];
      expect(categorySubjects).toContain(subject);
    });

    it('should produce varied results over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const { subject } = generator.selectRandomSubject();
        results.add(subject);
      }
      // With 50+ subjects and 50 tries, should get reasonable variety
      expect(results.size).toBeGreaterThan(5);
    });
  });

  describe('selectRandomStyle', () => {
    it('should return a valid review style', () => {
      const style = generator.selectRandomStyle();
      expect(REVIEW_STYLES).toContain(style);
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

      expect(result.text).toContain('1 STAR');
      expect(result.outputMode).toBe('text');
    });

    it('should include selection choices in metadata', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      const result = await generator.generate(context);

      expect(result.metadata).toHaveProperty('category');
      expect(result.metadata).toHaveProperty('subject');
      expect(result.metadata).toHaveProperty('style');

      // Verify metadata contains valid selections
      const { category, subject, style } = result.metadata as {
        category: string;
        subject: string;
        style: string;
      };

      expect(Object.keys(REVIEW_SUBJECTS)).toContain(category);
      expect(REVIEW_STYLES).toContain(style);

      // Subject should be from the selected category
      const categorySubjects = REVIEW_SUBJECTS[category as keyof typeof REVIEW_SUBJECTS];
      expect(categorySubjects).toContain(subject);
    });

    it('should inject template variables for subject, style, and guidance', async () => {
      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      // Check that loadPromptWithVariables was called with template variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'one-star-review.txt',
        expect.objectContaining({
          reviewSubject: expect.any(String),
          reviewStyle: expect.any(String),
          styleGuidance: expect.any(String),
        })
      );
    });

    it('should inject correct style guidance based on selected style', async () => {
      // Mock selectRandomStyle to return a specific style
      jest.spyOn(generator, 'selectRandomStyle').mockReturnValue('VENTING');

      const context = {
        timestamp: new Date(),
        updateType: 'major' as const,
      };

      await generator.generate(context);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'one-star-review.txt',
        expect.objectContaining({
          styleGuidance: STYLE_GUIDANCE.VENTING,
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
