/**
 * Story Fragment Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * micro-fiction scene snapshots with one character, one moment,
 * and one emotional beat.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/story-fragment.txt for scene snapshot guidance
 * - Injects random scenario and emotionalBeat template variables
 * - Optimized with MEDIUM model tier for scene coherence nuance
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects scenario and emotionalBeat into prompt
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Design: Scene Snapshot
 * - One character, one moment, one emotional beat
 * - NOT a story arc - just a moment that lands
 * - No implied narrative requirement
 *
 * @example
 * ```typescript
 * const generator = new StoryFragmentGenerator(
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
 * console.log(content.text);
 * // "HE KEPT HER COFFEE
 * // MUG IN THE CABINET
 * // THREE YEARS NOW
 * // STILL DONT USE IT"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Scenario dictionary for scene snapshots
 *
 * Each scenario represents a moment type that can anchor a micro-fiction scene.
 * The scenario provides the situational context for the emotional beat.
 */
export const SCENARIO = [
  'KEEPING_OBJECT',
  'AFTER_PHONE_CALL',
  'ALMOST_SPOKE',
  'LAST_TIME',
  'WAITING',
  'FOUND_NOTE',
  'EMPTY_CHAIR',
  'HELD_DOOR',
  'PACKED_BOX',
  'KEPT_SECRET',
  'RETURNED_KEY',
  'WRONG_NUMBER',
  'OLD_PHOTO',
  'MISSED_TRAIN',
  'LEFT_MESSAGE',
  'UNOPENED_LETTER',
  'SAVED_SEAT',
] as const;

/**
 * Emotional beat dictionary for scene snapshots
 *
 * Each emotional beat represents the core feeling to convey through action,
 * not by naming the emotion directly.
 */
export const EMOTIONAL_BEAT = [
  'LOSS',
  'HOPE',
  'REGRET',
  'RELIEF',
  'LONGING',
  'RESOLVE',
  'TENDERNESS',
  'ACCEPTANCE',
] as const;

export type ScenarioType = (typeof SCENARIO)[number];
export type EmotionalBeatType = (typeof EMOTIONAL_BEAT)[number];

/**
 * Generates micro-fiction scene snapshots
 *
 * Extends AIPromptGenerator with story-fragment-specific prompts
 * and MEDIUM model tier selection for scene coherence.
 *
 * The generator injects random scenario and emotionalBeat variables
 * into the prompt template for creative variety.
 */
export class StoryFragmentGenerator extends AIPromptGenerator {
  /**
   * Static access to scenarios for testing
   */
  static readonly SCENARIO = SCENARIO;

  /**
   * Static access to emotional beats for testing
   */
  static readonly EMOTIONAL_BEAT = EMOTIONAL_BEAT;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedScenario: ScenarioType = 'KEEPING_OBJECT';
  private selectedEmotionalBeat: EmotionalBeatType = 'LOSS';

  /**
   * Creates a new StoryFragmentGenerator instance
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
    // Use MEDIUM tier for story fragments (scene coherence requires nuance)
    super(promptLoader, modelTierSelector, ModelTierEnum.MEDIUM, apiKeys);
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
   * Uses the story-fragment prompt which specifies the content type,
   * structure, and guidelines for micro-fiction scene snapshots.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'story-fragment.txt';
  }

  /**
   * Selects a random scenario from the SCENARIO dictionary
   *
   * @returns Random scenario string
   */
  selectRandomScenario(): ScenarioType {
    const index = Math.floor(Math.random() * SCENARIO.length);
    return SCENARIO[index];
  }

  /**
   * Selects a random emotional beat from the EMOTIONAL_BEAT dictionary
   *
   * @returns Random emotional beat string
   */
  selectRandomEmotionalBeat(): EmotionalBeatType {
    const index = Math.floor(Math.random() * EMOTIONAL_BEAT.length);
    return EMOTIONAL_BEAT[index];
  }

  /**
   * Hook: Selects random scenario and emotional beat, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with scenario and emotionalBeat
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedScenario = this.selectRandomScenario();
    this.selectedEmotionalBeat = this.selectRandomEmotionalBeat();

    return {
      scenario: this.selectedScenario,
      emotionalBeat: this.selectedEmotionalBeat,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with scenario and emotionalBeat
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      scenario: this.selectedScenario,
      emotionalBeat: this.selectedEmotionalBeat,
    };
  }
}
