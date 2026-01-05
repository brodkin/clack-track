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

  describe('P2 Generator Registration', () => {
    it('should register motivational generator with correct metadata', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const registered = registry.getById('motivational-quote');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('motivational-quote');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.LIGHT);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.motivational);
    });

    it('should register weather generator with correct metadata', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

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
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        pattern: createMockGenerator('pattern'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const normalPriorityGens = registry.getByPriority(ContentPriority.NORMAL);
      expect(normalPriorityGens.length).toBe(8); // motivational, globalNews, techNews, localNews, weather, haiku, seasonal, pattern
    });
  });

  describe('P3 Fallback Registration', () => {
    it('should register static fallback with correct metadata', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

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
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const fallbackGens = registry.getByPriority(ContentPriority.FALLBACK);
      expect(fallbackGens.length).toBe(1);
    });
  });

  describe('Complete Registration', () => {
    it('should register all core generators', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        pattern: createMockGenerator('pattern'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const allGenerators = registry.getAll();
      expect(allGenerators.length).toBe(9); // 8 P2 + 1 P3
    });

    it('should maintain correct priority distribution', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        pattern: createMockGenerator('pattern'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const normalGens = registry.getByPriority(ContentPriority.NORMAL);
      const fallbackGens = registry.getByPriority(ContentPriority.FALLBACK);
      const notificationGens = registry.getByPriority(ContentPriority.NOTIFICATION);

      expect(normalGens.length).toBe(8);
      expect(fallbackGens.length).toBe(1);
      expect(notificationGens.length).toBe(0);
    });

    it('should not throw when called with valid generators', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

      expect(() => registerCoreContent(registry, generators)).not.toThrow();
    });
  });

  describe('New News Generators (Global, Tech, Local)', () => {
    it('should register global-news generator with correct metadata', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

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
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

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
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

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
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        pattern: createMockGenerator('pattern'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const normalPriorityGens = registry.getByPriority(ContentPriority.NORMAL);
      // motivational, globalNews, techNews, localNews, weather, haiku, seasonal, pattern = 8
      expect(normalPriorityGens.length).toBe(8);
    });

    it('should not register old news-summary generator', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const oldNewsGen = registry.getById('news-summary');
      expect(oldNewsGen).toBeUndefined();
    });

    it('should give equal selection probability to all three news generators', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        globalNews: createMockGenerator('globalNews'),
        techNews: createMockGenerator('techNews'),
        localNews: createMockGenerator('localNews'),
        weather: createMockGenerator('weather'),
        haiku: createMockGenerator('haiku'),
        seasonal: createMockGenerator('seasonal'),
        staticFallback: createMockGenerator('fallback'),
      };

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
});
