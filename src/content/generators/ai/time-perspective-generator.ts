/**
 * Time Perspective Generator
 *
 * Generates content written as notebook entries from pre-modern scholars,
 * musing about their daily work in ways that create dramatic irony for
 * the modern viewer. The scholar writes from within their era — wishing,
 * complaining, inventing, wondering — and the viewer recognizes that
 * many of those wishes have already come true.
 *
 * Variability comes from two dimensions:
 * - FIELD: The scholar's discipline (astronomer, cartographer, physician...)
 *   gives the AI an entire domain of knowledge, vocabulary, and daily
 *   frustrations to draw from.
 * - DISPOSITION: How the scholar is expressing themselves (wistful,
 *   inventive, exasperated, philosophical, matter-of-fact) shapes
 *   the tone and structure of the entry.
 *
 * Variability: 15 fields x 5 dispositions x 4 time buckets = 300 combinations
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
 * Generates scholar notebook entries that create dramatic irony
 * through the gap between the scholar's era and the viewer's present.
 */
export class TimePerspectiveGenerator extends AIPromptGenerator {
  /**
   * Scholarly disciplines from the pre-modern world. Each field gives
   * the AI an entire domain of knowledge, tools, constraints, and
   * daily rhythms to draw from.
   */
  static readonly FIELDS: readonly string[] = [
    'ASTRONOMER',
    'CARTOGRAPHER',
    'PHYSICIAN',
    'MATHEMATICIAN',
    'BOTANIST',
    'NAVIGATOR',
    'LINGUIST',
    'ARCHITECT',
    'NATURALIST',
    'ALCHEMIST',
    'MUSICIAN',
    'GEOLOGIST',
    'HISTORIAN',
    'ENGINEER',
    'CLOCKMAKER',
  ] as const;

  /**
   * How the scholar is expressing themselves. Shapes tone and
   * structure without prescribing subject matter.
   */
  static readonly DISPOSITIONS: readonly string[] = [
    'WISTFUL',
    'INVENTIVE',
    'EXASPERATED',
    'PHILOSOPHICAL',
    'MATTER_OF_FACT',
  ] as const;

  private selectedField: string = '';
  private selectedDisposition: string = '';
  private selectedTimeBucket: TimeBucket = 'MORNING';

  /**
   * Programmatically selects a random field from the FIELDS array.
   */
  static selectField(): string {
    const index = Math.floor(Math.random() * TimePerspectiveGenerator.FIELDS.length);
    return TimePerspectiveGenerator.FIELDS[index];
  }

  /**
   * Programmatically selects a random disposition from DISPOSITIONS.
   */
  static selectDisposition(): string {
    const index = Math.floor(Math.random() * TimePerspectiveGenerator.DISPOSITIONS.length);
    return TimePerspectiveGenerator.DISPOSITIONS[index];
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
   * Hook: Selects random field, disposition, and time bucket, returns as template variables.
   */
  protected async getTemplateVariables(
    context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedField = TimePerspectiveGenerator.selectField();
    this.selectedDisposition = TimePerspectiveGenerator.selectDisposition();
    this.selectedTimeBucket = TimePerspectiveGenerator.getTimeBucket(context.timestamp.getHours());

    return {
      field: this.selectedField,
      disposition: this.selectedDisposition,
      timeBucket: this.selectedTimeBucket,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedField: this.selectedField,
      selectedDisposition: this.selectedDisposition,
      timeBucket: this.selectedTimeBucket,
    };
  }
}
