/**
 * Barista Life Generator
 *
 * Generates coffee shop and barista humor for the Vestaboard. Content draws
 * from the universal chaos of working in a high-volume coffee shop: impossible
 * drink modifications, drive-thru warfare, seasonal launch madness, the
 * mythical "secret menu," and the existential dread of clopening.
 *
 * Humor is designed to land for anyone who's worked food service, not just
 * coffee-specific insiders. Each joke is self-contained and needs no context.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/barista-life.txt for barista humor guidance
 * - Uses LIGHT model tier for cost efficiency
 * - Injects random scenario + delivery style for maximum variety
 * - Inherits retry logic and provider failover from base class
 *
 * DESIGN PHILOSOPHY:
 * The scenario dictionary provides INSPIRATION, not literal requirements.
 * The LLM can pivot freely to find the funniest angle. Delivery style
 * guidance shapes the comedic approach without constraining the topic.
 *
 * @example
 * ```typescript
 * const generator = new BaristaLifeGenerator(
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
 * console.log(content.text); // "MORNING PEAK IS JUST\nORGANIZED PANIC WITH\nJAZZ MUSIC"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Barista scenario categories
 *
 * These are INSPIRATIONAL starting points. The LLM can pivot freely
 * to find the funniest angle - these just provide creative springboards.
 */
export const BARISTA_SCENARIOS = {
  // Peak hour chaos (the morning rush battlefield)
  PEAK_HOUR: [
    'the morning rush with 47 mobile orders',
    'one blender for the entire store during peak',
    'drive-thru line wrapped around the building',
    'running out of oat milk during rush hour',
    'both espresso machines down during morning peak',
    'three call-outs on a Monday morning',
    'being the only person on bar during happy hour',
  ],

  // Ridiculous customer orders (the modification arms race)
  MODIFICATIONS: [
    'a 17-modification drink that prints a receipt-length sticker',
    'extra caramel drizzle extra whip light ice but not too light',
    'someone ordering a drink at 180 degrees',
    'a frappuccino with no ice',
    'asking for a venti in a trenta cup with extra room',
    'sub oat milk sub vanilla add hazelnut extra pump double blended',
    'remaking a drink three times because it doesnt taste right',
  ],

  // The secret menu delusion
  SECRET_MENU: [
    'a customer asking for the TikTok drink',
    'being asked to look up a secret menu recipe on your phone',
    'someone ordering a drink that does not exist',
    'the secret menu is just drinks with main character energy',
    'a customer insisting you know what a cotton candy frap is',
    'showing you a screenshot from 2019 of a discontinued drink',
  ],

  // Drive-thru survival
  DRIVE_THRU: [
    'the car that says give me a minute after waiting in line',
    'can I also get a water at the end of a 12-drink order',
    'drive-thru timer pressure as a spiritual experience',
    'someone ordering at the handoff window',
    'a car full of people who each order separately',
    'reading back an order and hearing actually change that',
  ],

  // Closing and opening shifts
  SHIFTS: [
    'clopening as a lifestyle choice',
    'six frappuccinos ordered five minutes before close',
    'mopping the lobby knowing it will be dirty in ten minutes',
    'the closing checklist that never ends',
    'opening the store at 4 AM and questioning life decisions',
    'counting the till while customers bang on the locked door',
  ],

  // Seasonal chaos
  SEASONAL: [
    'pumpkin spice launch day being barista Black Friday',
    'red cup day generating more hype than most holidays',
    'the first day of a new promotion with zero training',
    'happy hour promotions as a form of psychological warfare',
    'running out of the seasonal syrup on day two',
    'customers asking for pumpkin spice in July',
  ],

  // Partner life (the insider experience)
  PARTNER_LIFE: [
    'remembering your partner numbers forever',
    'a borrowed partner who cannot find the vanilla',
    'headset conversations customers are not meant to hear',
    'marking out coffee you will never actually drink',
    'the green apron as a trauma bond accessory',
    'the short size that nobody has ever ordered in the wild',
    'your name being misspelled on your own cup',
  ],

  // Customer interactions (the daily theater)
  CUSTOMERS: [
    'someone ordering a Pikes Peak instead of Pike Place',
    'I want the regular coffee which of the four',
    'can you make it like the other store makes it',
    'a customer reading the menu like its their first day on Earth',
    'someone returning a drink they already drank half of',
    'being asked if the coffee has caffeine in it',
    'a customer who brings their own cup the size of a bucket',
  ],
} as const;

/**
 * Delivery style types for comedic variety
 */
export const DELIVERY_STYLES = [
  'DEADPAN',
  'VENTING',
  'WAR_CORRESPONDENT',
  'THERAPIST_NOTES',
  'NATURE_DOCUMENTARY',
  'SURVIVAL_GUIDE',
  'SPORTS_COMMENTARY',
] as const;

/**
 * Style-specific guidance injected into prompts
 *
 * Each style produces structurally different output. Only the
 * selected style's guidance is injected to keep prompts lean.
 */
export const STYLE_GUIDANCE: Record<(typeof DELIVERY_STYLES)[number], string> = {
  DEADPAN: `Flat, matter-of-fact delivery. No emotional inflection. "47 mobile orders. One blender. This is fine." Let the absurdity speak for itself.`,

  VENTING: `Unfiltered shift-end energy. The kind of thing you text your coworker from the parking lot. Exasperated but funny, not bitter.`,

  WAR_CORRESPONDENT: `Reporting from the front lines of the morning rush. Urgent, dramatic dispatches from behind the espresso bar. "Day 47. The oat milk supply has fallen."`,

  THERAPIST_NOTES: `Clinical observations about coffee shop chaos. "Patient reports hearing blender sounds in dreams. Session 47 of ongoing barista recovery."`,

  NATURE_DOCUMENTARY: `Observing baristas and customers in their natural habitat. "The customer approaches the counter. They have not decided what to order. They never do."`,

  SURVIVAL_GUIDE: `Practical survival tips for working in a coffee shop. Field manual energy. "Rule 1: The drive-thru timer is not your friend. Rule 2: See rule 1."`,

  SPORTS_COMMENTARY: `Play-by-play coverage of coffee shop moments. "And she's pulling the shots - double espresso - the crowd goes wild - wait, the customer wants it remade!"`,
};

export type BaristaScenarioCategory = keyof typeof BARISTA_SCENARIOS;
export type DeliveryStyle = (typeof DELIVERY_STYLES)[number];

/**
 * Generates barista and coffee shop humor
 *
 * Extends AIPromptGenerator with barista-specific prompts,
 * LIGHT model tier for efficiency, and random scenario/style
 * injection for content variety.
 */
export class BaristaLifeGenerator extends AIPromptGenerator {
  /**
   * Static access to scenario dictionary for testing
   */
  static readonly BARISTA_SCENARIOS = BARISTA_SCENARIOS;

  /**
   * Static access to delivery styles for testing
   */
  static readonly DELIVERY_STYLES = DELIVERY_STYLES;

  /**
   * Static access to style guidance for testing
   */
  static readonly STYLE_GUIDANCE = STYLE_GUIDANCE;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedCategory: string = '';
  private selectedScenario: string = '';
  private selectedStyle: string = '';

  /**
   * Creates a new BaristaLifeGenerator instance
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
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt
   */
  protected getUserPromptFile(): string {
    return 'barista-life.txt';
  }

  /**
   * Selects a random scenario category and scenario within it
   */
  selectRandomScenario(): { category: string; scenario: string } {
    const categoryKeys = Object.keys(BARISTA_SCENARIOS) as BaristaScenarioCategory[];
    const randomCategory = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const scenarios = BARISTA_SCENARIOS[randomCategory];
    const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    return {
      category: randomCategory,
      scenario: randomScenario,
    };
  }

  /**
   * Selects a random delivery style
   */
  selectRandomStyle(): DeliveryStyle {
    return DELIVERY_STYLES[Math.floor(Math.random() * DELIVERY_STYLES.length)];
  }

  /**
   * Hook: Selects random scenario and style, returns as template variables.
   *
   * Scenario is positioned as inspiration (LLM can pivot freely).
   * Style guidance is injected selectively for the chosen style only.
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const { category, scenario } = this.selectRandomScenario();
    const style = this.selectRandomStyle();

    // Cache for metadata
    this.selectedCategory = category;
    this.selectedScenario = scenario;
    this.selectedStyle = style;

    return {
      baristaScenario: scenario,
      deliveryStyle: style,
      styleGuidance: STYLE_GUIDANCE[style],
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      category: this.selectedCategory,
      scenario: this.selectedScenario,
      style: this.selectedStyle,
    };
  }
}
