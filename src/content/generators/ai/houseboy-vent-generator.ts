/**
 * Houseboy Vent Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * dramatic Gen Z-style vents about everyday situations with
 * self-aware humor and pretty privilege callbacks.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context (Houseboy persona)
 * - Uses prompts/user/houseboy-vent.txt for vent content guidance
 * - Uses LIGHT model tier for cost efficiency
 * - Injects situation, coping energy, and drama intensity for variety
 * - Inherits retry logic and provider failover from base class
 *
 * DESIGN PHILOSOPHY:
 * The dictionaries provide INSPIRATION, not literal requirements.
 * Single words or short phrases serve as springboards - the AI decides
 * what specifically happened with "wifi" or "parking". This produces
 * more varied, creative output than prescriptive triggers.
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects situation, copingEnergy, dramaIntensity
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * @example
 * ```typescript
 * const generator = new HouseboyVentGenerator(
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
 * console.log(content.text); // "PARALLEL PARKING IN\nFRONT OF PEOPLE..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Everyday situations that become dramatic events
 *
 * These are single words or short phrases - springboards for the AI
 * to create specific, funny scenarios. The AI decides what went wrong.
 */
export const SITUATIONS = [
  // Morning routine
  'alarm',
  'snooze button',
  'shower temperature',
  'towel',
  'mirror',
  'keys',
  'wallet',
  'sunscreen',
  // Food & drink
  'ice cubes',
  'leftovers',
  'expiration date',
  'grocery store',
  'self checkout',
  'receipt',
  'oat milk',
  'cold brew',
  'avocado',
  'delivery',
  'tipping',
  // Technology
  'wifi',
  'bluetooth',
  'charger',
  'airpods',
  'notifications',
  'storage full',
  'battery',
  'updates',
  'passwords',
  'captcha',
  'terms and conditions',
  'screen time report',
  'front camera',
  'typing bubble',
  'read receipts',
  'voicemail',
  'group chat',
  'autocorrect',
  // Social
  'small talk',
  'eye contact',
  'waving back',
  'holding the door',
  'elevator',
  'how are you',
  'plans',
  'being early',
  'being late',
  'dress code',
  'RSVP',
  // Home
  'laundry',
  'folding',
  'dishes',
  'trash day',
  'mail',
  'packages',
  'junk mail',
  'neighbors',
  'thermostat',
  'smoke detector',
  'light bulb',
  'plants',
  'making the bed',
  // Transportation
  'parallel parking',
  'parking spot',
  'gas prices',
  'toll booth',
  'traffic',
  'directions',
  'stairs',
  'elevator wait',
  // Self & body
  'hair',
  'outfit',
  'posture',
  'hydration',
  'vitamins',
  'steps goal',
  'water bottle',
  'sleep schedule',
  // Environment
  'humidity',
  'wind',
  'pollen',
  'daylight savings',
  'sunglasses',
  'weather app',
  // Random everyday
  'zipper',
  'shoelaces',
  'loose thread',
  'tag itching',
  'sock sliding down',
  'static cling',
  'paper cut',
  'pen dying',
  'hangers',
  'pockets',
  'lid not fitting',
  'ice melting',
  'straw wrapper',
  // Decisions
  'outfit decision',
  'what to watch',
  'where to eat',
  'appetizers',
  'splitting the bill',
  // Misc
  'returning something',
  'coupon expired',
  'out of stock',
  'waiting',
  'standing',
  'sitting',
  'existing',
  'monday',
  'meetings',
  'email',
  'printing',
  'lunch decision',
  'commute',
  'bed too comfortable',
  'pillow temperature',
] as const;

/**
 * Coping energy - how Houseboy processes the drama
 *
 * Abstract concepts that inspire the AI's resolution/punchline.
 */
export const COPING_ENERGIES = [
  // Pretty privilege
  'pretty privilege',
  'face card',
  'bone structure',
  'genetics',
  // Gen Z energy
  'main character',
  'villain arc',
  'growth',
  'boundaries',
  'self care',
  'manifesting',
  'we move',
  'anyway',
  // Spiritual
  'astrology',
  'mercury retrograde',
  'the universe',
  'karma',
  // Self-aware
  'processing',
  'journey',
  'thoughts and prayers',
  'character development',
  'witness protection',
  'roman empire',
  'touch grass',
] as const;

/**
 * Drama intensity - scale of reaction
 *
 * Single words that set the emotional temperature.
 */
export const DRAMA_INTENSITIES = [
  // Mild
  'inconvenienced',
  'bothered',
  'stressed',
  'not ideal',
  // Medium
  'processing',
  'having a moment',
  'whole vibe affected',
  'personality at risk',
  // High
  'spiraling',
  'unwell',
  'existential',
  'villain origin',
  // Absurd
  'rock bottom',
  'awakening',
  'joker arc',
  'in my flop era',
] as const;

export type Situation = (typeof SITUATIONS)[number];
export type CopingEnergy = (typeof COPING_ENERGIES)[number];
export type DramaIntensity = (typeof DRAMA_INTENSITIES)[number];

/**
 * Generates dramatic Gen Z vents with self-aware humor
 *
 * Extends AIPromptGenerator with houseboy-vent-specific prompts,
 * LIGHT model tier selection for efficiency, and thematic
 * inspiration injection for variety.
 */
export class HouseboyVentGenerator extends AIPromptGenerator {
  /**
   * Static access to situations for testing
   */
  static readonly SITUATIONS = SITUATIONS;

  /**
   * Static access to coping energies for testing
   */
  static readonly COPING_ENERGIES = COPING_ENERGIES;

  /**
   * Static access to drama intensities for testing
   */
  static readonly DRAMA_INTENSITIES = DRAMA_INTENSITIES;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedSituation: string = '';
  private selectedCopingEnergy: string = '';
  private selectedDramaIntensity: string = '';

  /**
   * Creates a new HouseboyVentGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    // Use LIGHT tier for personality-driven creative content
    super(promptLoader, modelTierSelector, ModelTierEnum.LIGHT, apiKeys);
  }

  /**
   * Returns the filename for the system prompt
   *
   * Uses the major update base prompt which includes the Houseboy
   * persona and Vestaboard formatting constraints.
   *
   * @returns Filename of the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt
   *
   * Uses the houseboy-vent prompt which specifies Gen Z dramatic
   * venting with self-aware humor and pretty privilege callbacks.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'houseboy-vent.txt';
  }

  /**
   * Selects a random situation from the dictionary
   *
   * @returns The selected situation
   */
  selectRandomSituation(): string {
    return SITUATIONS[Math.floor(Math.random() * SITUATIONS.length)];
  }

  /**
   * Selects a random coping energy from the dictionary
   *
   * @returns The selected coping energy
   */
  selectRandomCopingEnergy(): string {
    return COPING_ENERGIES[Math.floor(Math.random() * COPING_ENERGIES.length)];
  }

  /**
   * Selects a random drama intensity from the dictionary
   *
   * @returns The selected drama intensity
   */
  selectRandomDramaIntensity(): string {
    return DRAMA_INTENSITIES[Math.floor(Math.random() * DRAMA_INTENSITIES.length)];
  }

  /**
   * Hook: Selects random inspiration vibes, returns as template variables.
   *
   * These vibes INSPIRE the AI's output but don't dictate it.
   * The AI creates its own specific, dramatic scenarios.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with situation, copingEnergy, dramaIntensity
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const situation = this.selectRandomSituation();
    const copingEnergy = this.selectRandomCopingEnergy();
    const dramaIntensity = this.selectRandomDramaIntensity();

    // Cache for metadata
    this.selectedSituation = situation;
    this.selectedCopingEnergy = copingEnergy;
    this.selectedDramaIntensity = dramaIntensity;

    return {
      situation,
      copingEnergy,
      dramaIntensity,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with situation, copingEnergy, and dramaIntensity
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      situation: this.selectedSituation,
      copingEnergy: this.selectedCopingEnergy,
      dramaIntensity: this.selectedDramaIntensity,
    };
  }
}
