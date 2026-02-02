/**
 * Tour Guide Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * absurd tour guide narrations of everyday life situations.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/tour-guide.txt for tour guide content guidance
 * - Uses LIGHT model tier (comedic creativity, no complex reasoning)
 * - Injects random location and comedic angle into prompts
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects location and angle
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * VOICE:
 * Always opens with a tour guide trope ("ON YOUR LEFT...", "IF YOU LOOK UP...", etc.)
 * and narrates mundane everyday scenes with breathless enthusiasm and escalating absurdity.
 * The LLM chooses its own opener naturally from the tour guide voice.
 *
 * @example
 * ```typescript
 * const generator = new TourGuideGenerator(
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
 * console.log(content.text);
 * // "ON YOUR LEFT YOU WILL\nSEE THE FRIDGE WHERE\nLEFTOVERS GO TO BE\nFORGOTTEN THEN FOUND\nWEEKS LATER EVOLVED"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Everyday locations that become "tour stops"
 *
 * Mundane locations treated as exotic destinations worthy of
 * guided narration. The humor comes from the contrast.
 */
export const LOCATIONS = {
  HOME: [
    'kitchen',
    'bathroom',
    'junk drawer',
    'garage',
    'laundry room',
    'couch',
    'bedroom closet',
    'fridge',
    'pantry',
    'front porch',
    'shower',
    'nightstand drawer',
    'under the bed',
    'hallway',
    'medicine cabinet',
  ],
  WORK: [
    'office',
    'break room',
    'meeting room',
    'parking lot',
    'elevator',
    'cubicle',
    'supply closet',
    'conference call',
    'shared kitchen',
    'printer room',
    'lobby',
    'stairwell',
    'open floor plan',
    'corner desk',
  ],
  PUBLIC: [
    'supermarket',
    'waiting room',
    'coffee shop',
    'gym',
    'laundromat',
    'bus stop',
    'pharmacy line',
    'airport gate',
    'DMV',
    'dentist lobby',
    'gas station',
    'drive-thru',
    'parking garage',
    'sidewalk',
    'public restroom',
    'hotel lobby',
  ],
  DIGITAL: [
    'email inbox',
    'group chat',
    'video call',
    'browser tabs',
    'app notifications',
    'spam folder',
    'downloads folder',
    'dating app',
    'search history',
    'camera roll',
    'voicemail',
    'password reset page',
    'wifi settings',
    'cloud storage',
  ],
  SOCIAL: [
    'dinner party',
    'house party',
    'first date',
    'family reunion',
    'brunch',
    'happy hour',
    'housewarming',
    'double date',
    'game night',
    'potluck',
    'the group hang',
    'after-party',
  ],
} as const;

/**
 * Comedic angles for narrating the mundane
 *
 * Each angle provides a different lens through which to view
 * the everyday location. Includes both observational angles
 * and deeply personal houseboy-narrator angles.
 */
export const ANGLES = [
  'WILDLIFE',
  'HISTORICAL',
  'DANGER ZONE',
  'EXHIBIT',
  'HAUNTED',
  'CRIME SCENE',
  'REAL ESTATE LISTING',
  'DEVASTATING MEMORIES',
  'CONFESSIONAL',
  'FIVE STAR REVIEW',
] as const;

export type LocationDomain = keyof typeof LOCATIONS;
export type Angle = (typeof ANGLES)[number];

/**
 * Generates tour guide narrations of everyday life
 *
 * Extends AIPromptGenerator with tour-guide-specific prompts,
 * LIGHT model tier for quick creative generation, and
 * random location/angle injection for variety.
 * The LLM naturally chooses its own tour guide opener.
 */
export class TourGuideGenerator extends AIPromptGenerator {
  /**
   * Static access to locations for testing
   */
  static readonly LOCATIONS = LOCATIONS;

  /**
   * Static access to angles for testing
   */
  static readonly ANGLES = ANGLES;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedLocation: string = '';
  private selectedLocationDomain: string = '';
  private selectedAngle: string = '';

  /**
   * Creates a new TourGuideGenerator instance
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
   * Uses the tour-guide prompt which specifies the content type,
   * structure, and voice for absurd everyday life narration.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'tour-guide.txt';
  }

  /**
   * Selects a random location domain and specific location within it
   *
   * @returns Object containing the selected locationDomain and location
   */
  selectRandomLocation(): { locationDomain: string; location: string } {
    const domainKeys = Object.keys(LOCATIONS) as LocationDomain[];
    const randomDomain = domainKeys[Math.floor(Math.random() * domainKeys.length)];
    const locations = LOCATIONS[randomDomain];
    const randomLocation = locations[Math.floor(Math.random() * locations.length)];

    return {
      locationDomain: randomDomain,
      location: randomLocation,
    };
  }

  /**
   * Selects a random comedic angle
   *
   * @returns The selected angle
   */
  selectRandomAngle(): string {
    return ANGLES[Math.floor(Math.random() * ANGLES.length)];
  }

  /**
   * Hook: Selects random location and angle, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with location and angle
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const { locationDomain, location } = this.selectRandomLocation();
    const angle = this.selectRandomAngle();

    // Cache for metadata
    this.selectedLocationDomain = locationDomain;
    this.selectedLocation = location;
    this.selectedAngle = angle;

    return { location, angle };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with locationDomain, location, and angle
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      locationDomain: this.selectedLocationDomain,
      location: this.selectedLocation,
      angle: this.selectedAngle,
    };
  }
}
