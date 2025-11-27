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
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
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

    it('should register news generator with correct metadata', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const registered = registry.getById('news-summary');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('news-summary');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.MEDIUM);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.news);
    });

    it('should register weather generator with correct metadata', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
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

    it('should register greeting generator with correct metadata', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const registered = registry.getById('greeting');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('greeting');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.LIGHT);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.greeting);
    });

    it('should register all P2 generators with NORMAL priority', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const normalPriorityGens = registry.getByPriority(ContentPriority.NORMAL);
      expect(normalPriorityGens.length).toBe(4); // motivational, news, weather, greeting
    });
  });

  describe('P3 Fallback Registration', () => {
    it('should register static fallback with correct metadata', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
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
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const fallbackGens = registry.getByPriority(ContentPriority.FALLBACK);
      expect(fallbackGens.length).toBe(1);
    });
  });

  describe('Optional asciiArt Generator', () => {
    it('should register asciiArt when provided', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        asciiArt: createMockGenerator('asciiArt'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const registered = registry.getById('ascii-art');
      expect(registered).toBeDefined();
      expect(registered?.registration.id).toBe('ascii-art');
      expect(registered?.registration.priority).toBe(ContentPriority.NORMAL);
      expect(registered?.registration.modelTier).toBe(ModelTier.LIGHT);
      expect(registered?.registration.applyFrame).toBe(true);
      expect(registered?.generator).toBe(generators.asciiArt);
    });

    it('should work without asciiArt generator', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const registered = registry.getById('ascii-art');
      expect(registered).toBeUndefined();

      // Should still register 4 P2 generators
      const normalPriorityGens = registry.getByPriority(ContentPriority.NORMAL);
      expect(normalPriorityGens.length).toBe(4);
    });

    it('should register 5 P2 generators when asciiArt is provided', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        asciiArt: createMockGenerator('asciiArt'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const normalPriorityGens = registry.getByPriority(ContentPriority.NORMAL);
      expect(normalPriorityGens.length).toBe(5); // motivational, news, weather, greeting, asciiArt
    });
  });

  describe('Complete Registration', () => {
    it('should register all core generators', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        asciiArt: createMockGenerator('asciiArt'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const allGenerators = registry.getAll();
      expect(allGenerators.length).toBe(6); // 5 P2 + 1 P3
    });

    it('should maintain correct priority distribution', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        asciiArt: createMockGenerator('asciiArt'),
        staticFallback: createMockGenerator('fallback'),
      };

      registerCoreContent(registry, generators);

      const normalGens = registry.getByPriority(ContentPriority.NORMAL);
      const fallbackGens = registry.getByPriority(ContentPriority.FALLBACK);
      const notificationGens = registry.getByPriority(ContentPriority.NOTIFICATION);

      expect(normalGens.length).toBe(5);
      expect(fallbackGens.length).toBe(1);
      expect(notificationGens.length).toBe(0);
    });

    it('should not throw when called with valid generators', () => {
      const generators = {
        motivational: createMockGenerator('motivational'),
        news: createMockGenerator('news'),
        weather: createMockGenerator('weather'),
        greeting: createMockGenerator('greeting'),
        staticFallback: createMockGenerator('fallback'),
      };

      expect(() => registerCoreContent(registry, generators)).not.toThrow();
    });
  });
});
