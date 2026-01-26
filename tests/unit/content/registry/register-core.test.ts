/**
 * Unit Tests for registerCoreContent Function
 *
 * Tests the registration of all built-in P2/P3 content generators.
 *
 * @module tests/unit/content/registry/register-core
 */

import { registerCoreContent } from '../../../../src/content/registry/register-core.js';
import { ContentRegistry } from '../../../../src/content/registry/content-registry.js';
import {
  ContentPriority,
  ModelTier,
  type ContentGenerator,
  type GenerationContext,
  type GeneratedContent,
  type GeneratorValidationResult,
} from '../../../../src/types/content-generator.js';

describe('registerCoreContent', () => {
  let registry: ContentRegistry;

  // Mock generator factory
  const createMockGenerator = (name: string): ContentGenerator => ({
    async generate(_context: GenerationContext): Promise<GeneratedContent> {
      return {
        text: `Mock content from ${name}`,
        outputMode: 'text',
      };
    },
    validate(): GeneratorValidationResult {
      return { valid: true };
    },
  });

  beforeEach(() => {
    ContentRegistry.reset();
    registry = ContentRegistry.getInstance();
  });

  afterEach(() => {
    ContentRegistry.reset();
  });

  // Helper to create a full set of core generators
  const createFullGenerators = () => ({
    globalNews: createMockGenerator('globalNews'),
    techNews: createMockGenerator('techNews'),
    localNews: createMockGenerator('localNews'),
    weather: createMockGenerator('weather'),
    haiku: createMockGenerator('haiku'),
    seasonal: createMockGenerator('seasonal'),
    pattern: createMockGenerator('pattern'),
    showerThought: createMockGenerator('showerThought'),
    fortuneCookie: createMockGenerator('fortuneCookie'),
    dailyRoast: createMockGenerator('dailyRoast'),
    serialStory: createMockGenerator('serialStory'),
    timePerspective: createMockGenerator('timePerspective'),
    hotTake: createMockGenerator('hotTake'),
    novelInsight: createMockGenerator('novelInsight'),
    languageLesson: createMockGenerator('languageLesson'),
    alienFieldReport: createMockGenerator('alienFieldReport'),
    happyToSeeMe: createMockGenerator('happyToSeeMe'),
    yoMomma: createMockGenerator('yoMomma'),
    issObserver: createMockGenerator('issObserver'),
    oneStarReview: createMockGenerator('oneStarReview'),
    staticFallback: createMockGenerator('fallback'),
  });

  describe('P2 Generator Registration', () => {
    it('should register weather generator with correct metadata', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const registered = registry.getById('weather-focus');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('weather-focus');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.LIGHT);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.weather);
    });

    it('should register all P2 generators with NORMAL priority', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const normalPriorityGens = registry.getByPriority(ContentPriority.NORMAL);
      // globalNews, techNews, localNews, weather, haiku, seasonal, pattern,
      // showerThought, fortuneCookie, dailyRoast, serialStory, timePerspective,
      // hotTake, novelInsight, languageLesson, alienFieldReport, happyToSeeMe, yoMomma, issObserver, oneStarReview = 20
      expect(normalPriorityGens.length).toBe(20);
    });
  });

  describe('P3 Fallback Registration', () => {
    it('should register static fallback with correct metadata', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const registered = registry.getById('static-fallback');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('static-fallback');
      expect(registered?.registration.priority).toBe(ContentPriority.FALLBACK);
      expect(registered?.registration.modelTier).toBe(ModelTier.LIGHT);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.staticFallback);
    });

    it('should register only one fallback generator', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const fallbackGens = registry.getByPriority(ContentPriority.FALLBACK);
      expect(fallbackGens.length).toBe(1);
    });
  });

  describe('Complete Registration', () => {
    it('should register all core generators', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const allGenerators = registry.getAll();
      // 20 P2 + 1 P3 = 21 total
      expect(allGenerators.length).toBe(21);
    });

    it('should maintain correct priority distribution', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const normalGens = registry.getByPriority(ContentPriority.NORMAL);
      const fallbackGens = registry.getByPriority(ContentPriority.FALLBACK);
      const notificationGens = registry.getByPriority(ContentPriority.NOTIFICATION);

      // 20 P2 generators: globalNews, techNews, localNews, weather, haiku,
      // seasonal, pattern, showerThought, fortuneCookie, dailyRoast, serialStory,
      // timePerspective, hotTake, novelInsight, languageLesson, alienFieldReport, happyToSeeMe, yoMomma, issObserver, oneStarReview
      expect(normalGens.length).toBe(20);
      expect(fallbackGens.length).toBe(1);
      expect(notificationGens.length).toBe(0);
    });

    it('should not throw when called with valid generators', () => {
      const generators = createFullGenerators();

      expect(() => registerCoreContent(registry, generators)).not.toThrow();
    });
  });

  describe('New News Generators (Global, Tech, Local)', () => {
    it('should register global-news generator with correct metadata', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const registered = registry.getById('global-news');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('global-news');
      expect(registered?.registration.name).toBe('Global News');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.MEDIUM);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.globalNews);
    });

    it('should register tech-news generator with correct metadata', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const registered = registry.getById('tech-news');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('tech-news');
      expect(registered?.registration.name).toBe('Tech News');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.MEDIUM);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.techNews);
    });

    it('should register local-news generator with correct metadata', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const registered = registry.getById('local-news');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('local-news');
      expect(registered?.registration.name).toBe('Local News');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.MEDIUM);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.localNews);
    });

    it('should register all three news generators at P2 priority', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const normalPriorityGens = registry.getByPriority(ContentPriority.NORMAL);
      // All 20 P2 generators including 3 news generators
      expect(normalPriorityGens.length).toBe(20);
    });

    it('should not register old news-summary generator', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const oldNewsGen = registry.getById('news-summary');
      expect(oldNewsGen).toBeUndefined();
    });

    it('should give equal selection probability to all three news generators', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const allP2Gens = registry.getByPriority(ContentPriority.NORMAL);
      const newsGens = allP2Gens.filter(gen =>
        ['global-news', 'tech-news', 'local-news'].includes(gen.registration.id)
      );

      // All three news generators should exist at equal priority
      expect(newsGens.length).toBe(3);
      expect(newsGens.every(gen => gen.registration.priority === ContentPriority.NORMAL)).toBe(
        true
      );
    });
  });

  describe('Novel Insight Generator', () => {
    it('should register novel-insight generator with correct metadata', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const registered = registry.getById('novel-insight');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('novel-insight');
      expect(registered?.registration.name).toBe('Novel Insight Generator');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.MEDIUM);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.novelInsight);
    });
  });

  describe('Language Lesson Generator', () => {
    it('should register language-lesson generator with correct metadata', () => {
      const generators = createFullGenerators();

      registerCoreContent(registry, generators);

      const registered = registry.getById('language-lesson');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('language-lesson');
      expect(registered?.registration.name).toBe('Language Lesson Generator');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.LIGHT);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.languageLesson);
    });
  });
});
