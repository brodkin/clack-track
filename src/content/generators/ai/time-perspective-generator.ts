/**
 * Time Perspective Generator
 *
 * Generates content that views the present moment through the eyes of a
 * historian peering across deep time with wonder. Pairs a temporal lens
 * with an ordinary modern-day observation to reveal how extraordinary
 * everyday life actually is.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/time-perspective.txt for time perspective guidance
 * - Uses MEDIUM model tier for nuanced temporal wonder
 * - Programmatic lens selection from 5 temporal perspectives
 * - Programmatic observation selection from 20 everyday moments
 * - Time-of-day bucket for contextual relevance
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects lens, observation, and timeBucket
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Variability: 5 lenses x 20 observations x 4 time buckets = 400 combinations
 *
 * @example
 * ```typescript
 * const generator = new TimePerspectiveGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date(),
 *   timezone: 'America/New_York'
 * });
 *
 * console.log(content.text); // "STARS TAKE 10 MILLION\nYEARS TO FORM AND YOU\nMADE COFFEE IN FOUR\nMINUTES. EFFICIENT."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier } from '../../../types/content-generator.js';
import type { GenerationContext } from '../../../types/content-generator.js';

/**
 * Time bucket representing different parts of the day
 */
type TimeBucket = 'NIGHT' | 'MORNING' | 'AFTERNOON' | 'EVENING';

/**
 * Generates temporal wonder content through various historical lenses
 *
 * Extends AIPromptGenerator with time-perspective-specific prompts
 * and MEDIUM model tier selection. Uses programmatic selection to
 * ensure true randomness in lens and observation choices.
 */
export class TimePerspectiveGenerator extends AIPromptGenerator {
  /**
   * Five temporal perspective lenses, each offering a different
   * angle on the present moment:
   *
   * - COSMIC: Vast time scales (billions of years, universe's age)
   * - ABSURDIST: Playful wonder at the ridiculousness of existing
   * - ANCESTOR: What people from the past would marvel at today
   * - CONNECTION: The web of simultaneous human experience
   * - FUTURE_SELF: Your future self appreciating this moment
   */
  static readonly LENSES: readonly string[] = [
    'COSMIC',
    'ABSURDIST',
    'ANCESTOR',
    'CONNECTION',
    'FUTURE_SELF',
  ] as const;

  /**
   * Ordinary present-day moments that become extraordinary
   * when viewed through a temporal lens. Selected programmatically
   * to ensure variety across generations.
   */
  static readonly OBSERVATIONS: readonly string[] = [
    'MAKING_COFFEE',
    'CHECKING_THE_TIME',
    'CHOOSING_WHAT_TO_EAT',
    'LISTENING_TO_MUSIC',
    'READING_A_MESSAGE',
    'WALKING_THROUGH_A_DOOR',
    'LOOKING_OUT_A_WINDOW',
    'TURNING_ON_A_LIGHT',
    'DRINKING_CLEAN_WATER',
    'HAVING_A_CONVERSATION',
    'PICKING_AN_OUTFIT',
    'COOKING_A_MEAL',
    'SITTING_IN_A_CHAIR',
    'PETTING_AN_ANIMAL',
    'LAUGHING_AT_SOMETHING',
    'LEARNING_SOMETHING_NEW',
    'MAKING_A_PLAN',
    'OPENING_A_BOOK',
    'LOOKING_AT_THE_SKY',
    'SHARING_A_MEAL',
  ] as const;

  private selectedLens: string = '';
  private selectedObservation: string = '';
  private selectedTimeBucket: TimeBucket = 'MORNING';

  /**
   * Programmatically selects a random lens from the LENSES array.
   */
  static selectLens(): string {
    const index = Math.floor(Math.random() * TimePerspectiveGenerator.LENSES.length);
    return TimePerspectiveGenerator.LENSES[index];
  }

  /**
   * Programmatically selects a random observation from OBSERVATIONS.
   */
  static selectObservation(): string {
    const index = Math.floor(Math.random() * TimePerspectiveGenerator.OBSERVATIONS.length);
    return TimePerspectiveGenerator.OBSERVATIONS[index];
  }

  /**
   * Determines the time bucket based on the hour of day.
   *
   * @param hour - Hour in 24-hour format (0-23)
   * @returns Time bucket string (NIGHT, MORNING, AFTERNOON, EVENING)
   */
  static getTimeBucket(hour: number): TimeBucket {
    if (hour >= 0 && hour <= 5) return 'NIGHT';
    if (hour >= 6 && hour <= 11) return 'MORNING';
    if (hour >= 12 && hour <= 17) return 'AFTERNOON';
    return 'EVENING';
  }

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys);
  }

  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  protected getUserPromptFile(): string {
    return 'time-perspective.txt';
  }

  /**
   * Hook: Selects random lens, observation, and time bucket, returns as template variables.
   */
  protected async getTemplateVariables(
    context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedLens = TimePerspectiveGenerator.selectLens();
    this.selectedObservation = TimePerspectiveGenerator.selectObservation();
    this.selectedTimeBucket = TimePerspectiveGenerator.getTimeBucket(context.timestamp.getHours());

    return {
      lens: this.selectedLens,
      observation: this.selectedObservation,
      timeBucket: this.selectedTimeBucket,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedLens: this.selectedLens,
      selectedObservation: this.selectedObservation,
      timeBucket: this.selectedTimeBucket,
    };
  }
}
