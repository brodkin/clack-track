/**
 * Yo Momma Generator
 *
 * Concrete implementation of AIPromptGenerator for generating playful
 * "Yo momma so [quality] that she [action]" jokes that can be either
 * sick burns or genuine compliments.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/yo-momma.txt for joke format guidance
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
 * - getTemplateVariables(): Injects qualityVibe, actionVibe, toneVibe
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Format: Playful burns OR genuine compliments with clever wordplay
 *
 * @example
 * ```typescript
 * const generator = new YoMommaGenerator(
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
 * console.log(content.text); // "YO MOMMA SO KIND\nTHAT STRANGERS..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Thematic vibes for quality adjectives
 *
 * These are creative springboards, not literal requirements.
 * The AI should invent its own specific adjectives inspired by these themes.
 */
export const QUALITY_VIBES = [
  'athletic prowess',
  'intellectual brilliance',
  'culinary mastery',
  'generous spirit',
  'legendary patience',
  'creative genius',
  'tech savviness',
  'musical talent',
  'organizational skills',
  'social butterfly energy',
  'green thumb expertise',
  'fashion forward sense',
  'comedic timing',
  'dramatic flair',
  'competitive spirit',
  'nurturing warmth',
  'street smart wisdom',
  'book smart knowledge',
  'adventurous soul',
  'frugal excellence',
] as const;

/**
 * Thematic vibes for absurd actions
 *
 * These inspire unexpected consequences and punchlines.
 * The AI should invent specific, surprising actions.
 */
export const ACTION_VIBES = [
  'household miracle feats',
  'embarrassing public displays',
  'food-related achievements',
  'technology mishaps triumphs',
  'wildlife interactions',
  'celebrity encounters',
  'weather manipulation',
  'time bending abilities',
  'retail store legends',
  'neighborhood fame',
  'kitchen catastrophe wins',
  'sports field stories',
  'vehicle related tales',
  'pet whispering powers',
  'holiday tradition chaos',
  'workplace legend status',
  'social media exploits',
  'garden growing feats',
  'DIY project outcomes',
  'vacation adventure tales',
] as const;

/**
 * Thematic vibes for joke tone
 *
 * These set the emotional register - from playful roast to genuine hype.
 */
export const TONE_VIBES = [
  'sick burn',
  'backhanded compliment',
  'genuine hype',
  'absurd praise',
  'loving roast',
  'wholesome flex',
  'playful shade',
  'proud bragging',
  'ironic appreciation',
  'heartfelt tribute',
  'competitive admiration',
  'nostalgic teasing',
  'affectionate mockery',
  'respectful ribbing',
  'over the top flattery',
  'subtle dig',
  'earnest celebration',
  'tongue in cheek honor',
  'grudging respect',
  'enthusiastic props',
] as const;

export type QualityVibe = (typeof QUALITY_VIBES)[number];
export type ActionVibe = (typeof ACTION_VIBES)[number];
export type ToneVibe = (typeof TONE_VIBES)[number];

/**
 * Generates playful "Yo Momma" jokes with thematically cohesive elements
 *
 * Extends AIPromptGenerator with yo-momma-specific prompts,
 * LIGHT model tier selection for cost efficiency, and
 * thematic vibe injection that INSPIRES (not dictates) the output.
 */
export class YoMommaGenerator extends AIPromptGenerator {
  /**
   * Static access to quality vibes for testing
   */
  static readonly QUALITY_VIBES = QUALITY_VIBES;

  /**
   * Static access to action vibes for testing
   */
  static readonly ACTION_VIBES = ACTION_VIBES;

  /**
   * Static access to tone vibes for testing
   */
  static readonly TONE_VIBES = TONE_VIBES;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedQualityVibe: string = '';
  private selectedActionVibe: string = '';
  private selectedToneVibe: string = '';

  /**
   * Creates a new YoMommaGenerator instance
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
    // Use LIGHT tier for yo-momma jokes (cost efficiency)
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
   * Uses the yo-momma prompt which specifies the content type,
   * structure, and tone for yo-momma jokes.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'yo-momma.txt';
  }

  /**
   * Selects a random quality vibe from the dictionary
   *
   * @returns The selected vibe theme
   */
  selectRandomQualityVibe(): string {
    return QUALITY_VIBES[Math.floor(Math.random() * QUALITY_VIBES.length)];
  }

  /**
   * Selects a random action vibe from the dictionary
   *
   * @returns The selected vibe theme
   */
  selectRandomActionVibe(): string {
    return ACTION_VIBES[Math.floor(Math.random() * ACTION_VIBES.length)];
  }

  /**
   * Selects a random tone vibe from the dictionary
   *
   * @returns The selected vibe theme
   */
  selectRandomToneVibe(): string {
    return TONE_VIBES[Math.floor(Math.random() * TONE_VIBES.length)];
  }

  /**
   * Hook: Selects random vibes, returns as template variables.
   *
   * These vibes INSPIRE the AI's output but don't dictate it.
   * The AI creates its own cohesive, specific combinations.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with qualityVibe, actionVibe, toneVibe
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const qualityVibe = this.selectRandomQualityVibe();
    const actionVibe = this.selectRandomActionVibe();
    const toneVibe = this.selectRandomToneVibe();

    // Cache for metadata
    this.selectedQualityVibe = qualityVibe;
    this.selectedActionVibe = actionVibe;
    this.selectedToneVibe = toneVibe;

    return {
      qualityVibe,
      actionVibe,
      toneVibe,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with qualityVibe, actionVibe, and toneVibe
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      qualityVibe: this.selectedQualityVibe,
      actionVibe: this.selectedActionVibe,
      toneVibe: this.selectedToneVibe,
    };
  }
}
