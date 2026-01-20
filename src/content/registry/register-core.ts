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
 * Includes all required P2 generators and the required P3 fallback.
 *
 * @interface CoreGenerators
 * @property {ContentGenerator} globalNews - Global news generator (P2, MEDIUM)
 * @property {ContentGenerator} techNews - Tech news generator (P2, MEDIUM)
 * @property {ContentGenerator} localNews - Local news generator (P2, MEDIUM)
 * @property {ContentGenerator} weather - Weather focus generator (P2, LIGHT)
 * @property {ContentGenerator} staticFallback - Static fallback generator (P3, LIGHT)
 * @property {ContentGenerator} showerThought - Shower thought generator (P2, LIGHT)
 * @property {ContentGenerator} fortuneCookie - Fortune cookie generator (P2, LIGHT)
 * @property {ContentGenerator} dailyRoast - Daily roast generator (P2, MEDIUM)
 * @property {ContentGenerator} hotTake - Hot take generator (P2, LIGHT)
 * @property {ContentGenerator} compliment - Compliment generator (P2, LIGHT)
 * @property {ContentGenerator} novelInsight - Novel insight generator (P2, MEDIUM)
 *
 * @example
 * ```typescript
 * const coreGenerators: CoreGenerators = {
 *   globalNews: new GlobalNewsGenerator(),
 *   techNews: new TechNewsGenerator(),
 *   localNews: new LocalNewsGenerator(),
 *   weather: new WeatherFocusGenerator(),
 *   haiku: new HaikuGenerator(),
 *   seasonal: new SeasonalGenerator(),
 *   pattern: new PatternGenerator(),
 *   showerThought: new ShowerThoughtGenerator(),
 *   fortuneCookie: new FortuneCookieGenerator(),
 *   dailyRoast: new DailyRoastGenerator(),
 *   hotTake: new HotTakeGenerator(),
 *   compliment: new ComplimentGenerator(),
 *   novelInsight: new NovelInsightGenerator(),
 *   staticFallback: new StaticFallbackGenerator()
 * };
 * ```
 */
export interface CoreGenerators {
  /** Global news generator (P2, MEDIUM, AI-powered) */
  globalNews: ContentGenerator;
  /** Tech news generator (P2, MEDIUM, AI-powered) */
  techNews: ContentGenerator;
  /** Local news generator (P2, MEDIUM, AI-powered) */
  localNews: ContentGenerator;
  /** Weather focus generator (P2, LIGHT, AI-powered) */
  weather: ContentGenerator;
  /** Haiku generator (P2, LIGHT, AI-powered) */
  haiku: ContentGenerator;
  /** Seasonal generator (P2, LIGHT, AI-powered) */
  seasonal: ContentGenerator;
  /** Mathematical pattern generator (P2, LIGHT, programmatic) */
  pattern: ContentGenerator;
  /** Shower thought generator (P2, LIGHT, AI-powered) */
  showerThought: ContentGenerator;
  /** Fortune cookie generator (P2, LIGHT, AI-powered) */
  fortuneCookie: ContentGenerator;
  /** Daily roast generator (P2, MEDIUM, AI-powered) */
  dailyRoast: ContentGenerator;
  /** Story fragment generator (P2, MEDIUM, AI-powered) */
  storyFragment: ContentGenerator;
  /** Time perspective generator (P2, MEDIUM, AI-powered) */
  timePerspective: ContentGenerator;
  /** Hot take generator (P2, LIGHT, AI-powered) */
  hotTake: ContentGenerator;
  /** Compliment generator (P2, LIGHT, AI-powered) */
  compliment: ContentGenerator;
  /** Novel insight generator (P2, MEDIUM, AI-powered) */
  novelInsight: ContentGenerator;
  /** Static fallback generator (P3, LIGHT, no AI) */
  staticFallback: ContentGenerator;
}

/**
 * Register all built-in core content generators with the registry.
 *
 * Registers the following generators:
 * - **P2 Generators (NORMAL priority)**:
 *   - global-news: Global news summaries (MEDIUM, AI)
 *   - tech-news: Tech news summaries (MEDIUM, AI)
 *   - local-news: Local news summaries (MEDIUM, AI)
 *   - weather-focus: Weather updates (LIGHT, AI)
 *   - haiku: Haiku poems (LIGHT, AI)
 *   - seasonal: Seasonal content (LIGHT, AI)
 *   - pattern-art: Mathematical patterns (LIGHT, programmatic)
 *   - shower-thought: Philosophical musings (LIGHT, AI)
 *   - fortune-cookie: Twisted wisdom (LIGHT, AI)
 *   - hot-take: Playful opinions (LIGHT, AI)
 *   - compliment: Uplifting affirmations (LIGHT, AI)
 *   - novel-insight: Fresh perspectives (MEDIUM, AI)
 * - **P3 Generator (FALLBACK priority)**:
 *   - static-fallback: Static message when AI fails (LIGHT)
 *
 * Most generators have `applyFrame: true` to include time/weather frame.
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
      id: 'haiku',
      name: 'Haiku Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.haiku
  );

  registry.register(
    {
      id: 'seasonal',
      name: 'Seasonal Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.seasonal
  );

  registry.register(
    {
      id: 'pattern-art',
      name: 'Mathematical Pattern Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: false,
      useToolBasedGeneration: false, // Programmatic generator - no AI prompts
    },
    generators.pattern
  );

  registry.register(
    {
      id: 'shower-thought',
      name: 'Shower Thought Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.showerThought
  );

  registry.register(
    {
      id: 'fortune-cookie',
      name: 'Fortune Cookie Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
      formatOptions: {
        textAlign: 'center',
        maxLines: 4,
      },
    },
    generators.fortuneCookie
  );

  registry.register(
    {
      id: 'daily-roast',
      name: 'Daily Roast Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.dailyRoast
  );

  registry.register(
    {
      id: 'story-fragment',
      name: 'Story Fragment Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.storyFragment
  );

  registry.register(
    {
      id: 'time-perspective',
      name: 'Time Perspective Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.timePerspective
  );

  registry.register(
    {
      id: 'hot-take',
      name: 'Hot Take Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.hotTake
  );

  registry.register(
    {
      id: 'compliment',
      name: 'Compliment Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.compliment
  );

  registry.register(
    {
      id: 'novel-insight',
      name: 'Novel Insight Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.novelInsight
  );

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
