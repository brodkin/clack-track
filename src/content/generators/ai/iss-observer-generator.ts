/**
 * ISS Observer Generator
 *
 * Concrete implementation of AIPromptGenerator for generating content from
 * the perspective of the International Space Station crew observing Earth.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/iss-observer.txt for ISS observation content guidance
 * - Fetches real-time ISS position, location, and crew data via ISSClient
 * - Selects random astronaut from ISS crew (filters out Tiangong)
 * - Selects random observation angle for content variety
 * - Determines location-appropriate flavor based on region
 * - Optimized with LIGHT model tier for efficiency
 * - Graceful fallback values when ISS API fails
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects ISS telemetry and observation context into prompt
 * - getCustomMetadata(): Tracks ISS data fetching status and selected values
 *
 * @example
 * ```typescript
 * const generator = new ISSObserverGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date(),
 *   updateType: 'major'
 * });
 *
 * console.log(content.text); // "ISS NOW OVER PACIFIC\nCREW OF 7 WATCHING..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import {
  ISSClient,
  type ISSPosition,
  type ISSLocation,
  type SpaceCrew,
} from '../../../api/data-sources/iss-client.js';
import {
  getRandomObservationAngle,
  getLocationFlavor,
  LOCATION_FLAVORS,
} from './iss-observer-dictionaries.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Fallback values when ISS API is unavailable
 */
const FALLBACK_VALUES = {
  latitude: '0.00',
  longitude: '0.00',
  altitude: '408',
  velocity: '27600',
  velocityMph: '17150',
  visibility: 'unknown',
  location: 'somewhere over Earth',
  crewCount: '7',
  astronaut: 'An ISS crew member',
  locationFlavor: LOCATION_FLAVORS.GENERIC_LAND,
} as const;

/**
 * Generates ISS observation content from the crew's perspective
 *
 * Extends AIPromptGenerator with ISS-specific prompts, real-time
 * ISS telemetry injection, and random observation angle selection
 * for content variety.
 */
export class ISSObserverGenerator extends AIPromptGenerator {
  private readonly issClient: ISSClient;

  /**
   * Tracks whether ISS data was successfully fetched
   */
  private issDataFetched: boolean = false;

  /**
   * ISS position data from API (null if fetch failed)
   */
  private position: ISSPosition | null = null;

  /**
   * ISS location data from API (null if fetch failed)
   */
  private location: ISSLocation | null = null;

  /**
   * Number of crew members on ISS
   */
  private crewCount: number = 0;

  /**
   * Selected astronaut name for the observation
   */
  private selectedAstronaut: string = FALLBACK_VALUES.astronaut;

  /**
   * Selected observation angle for content variety
   */
  private observationAngle: string = '';

  /**
   * Location flavor text based on ISS position
   */
  private locationFlavor: string = FALLBACK_VALUES.locationFlavor;

  /**
   * Creates a new ISSObserverGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   * @param issClient - Optional ISSClient for fetching ISS data (useful for testing)
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {},
    issClient?: ISSClient
  ) {
    // Use LIGHT tier for ISS observations (straightforward info, fast and cheap)
    super(promptLoader, modelTierSelector, ModelTierEnum.LIGHT, apiKeys);
    this.issClient = issClient ?? new ISSClient();
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
   * Uses the iss-observer prompt which specifies the content type,
   * structure, and tone for ISS observation content.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'iss-observer.txt';
  }

  /**
   * Formats a location description based on ISS location data
   *
   * @param location - ISS location data
   * @returns Human-readable location description
   */
  private formatLocation(location: ISSLocation): string {
    if (location.ocean) {
      return location.ocean;
    }
    if (location.country_code) {
      return location.country_code;
    }
    if (location.region) {
      return location.region;
    }
    return FALLBACK_VALUES.location;
  }

  /**
   * Selects a random astronaut from ISS crew only (filters out Tiangong)
   *
   * @param crew - Space crew data including all spacecraft
   * @returns Random astronaut name from ISS, or fallback if none available
   */
  private selectRandomISSAstronaut(crew: SpaceCrew): string {
    // Filter to only ISS crew members
    const issCrewMembers = crew.people.filter(
      person => person.craft.toLowerCase() === 'iss'
    );

    if (issCrewMembers.length === 0) {
      return FALLBACK_VALUES.astronaut;
    }

    const randomIndex = Math.floor(Math.random() * issCrewMembers.length);
    return issCrewMembers[randomIndex].name;
  }

  /**
   * Hook: Fetches ISS data and returns as template variables.
   *
   * Fetches current ISS position, location, and crew from ISSClient
   * and formats them for prompt injection via template variables.
   * Selects random observation angle and location-appropriate flavor.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with ISS telemetry and observation context
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    // Reset tracking state
    this.issDataFetched = false;
    this.position = null;
    this.location = null;
    this.crewCount = 0;
    this.selectedAstronaut = FALLBACK_VALUES.astronaut;
    this.locationFlavor = FALLBACK_VALUES.locationFlavor;

    // Always select a random observation angle
    this.observationAngle = getRandomObservationAngle();

    // Default template variables using fallback values
    let templateVars: Record<string, string> = {
      latitude: FALLBACK_VALUES.latitude,
      longitude: FALLBACK_VALUES.longitude,
      altitude: FALLBACK_VALUES.altitude,
      velocity: FALLBACK_VALUES.velocity,
      velocityMph: FALLBACK_VALUES.velocityMph,
      visibility: FALLBACK_VALUES.visibility,
      location: FALLBACK_VALUES.location,
      crewCount: FALLBACK_VALUES.crewCount,
      astronaut: FALLBACK_VALUES.astronaut,
      observationAngle: this.observationAngle,
      locationFlavor: FALLBACK_VALUES.locationFlavor,
    };

    try {
      // Fetch full ISS status (position, location, crew)
      const status = await this.issClient.getFullStatus();

      this.position = status.position;
      this.location = status.location;
      this.issDataFetched = true;

      // Count only ISS crew members
      const issCrewMembers = status.crew.people.filter(
        person => person.craft.toLowerCase() === 'iss'
      );
      this.crewCount = issCrewMembers.length;

      // Select random astronaut from ISS crew
      this.selectedAstronaut = this.selectRandomISSAstronaut(status.crew);

      // Get location flavor based on position
      this.locationFlavor = getLocationFlavor({
        country_code: status.location.country_code ?? '',
        timezone_id: status.location.timezone_id ?? '',
      });

      // Convert velocity from km/h to mph (1 km = 0.621371 miles)
      const velocityMph = Math.round(status.position.velocity * 0.621371);

      // Update template variables with real data
      templateVars = {
        latitude: status.position.latitude.toFixed(2),
        longitude: status.position.longitude.toFixed(2),
        altitude: Math.round(status.position.altitude).toString(),
        velocity: Math.round(status.position.velocity).toString(),
        velocityMph: velocityMph.toString(),
        visibility: status.position.visibility,
        location: this.formatLocation(status.location),
        crewCount: this.crewCount.toString(),
        astronaut: this.selectedAstronaut,
        observationAngle: this.observationAngle,
        locationFlavor: this.locationFlavor,
      };
    } catch (error) {
      console.error('Failed to fetch ISS data for prompt:', error);
      // Keep using fallback values set above
    }

    return templateVars;
  }

  /**
   * Hook: Returns ISS data fetching status and selected values in metadata.
   *
   * @returns Metadata with ISS data status and generation parameters
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      issDataFetched: this.issDataFetched,
      position: this.position,
      location: this.location,
      crewCount: this.crewCount,
      selectedAstronaut: this.selectedAstronaut,
      observationAngle: this.observationAngle,
      locationFlavor: this.locationFlavor,
    };
  }
}
