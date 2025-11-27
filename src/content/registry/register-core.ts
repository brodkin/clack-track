/**
 * Core Content Registration Module
 *
 * Provides the registerCoreContent function to register all built-in
 * P2/P3 content generators with the ContentRegistry.
 *
 * @module content/registry/register-core
 */

import type { ContentGenerator } from '../../types/content-generator.js';
import { ContentPriority, ModelTier } from '../../types/content-generator.js';
import { ContentRegistry } from './content-registry.js';

/**
 * Interface defining the core generator instances to be registered.
 *
 * Includes all required P2 generators and the required P3 fallback,
 * plus an optional asciiArt generator.
 *
 * @interface CoreGenerators
 * @property {ContentGenerator} motivational - Motivational quote generator (P2, LIGHT)
 * @property {ContentGenerator} globalNews - Global news generator (P2, MEDIUM)
 * @property {ContentGenerator} techNews - Tech news generator (P2, MEDIUM)
 * @property {ContentGenerator} localNews - Local news generator (P2, MEDIUM)
 * @property {ContentGenerator} weather - Weather focus generator (P2, LIGHT)
 * @property {ContentGenerator} greeting - Greeting generator (P2, LIGHT, programmatic)
 * @property {ContentGenerator} [asciiArt] - Optional ASCII art generator (P2, LIGHT)
 * @property {ContentGenerator} staticFallback - Static fallback generator (P3, LIGHT)
 *
 * @example
 * ```typescript
 * const coreGenerators: CoreGenerators = {
 *   motivational: new MotivationalQuoteGenerator(),
 *   globalNews: new GlobalNewsGenerator(),
 *   techNews: new TechNewsGenerator(),
 *   localNews: new LocalNewsGenerator(),
 *   weather: new WeatherFocusGenerator(),
 *   greeting: new GreetingGenerator(),
 *   asciiArt: new AsciiArtGenerator(), // Optional
 *   staticFallback: new StaticFallbackGenerator()
 * };
 * ```
 */
export interface CoreGenerators {
  /** Motivational quote generator (P2, LIGHT, AI-powered) */
  motivational: ContentGenerator;
  /** Global news generator (P2, MEDIUM, AI-powered) */
  globalNews: ContentGenerator;
  /** Tech news generator (P2, MEDIUM, AI-powered) */
  techNews: ContentGenerator;
  /** Local news generator (P2, MEDIUM, AI-powered) */
  localNews: ContentGenerator;
  /** Weather focus generator (P2, LIGHT, AI-powered) */
  weather: ContentGenerator;
  /** Greeting generator (P2, LIGHT, programmatic) */
  greeting: ContentGenerator;
  /** Optional ASCII art generator (P2, LIGHT, programmatic) */
  asciiArt?: ContentGenerator;
  /** Static fallback generator (P3, LIGHT, no AI) */
  staticFallback: ContentGenerator;
}

/**
 * Register all built-in core content generators with the registry.
 *
 * Registers the following generators:
 * - **P2 Generators (NORMAL priority)**:
 *   - motivational-quote: Motivational quotes (LIGHT, AI)
 *   - global-news: Global news summaries (MEDIUM, AI)
 *   - tech-news: Tech news summaries (MEDIUM, AI)
 *   - local-news: Local news summaries (MEDIUM, AI)
 *   - weather-focus: Weather updates (LIGHT, AI)
 *   - greeting: Personalized greetings (LIGHT, programmatic)
 *   - ascii-art: ASCII art (LIGHT, programmatic, optional)
 * - **P3 Generator (FALLBACK priority)**:
 *   - static-fallback: Static message when AI fails (LIGHT)
 *
 * All generators have `applyFrame: true` to include time/weather frame.
 *
 * @param {ContentRegistry} registry - The registry to register generators with
 * @param {CoreGenerators} generators - The core generator instances
 *
 * @example
 * ```typescript
 * import { ContentRegistry } from './content-registry.js';
 * import { registerCoreContent } from './register-core.js';
 * import { createCoreGenerators } from '../generators/index.js';
 *
 * const registry = ContentRegistry.getInstance();
 * const generators = createCoreGenerators();
 * registerCoreContent(registry, generators);
 *
 * // Registry now has all core generators registered
 * const allGens = registry.getAll();
 * console.log(`Registered ${allGens.length} core generators`);
 * ```
 */
export function registerCoreContent(registry: ContentRegistry, generators: CoreGenerators): void {
  // Register P2 generators (NORMAL priority)
  registry.register(
    {
      id: 'motivational-quote',
      name: 'Motivational Quote Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.motivational
  );

  // Register three news generators (all at P2 for equal selection)
  registry.register(
    {
      id: 'global-news',
      name: 'Global News',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.globalNews
  );

  registry.register(
    {
      id: 'tech-news',
      name: 'Tech News',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.techNews
  );

  registry.register(
    {
      id: 'local-news',
      name: 'Local News',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.localNews
  );

  registry.register(
    {
      id: 'weather-focus',
      name: 'Weather Focus Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.weather
  );

  registry.register(
    {
      id: 'greeting',
      name: 'Greeting Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.greeting
  );

  // Register optional asciiArt generator if provided
  if (generators.asciiArt) {
    registry.register(
      {
        id: 'ascii-art',
        name: 'ASCII Art Generator',
        priority: ContentPriority.NORMAL,
        modelTier: ModelTier.LIGHT,
        applyFrame: true,
      },
      generators.asciiArt
    );
  }

  // Register P3 fallback generator (FALLBACK priority)
  registry.register(
    {
      id: 'static-fallback',
      name: 'Static Fallback Generator',
      priority: ContentPriority.FALLBACK,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.staticFallback
  );
}
