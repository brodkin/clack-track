/**
 * Alien Field Report Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * Earth observations from an alien anthropologist studying humans.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/alien-field-report.txt for alien voice guidance
 * - Uses LIGHT model tier for cost efficiency
 * - Injects random log number, subject category, observation focus, and angle into prompts
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects logNumber, subjectCategory, observationFocus, observationAngle
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Format: EARTH LOG XXX: followed by deadpan scientific observations
 * about mundane human behaviors.
 *
 * @example
 * ```typescript
 * const generator = new AlienFieldReportGenerator(
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
 * console.log(content.text); // "EARTH LOG 047:\nSUBJECTS CONSUME BITTER..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Subject categories for alien observations
 *
 * Each category contains specific observation focuses that represent
 * everyday human behaviors an alien might find puzzling.
 */
export const SUBJECT_CATEGORIES = {
  SUSTENANCE: [
    'coffee consumption',
    'pizza ordering',
    'snack hoarding',
    'meal photography',
    'leftovers politics',
  ],
  TECHNOLOGY: [
    'phone checking',
    'password rituals',
    'wifi dependency',
    'update avoidance',
    'cable management',
  ],
  SOCIAL: ['small talk', 'elevator behavior', 'queue formation', 'gift exchange', 'group photos'],
  TEMPORAL: [
    'alarm snoozing',
    'deadline panic',
    'weekend worship',
    'monday dread',
    'friday celebration',
  ],
  DOMESTIC: [
    'laundry accumulation',
    'plant neglect',
    'drawer organization',
    'bed making debate',
    'remote control wars',
  ],
  PROFESSIONAL: [
    'meeting attendance',
    'email checking',
    'desk territory',
    'coffee breaks',
    'video call backgrounds',
  ],
  RECREATIONAL: [
    'screen binging',
    'pet interactions',
    'exercise avoidance',
    'hobby collection',
    'nap justification',
  ],
  TRANSPORT: [
    'parking strategies',
    'traffic complaints',
    'gas light gambling',
    'shortcut beliefs',
    'road rage triggers',
  ],
} as const;

/**
 * Observation angles for field reports
 *
 * Each angle provides a different lens through which the alien
 * interprets human behavior:
 * - RITUAL_ANALYSIS: Document as elaborate ceremony
 * - BIOLOGICAL_QUIRK: Frame as strange adaptation
 * - TECHNOLOGY_WORSHIP: Interpret as device devotion
 * - SOCIAL_BONDING: Analyze as tribal cohesion
 * - TEMPORAL_OBSESSION: Note time enslavement
 */
export const OBSERVATION_ANGLES = [
  'RITUAL_ANALYSIS',
  'BIOLOGICAL_QUIRK',
  'TECHNOLOGY_WORSHIP',
  'SOCIAL_BONDING',
  'TEMPORAL_OBSESSION',
] as const;

export type SubjectCategory = keyof typeof SUBJECT_CATEGORIES;
export type ObservationAngle = (typeof OBSERVATION_ANGLES)[number];

/**
 * Generates alien field reports - deadpan observations of human behavior
 *
 * Extends AIPromptGenerator with alien-specific prompts,
 * LIGHT model tier selection for cost efficiency, and
 * random category/focus/angle injection for variety.
 */
export class AlienFieldReportGenerator extends AIPromptGenerator {
  /**
   * Static access to subject categories for testing
   */
  static readonly SUBJECT_CATEGORIES = SUBJECT_CATEGORIES;

  /**
   * Static access to observation angles for testing
   */
  static readonly OBSERVATION_ANGLES = OBSERVATION_ANGLES;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedLogNumber: string = '';
  private selectedCategory: string = '';
  private selectedFocus: string = '';
  private selectedAngle: string = '';

  /**
   * Creates a new AlienFieldReportGenerator instance
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
    // Use LIGHT tier for alien field reports (cost efficiency)
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
   * Uses the alien-field-report prompt which specifies the content type,
   * structure, and tone for alien anthropologist observations.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'alien-field-report.txt';
  }

  /**
   * Generates a random log number in range 001-999, zero-padded
   *
   * @returns Zero-padded log number string (e.g., "047", "183", "256")
   */
  generateLogNumber(): string {
    const number = Math.floor(Math.random() * 999) + 1;
    return number.toString().padStart(3, '0');
  }

  /**
   * Selects a random subject category and observation focus within it
   *
   * @returns Object containing the selected category and focus
   */
  selectRandomSubject(): { category: string; focus: string } {
    const categoryKeys = Object.keys(SUBJECT_CATEGORIES) as SubjectCategory[];
    const randomCategory = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const focuses = SUBJECT_CATEGORIES[randomCategory];
    const randomFocus = focuses[Math.floor(Math.random() * focuses.length)];

    return {
      category: randomCategory,
      focus: randomFocus,
    };
  }

  /**
   * Selects a random observation angle
   *
   * @returns The selected observation angle
   */
  selectRandomAngle(): string {
    return OBSERVATION_ANGLES[Math.floor(Math.random() * OBSERVATION_ANGLES.length)];
  }

  /**
   * Hook: Generates log number, selects random subject and angle, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with logNumber, subjectCategory, observationFocus, observationAngle
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const logNumber = this.generateLogNumber();
    const { category, focus } = this.selectRandomSubject();
    const angle = this.selectRandomAngle();

    // Cache for metadata
    this.selectedLogNumber = logNumber;
    this.selectedCategory = category;
    this.selectedFocus = focus;
    this.selectedAngle = angle;

    return {
      logNumber,
      subjectCategory: category,
      observationFocus: focus,
      observationAngle: angle,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with logNumber, category, focus, and angle
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      logNumber: this.selectedLogNumber,
      category: this.selectedCategory,
      focus: this.selectedFocus,
      angle: this.selectedAngle,
    };
  }
}
