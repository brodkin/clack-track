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
 * - Injects random thing, container, and emotion into prompts via triple dictionary
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects thing, container, emotion
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Format: Flirty, playful quips with unexpected combinations
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
 * console.log(content.text); // "IS THAT A VINTAGE\nTOASTER IN YOUR..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Dictionary of wildly specific things that might be found in unexpected places
 *
 * Each entry should be specific enough to be funny but recognizable
 * enough to land. Aim for visual absurdity and cultural touchstones.
 */
export const THINGS = [
  'vintage toaster',
  'sourdough starter',
  'rare vinyl record',
  'kombucha scoby',
  'tamagotchi',
  'swiss army knife',
  'mechanical keyboard',
  'crystals collection',
  'cast iron skillet',
  'travel humidor',
  'yoga mat',
  'reusable straws',
  'instant pot',
  'noise canceling headphones',
  'essential oils kit',
  'cheese wheel',
  'bonsai tree',
  'artisanal pickles jar',
  'french press',
  'record player',
  'polaroid camera',
  'meditation cushion',
  'standing desk',
  'air fryer',
  'weighted blanket',
  'espresso machine',
  'bread maker',
  'sous vide cooker',
  'smart watch',
  'drone',
] as const;

/**
 * Dictionary of unexpected containers or locations
 *
 * Mix of clothing, bags, furniture, and abstract spaces
 * that create comedic juxtaposition with the things.
 */
export const CONTAINERS = [
  'cargo shorts',
  'fanny pack',
  'tote bag',
  'sock drawer',
  'glove compartment',
  'coat pocket',
  'messenger bag',
  'briefcase',
  'backpack',
  'duffle bag',
  'lunchbox',
  'filing cabinet',
  'medicine cabinet',
  'junk drawer',
  'garage',
  'basement',
  'attic',
  'closet',
  'trunk',
  'cubicle',
  'locker',
  'purse',
  'wallet',
  'carry on',
  'overhead bin',
  'desk drawer',
  'nightstand',
  'pantry',
  'freezer',
  'shed',
] as const;

/**
 * Dictionary of unexpected emotional states
 *
 * Mix adjective-style emotions that can follow "are you just X to see me"
 * including creative non-standard emotions for comedic effect.
 */
export const EMOTIONS = [
  'happy',
  'excited',
  'thrilled',
  'nostalgic',
  'fermented',
  'caffeinated',
  'organized',
  'minimalist',
  'bougie',
  'hipster',
  'mindful',
  'hydrated',
  'zen',
  'artisanal',
  'sustainable',
  'vintage',
  'curated',
  'aesthetic',
  'cozy',
  'ergonomic',
] as const;

export type Thing = (typeof THINGS)[number];
export type Container = (typeof CONTAINERS)[number];
export type Emotion = (typeof EMOTIONS)[number];

/**
 * Generates playful innuendo-style jokes with unexpected combinations
 *
 * Extends AIPromptGenerator with happy-to-see-me-specific prompts,
 * LIGHT model tier selection for cost efficiency, and
 * random thing/container/emotion injection for variety.
 */
export class HappyToSeeMeGenerator extends AIPromptGenerator {
  /**
   * Static access to things dictionary for testing
   */
  static readonly THINGS = THINGS;

  /**
   * Static access to containers dictionary for testing
   */
  static readonly CONTAINERS = CONTAINERS;

  /**
   * Static access to emotions dictionary for testing
   */
  static readonly EMOTIONS = EMOTIONS;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedThing: string = '';
  private selectedContainer: string = '';
  private selectedEmotion: string = '';

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
   * Selects a random thing from the dictionary
   *
   * @returns The selected thing
   */
  selectRandomThing(): string {
    return THINGS[Math.floor(Math.random() * THINGS.length)];
  }

  /**
   * Selects a random container from the dictionary
   *
   * @returns The selected container
   */
  selectRandomContainer(): string {
    return CONTAINERS[Math.floor(Math.random() * CONTAINERS.length)];
  }

  /**
   * Selects a random emotion from the dictionary
   *
   * @returns The selected emotion
   */
  selectRandomEmotion(): string {
    return EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];
  }

  /**
   * Hook: Selects random thing, container, and emotion, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with thing, container, emotion
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const thing = this.selectRandomThing();
    const container = this.selectRandomContainer();
    const emotion = this.selectRandomEmotion();

    // Cache for metadata
    this.selectedThing = thing;
    this.selectedContainer = container;
    this.selectedEmotion = emotion;

    return {
      thing,
      container,
      emotion,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with thing, container, and emotion
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      thing: this.selectedThing,
      container: this.selectedContainer,
      emotion: this.selectedEmotion,
    };
  }
}
