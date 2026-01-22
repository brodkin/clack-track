/**
 * Happy To See Me Generator
 *
 * Concrete implementation of AIPromptGenerator for generating playful
 * innuendo-style jokes riffing on the classic "Is that a X in your Y
 * or are you just Z to see me?" format.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/happy-to-see-me.txt for joke format guidance
 * - Uses LIGHT model tier for cost efficiency
 * - Injects thematic vibes (not literal items) to inspire cohesive comedy
 * - Inherits retry logic and provider failover from base class
 *
 * DESIGN PHILOSOPHY:
 * The dictionaries provide INSPIRATION, not literal requirements.
 * The AI should create its own specific, cohesive combinations that
 * capture the SPIRIT of the vibes. This allows for absurd humor that
 * makes internal sense - the key to landing the joke.
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects thingVibe, locationVibe, emotionVibe
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Format: Flirty, playful quips with internally consistent absurdity
 *
 * @example
 * ```typescript
 * const generator = new HappyToSeeMeGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date().toISOString(),
 *   timezone: 'America/New_York'
 * });
 *
 * console.log(content.text); // "IS THAT A VINTAGE\nCASIO IN YOUR..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Thematic vibes for things/objects
 *
 * These are creative springboards, not literal requirements.
 * The AI should invent its own specific items inspired by these themes.
 */
export const THING_VIBES = [
  'retro tech nostalgia',
  'artisanal food culture',
  'wellness obsession',
  'hipster accessories',
  'suburban dad energy',
  'millennial anxiety objects',
  'gen-z chaos items',
  'cottagecore aesthetics',
  'corporate wellness',
  'vinyl collector vibes',
  'plant parent energy',
  'sourdough era relics',
  'crossfit culture',
  'true crime podcast gear',
  'astrology girl items',
  'crypto bro accessories',
  'minimalist essentials',
  'maximalist treasures',
  'thrift store finds',
  'farmers market hauls',
] as const;

/**
 * Thematic vibes for locations/containers
 *
 * These inspire unexpected places where things might be found.
 * The AI should invent specific, surprising containers.
 */
export const LOCATION_VIBES = [
  'domestic hiding spots',
  'travel storage chaos',
  'office desk archaeology',
  'car organization disasters',
  'pocket ecosystems',
  'bag dimension portals',
  'kitchen junk drawers',
  'bathroom cabinet secrets',
  'garage treasure zones',
  'closet archaeology',
  'nightstand mysteries',
  'coat pocket universes',
  'gym bag ecosystems',
  'diaper bag dimensions',
  'purse black holes',
  'backpack time capsules',
  'glove box graveyards',
  'freezer archaeology',
  'attic discoveries',
  'basement kingdoms',
] as const;

/**
 * Thematic vibes for emotional states
 *
 * These inspire the punchline emotion - should be adjectives
 * that aren't really emotions but capture a feeling/aesthetic.
 */
export const EMOTION_VIBES = [
  'caffeinated energy',
  'fermented patience',
  'organized chaos',
  'nostalgic yearning',
  'sustainable guilt',
  'curated authenticity',
  'optimized efficiency',
  'aligned chakras',
  'grounded presence',
  'vintage coolness',
  'artisanal sincerity',
  'organic enthusiasm',
  'minimalist joy',
  'maximalist delight',
  'ergonomic comfort',
  'hydrated clarity',
  'manifested abundance',
  'aesthetic satisfaction',
  'cozy contentment',
  'chaotic neutral',
] as const;

export type ThingVibe = (typeof THING_VIBES)[number];
export type LocationVibe = (typeof LOCATION_VIBES)[number];
export type EmotionVibe = (typeof EMOTION_VIBES)[number];

/**
 * Generates playful innuendo-style jokes with thematically cohesive elements
 *
 * Extends AIPromptGenerator with happy-to-see-me-specific prompts,
 * LIGHT model tier selection for cost efficiency, and
 * thematic vibe injection that INSPIRES (not dictates) the output.
 */
export class HappyToSeeMeGenerator extends AIPromptGenerator {
  /**
   * Static access to thing vibes for testing
   */
  static readonly THING_VIBES = THING_VIBES;

  /**
   * Static access to location vibes for testing
   */
  static readonly LOCATION_VIBES = LOCATION_VIBES;

  /**
   * Static access to emotion vibes for testing
   */
  static readonly EMOTION_VIBES = EMOTION_VIBES;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedThingVibe: string = '';
  private selectedLocationVibe: string = '';
  private selectedEmotionVibe: string = '';

  /**
   * Creates a new HappyToSeeMeGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    // Use LIGHT tier for happy-to-see-me jokes (cost efficiency)
    super(promptLoader, modelTierSelector, ModelTierEnum.LIGHT, apiKeys);
  }

  /**
   * Returns the filename for the system prompt
   *
   * Uses the major update base prompt which provides general
   * Vestaboard formatting constraints and creative guidelines.
   *
   * @returns Filename of the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt
   *
   * Uses the happy-to-see-me prompt which specifies the content type,
   * structure, and tone for innuendo-style jokes.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'happy-to-see-me.txt';
  }

  /**
   * Selects a random thing vibe from the dictionary
   *
   * @returns The selected vibe theme
   */
  selectRandomThingVibe(): string {
    return THING_VIBES[Math.floor(Math.random() * THING_VIBES.length)];
  }

  /**
   * Selects a random location vibe from the dictionary
   *
   * @returns The selected vibe theme
   */
  selectRandomLocationVibe(): string {
    return LOCATION_VIBES[Math.floor(Math.random() * LOCATION_VIBES.length)];
  }

  /**
   * Selects a random emotion vibe from the dictionary
   *
   * @returns The selected vibe theme
   */
  selectRandomEmotionVibe(): string {
    return EMOTION_VIBES[Math.floor(Math.random() * EMOTION_VIBES.length)];
  }

  /**
   * Hook: Selects random vibes, returns as template variables.
   *
   * These vibes INSPIRE the AI's output but don't dictate it.
   * The AI creates its own cohesive, specific combinations.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with thingVibe, locationVibe, emotionVibe
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const thingVibe = this.selectRandomThingVibe();
    const locationVibe = this.selectRandomLocationVibe();
    const emotionVibe = this.selectRandomEmotionVibe();

    // Cache for metadata
    this.selectedThingVibe = thingVibe;
    this.selectedLocationVibe = locationVibe;
    this.selectedEmotionVibe = emotionVibe;

    return {
      thingVibe,
      locationVibe,
      emotionVibe,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with thingVibe, locationVibe, and emotionVibe
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      thingVibe: this.selectedThingVibe,
      locationVibe: this.selectedLocationVibe,
      emotionVibe: this.selectedEmotionVibe,
    };
  }
}
