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
 * @property {ContentGenerator} novelInsight - Novel insight generator (P2, MEDIUM)
 * @property {ContentGenerator} languageLesson - Language lesson generator (P2, LIGHT)
 * @property {ContentGenerator} alienFieldReport - Alien field report generator (P2, LIGHT)
 * @property {ContentGenerator} issObserver - ISS observer generator (P2, LIGHT)
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
 *   novelInsight: new NovelInsightGenerator(),
 *   languageLesson: new LanguageLessonGenerator(),
 *   alienFieldReport: new AlienFieldReportGenerator(),
 *   issObserver: new ISSObserverGenerator(),
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
  /** Serial story generator (P2, MEDIUM, AI-powered) */
  serialStory: ContentGenerator;
  /** Time perspective generator (P2, MEDIUM, AI-powered) */
  timePerspective: ContentGenerator;
  /** Hot take generator (P2, LIGHT, AI-powered) */
  hotTake: ContentGenerator;
  /** Novel insight generator (P2, MEDIUM, AI-powered) */
  novelInsight: ContentGenerator;
  /** Language lesson generator (P2, LIGHT, AI-powered) */
  languageLesson: ContentGenerator;
  /** Alien field report generator (P2, LIGHT, AI-powered) */
  alienFieldReport: ContentGenerator;
  /** Happy to see me generator (P2, LIGHT, AI-powered) */
  happyToSeeMe: ContentGenerator;
  /** Yo momma generator (P2, LIGHT, AI-powered) */
  yoMomma: ContentGenerator;
  /** ISS observer generator (P2, LIGHT, AI-powered) */
  issObserver: ContentGenerator;
  /** One-star review generator (P2, LIGHT, AI-powered) */
  oneStarReview: ContentGenerator;
  /** Houseboy vent generator (P2, LIGHT, AI-powered) */
  houseboyVent: ContentGenerator;
  /** Corporate horoscope generator (P2, LIGHT, AI-powered) */
  corporateHoroscope: ContentGenerator;
  /** Wrong number voicemail generator (P2, LIGHT, AI-powered) */
  wrongNumberVoicemail: ContentGenerator;
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
 *   - novel-insight: Fresh perspectives (MEDIUM, AI)
 *   - language-lesson: Duolingo-style micro-lessons (LIGHT, AI)
 *   - alien-field-report: Alien anthropologist observations (LIGHT, AI)
 *   - iss-observer: ISS crew observation content (LIGHT, AI)
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
      // Note: Programmatic generator - isAIGenerator is undefined so no tool-based wrapping
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
      id: 'serial-story',
      name: 'Serial Story Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.serialStory
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
      id: 'novel-insight',
      name: 'Novel Insight Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.MEDIUM,
      applyFrame: true,
    },
    generators.novelInsight
  );

  registry.register(
    {
      id: 'language-lesson',
      name: 'Language Lesson Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.languageLesson
  );

  registry.register(
    {
      id: 'alien-field-report',
      name: 'Alien Field Report Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.alienFieldReport
  );

  registry.register(
    {
      id: 'happy-to-see-me',
      name: 'Happy To See Me Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.happyToSeeMe
  );

  registry.register(
    {
      id: 'yo-momma',
      name: 'Yo Momma Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.yoMomma
  );

  registry.register(
    {
      id: 'iss-observer',
      name: 'ISS Observer',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.issObserver
  );

  registry.register(
    {
      id: 'one-star-review',
      name: 'One-Star Review Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.oneStarReview
  );

  registry.register(
    {
      id: 'houseboy-vent',
      name: 'Houseboy Vent Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.houseboyVent
  );

  registry.register(
    {
      id: 'corporate-horoscope',
      name: 'Corporate Horoscope Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.corporateHoroscope
  );

  registry.register(
    {
      id: 'wrong-number-voicemail',
      name: 'Wrong Number Voicemail Generator',
      priority: ContentPriority.NORMAL,
      modelTier: ModelTier.LIGHT,
      applyFrame: true,
    },
    generators.wrongNumberVoicemail
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
