/**
 * Hot Take Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * playful, cheeky opinions on mundane everyday topics.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/hot-take.txt for hot take content guidance
 * - Variety dimensions via HOT_TAKE_SUBJECTS (192 broad topics) and HOT_TAKE_DEVICES (32 rhetorical devices)
 * - Optimized with LIGHT model tier for efficiency (simple opinions)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Selects random subject and device for {{hotTakeSubject}}, {{hotTakeDevice}}
 * - getCustomMetadata(): Adds selectedSubject and selectedDevice to metadata for tracking
 *
 * Subjects are intentionally broad (dogs, coffee, mornings) to give the LLM
 * creative freedom to develop unique hot takes. Rhetorical devices force
 * structural variety in the output (not just tone variations).
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
 * console.log(content.text); // "THERE ARE TWO TYPES\nOF DOG PEOPLE AND\nTHE WRONG KIND"
 * console.log(content.metadata.selectedSubject); // "dogs"
 * console.log(content.metadata.selectedDevice); // "false dichotomy"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GenerationContext } from '../../../types/content-generator.js';

/**
 * Broad subjects for hot takes - wide, open-ended topics that allow creative freedom.
 * 192 subjects across 14 categories give the LLM room to develop unique opinions.
 *
 * Design principles:
 * - Broad, not specific: "dogs" not "chihuahuas barking at mailmen"
 * - Creative freedom: Each subject allows many possible angles
 * - Not already hot takes: Avoid "pineapple on pizza" style topics
 * - Mundane/everyday: Keep topics trivial and harmless
 */
export const HOT_TAKE_SUBJECTS: readonly string[] = [
  // Animals (15)
  'dogs',
  'cats',
  'birds',
  'fish',
  'reptiles',
  'insects',
  'horses',
  'rabbits',
  'hamsters',
  'squirrels',
  'pigeons',
  'spiders',
  'bees',
  'dolphins',
  'penguins',
  // Food & Cooking (15)
  'breakfast',
  'sandwiches',
  'salads',
  'soup',
  'pasta',
  'rice',
  'bread',
  'cheese',
  'fruit',
  'vegetables',
  'snacks',
  'desserts',
  'condiments',
  'leftovers',
  'meal prep',
  // Beverages (12)
  'coffee',
  'tea',
  'water',
  'juice',
  'soda',
  'smoothies',
  'hot chocolate',
  'energy drinks',
  'milk',
  'lemonade',
  'sparkling water',
  'iced drinks',
  // Hobbies & Leisure (18)
  'gardening',
  'reading',
  'puzzles',
  'board games',
  'video games',
  'knitting',
  'cooking',
  'baking',
  'hiking',
  'camping',
  'fishing',
  'photography',
  'painting',
  'crafting',
  'collecting',
  'journaling',
  'birdwatching',
  'stargazing',
  // Life Stages & Milestones (12)
  'childhood',
  'teenage years',
  'college',
  'first jobs',
  'moving out',
  'weddings',
  'parenthood',
  'middle age',
  'retirement',
  'birthdays',
  'anniversaries',
  'graduations',
  // Social Situations (15)
  'small talk',
  'parties',
  'family gatherings',
  'reunions',
  'road trips',
  'vacations',
  'dinner parties',
  'office meetings',
  'elevators',
  'waiting rooms',
  'checkout lines',
  'public transit',
  'airports',
  'restaurants',
  'coffee shops',
  // Professions & Work (12)
  'teachers',
  'doctors',
  'lawyers',
  'chefs',
  'artists',
  'athletes',
  'musicians',
  'writers',
  'engineers',
  'nurses',
  'pilots',
  'librarians',
  // Home & Living (15)
  'bedrooms',
  'kitchens',
  'bathrooms',
  'living rooms',
  'closets',
  'garages',
  'yards',
  'apartments',
  'furniture',
  'decorating',
  'cleaning',
  'organizing',
  'plants',
  'pets',
  'neighbors',
  // Technology & Devices (12)
  'smartphones',
  'laptops',
  'tablets',
  'televisions',
  'headphones',
  'smart home',
  'apps',
  'passwords',
  'notifications',
  'updates',
  'charging',
  'wifi',
  // Nature & Weather (15)
  'rain',
  'sunshine',
  'snow',
  'autumn leaves',
  'spring flowers',
  'summer heat',
  'winter cold',
  'beaches',
  'mountains',
  'forests',
  'lakes',
  'sunsets',
  'clouds',
  'wind',
  'thunderstorms',
  // Sports & Fitness (12)
  'running',
  'swimming',
  'cycling',
  'yoga',
  'gyms',
  'team sports',
  'golf',
  'tennis',
  'skiing',
  'surfing',
  'walking',
  'stretching',
  // Entertainment (15)
  'movies',
  'television',
  'podcasts',
  'music',
  'concerts',
  'theater',
  'comedy',
  'documentaries',
  'reality shows',
  'game shows',
  'streaming',
  'sequels',
  'remakes',
  'trailers',
  'awards shows',
  // Daily Routines (12)
  'mornings',
  'evenings',
  'commuting',
  'lunch breaks',
  'naps',
  'weekends',
  'mondays',
  'fridays',
  'holidays',
  'alarm clocks',
  'bedtime',
  'showers',
  // Fashion & Appearance (12)
  'shoes',
  'socks',
  'hats',
  'glasses',
  'watches',
  'jewelry',
  'haircuts',
  'beards',
  'makeup',
  'pajamas',
  'uniforms',
  'accessories',
] as const;

/**
 * Rhetorical devices for hot takes - structural patterns that shape HOW the opinion is expressed.
 * 32 devices across 4 categories force variety in sentence structure, not just tone.
 *
 * Design principles:
 * - Structural variety: Each device forces a different output pattern
 * - Not tone-based: Distinct from mere attitude variations
 * - Output-shaping: The device determines HOW the take is structured
 * - Clear differentiation: No overlap between devices
 */
export const HOT_TAKE_DEVICES: readonly string[] = [
  // Statement Types (8)
  'universal truth',
  'personal confession',
  'bold prediction',
  'unpopular opinion',
  'hot take declaration',
  'controversial ranking',
  'definitive verdict',
  'humble brag',
  // Comparison & Contrast (8)
  'false equivalence',
  'surprising analogy',
  'hierarchy reversal',
  'generational divide',
  'underdog defense',
  'overrated callout',
  'sleeper pick',
  'category error',
  // Temporal Framings (8)
  'nostalgia rejection',
  'future perfect',
  'golden age myth',
  'progress narrative',
  'seasonal truth',
  'lifecycle stage',
  'before and after',
  'right time claim',
  // Logical Structures (8)
  'if-then ultimatum',
  'necessary condition',
  'false dichotomy',
  'reductio ad absurdum',
  'appeal to nature',
  'appeal to efficiency',
  'cost-benefit analysis',
  'exception proof',
] as const;

/**
 * Generates playful hot takes on mundane topics
 *
 * Extends AIPromptGenerator with hot-take-specific prompts,
 * efficient LIGHT model tier selection, and variety dimensions
 * for subject and device selection.
 *
 * Uses the getTemplateVariables hook to inject randomly selected
 * subject and device into prompts, and getCustomMetadata to track
 * the selections in generation metadata.
 */
export class HotTakeGenerator extends AIPromptGenerator {
  /**
   * Stores the selected subject for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedSubject: string = '';

  /**
   * Stores the selected device for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedDevice: string = '';

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
   * Hook: Selects random subject and device for prompt injection.
   *
   * Selections are stored in instance properties for metadata tracking.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with hotTakeSubject and hotTakeDevice
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedSubject = this.selectRandom(HOT_TAKE_SUBJECTS);
    this.selectedDevice = this.selectRandom(HOT_TAKE_DEVICES);

    return {
      hotTakeSubject: this.selectedSubject,
      hotTakeDevice: this.selectedDevice,
    };
  }

  /**
   * Hook: Returns metadata with selected subject and device for tracking.
   *
   * @returns Metadata with selectedSubject and selectedDevice
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedSubject: this.selectedSubject,
      selectedDevice: this.selectedDevice,
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
