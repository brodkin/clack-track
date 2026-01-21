/**
 * Hot Take Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * playful, cheeky opinions on mundane everyday topics.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/hot-take.txt for hot take content guidance
 * - Variety dimensions via HOT_TAKE_DOMAINS (50 topics) and HOT_TAKE_ANGLES (12 styles)
 * - Optimized with LIGHT model tier for efficiency (simple opinions)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Selects random domain and angle for {{hotTakeDomain}}, {{hotTakeAngle}}
 * - getCustomMetadata(): Adds selectedDomain and selectedAngle to metadata for tracking
 *
 * Topics are intentionally trivial (food preferences, daily habits,
 * minor life choices) to keep takes playful and harmless. The tone
 * is confident and bold but never mean-spirited or actually controversial.
 *
 * @example
 * ```typescript
 * const generator = new HotTakeGenerator(
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
 * console.log(content.text); // "PINEAPPLE ON PIZZA\nIS NOT JUST ACCEPTABLE\nIT'S SUPERIOR"
 * console.log(content.metadata.selectedDomain); // "food preferences"
 * console.log(content.metadata.selectedAngle); // "contrarian reversal"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GenerationContext } from '../../../types/content-generator.js';

/**
 * Topic domains for hot takes - trivial, everyday categories for playful opinions.
 * 50 domains provide high variety across food, lifestyle, tech, social, and daily life.
 */
export const HOT_TAKE_DOMAINS: readonly string[] = [
  // Food & Beverage (10)
  'pizza toppings',
  'breakfast cereals',
  'coffee preparation',
  'sandwich construction',
  'condiment choices',
  'snack preferences',
  'cooking methods',
  'ice cream flavors',
  'beverage temperatures',
  'food combinations',
  // Daily Habits (10)
  'morning routines',
  'sleep schedules',
  'shower timing',
  'alarm clock behavior',
  'commute preferences',
  'desk organization',
  'note-taking methods',
  'calendar management',
  'to-do list styles',
  'break time activities',
  // Technology (10)
  'phone charging habits',
  'notification settings',
  'browser tab management',
  'password strategies',
  'emoji usage',
  'texting styles',
  'social media habits',
  'streaming choices',
  'app organization',
  'device preferences',
  // Social & Lifestyle (10)
  'small talk topics',
  'party arrival timing',
  'gift giving customs',
  'holiday traditions',
  'birthday celebrations',
  'greeting styles',
  'seating preferences',
  'waiting room behavior',
  'elevator etiquette',
  'queue management',
  // Home & Personal (10)
  'thermostat settings',
  'towel folding methods',
  'sock matching',
  'plant care approaches',
  'laundry sorting',
  'dishwasher loading',
  'bed making habits',
  'closet organization',
  'bathroom routines',
  'kitchen cleanliness',
] as const;

/**
 * Opinion angles for hot takes - rhetorical styles for delivering the opinion.
 * 12 angles ensure varied tone and approach for each generated take.
 */
export const HOT_TAKE_ANGLES: readonly string[] = [
  'contrarian reversal',
  'passionate defense',
  'reluctant confession',
  'absolute certainty',
  'gentle persuasion',
  'bold declaration',
  'surprised discovery',
  'nostalgic reflection',
  'scientific analysis',
  'philosophical musing',
  'practical wisdom',
  'playful challenge',
] as const;

/**
 * Generates playful hot takes on mundane topics
 *
 * Extends AIPromptGenerator with hot-take-specific prompts,
 * efficient LIGHT model tier selection, and variety dimensions
 * for domain and angle selection.
 *
 * Uses the getTemplateVariables hook to inject randomly selected
 * domain and angle into prompts, and getCustomMetadata to track
 * the selections in generation metadata.
 */
export class HotTakeGenerator extends AIPromptGenerator {
  /**
   * Stores the selected domain for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedDomain: string = '';

  /**
   * Stores the selected angle for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedAngle: string = '';

  /**
   * Creates a new HotTakeGenerator instance
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
    // Use LIGHT tier for hot takes (simple content, fast and cheap)
    super(promptLoader, modelTierSelector, ModelTier.LIGHT, apiKeys);
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
   * Uses the hot-take prompt which specifies the content type,
   * structure, and playful tone for spicy mundane opinions.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'hot-take.txt';
  }

  /**
   * Hook: Selects random domain and angle for prompt injection.
   *
   * Selections are stored in instance properties for metadata tracking.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with hotTakeDomain and hotTakeAngle
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedDomain = this.selectRandom(HOT_TAKE_DOMAINS);
    this.selectedAngle = this.selectRandom(HOT_TAKE_ANGLES);

    return {
      hotTakeDomain: this.selectedDomain,
      hotTakeAngle: this.selectedAngle,
    };
  }

  /**
   * Hook: Returns metadata with selected domain and angle for tracking.
   *
   * @returns Metadata with selectedDomain and selectedAngle
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedDomain: this.selectedDomain,
      selectedAngle: this.selectedAngle,
    };
  }

  /**
   * Selects a random element from a readonly array.
   *
   * @param array - Array to select from
   * @returns Randomly selected element
   */
  private selectRandom<T>(array: readonly T[]): T {
    const index = Math.floor(Math.random() * array.length);
    return array[index];
  }
}
