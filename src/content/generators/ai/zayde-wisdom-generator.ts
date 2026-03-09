/**
 * Zayde Wisdom Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * wisdom and observations from a sweet-but-cranky old Jewish man
 * from the Bronx archetype.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/zayde-wisdom.txt for character voice guidance
 * - Dual dictionary dimensions: TOPICS (what) x APPROACHES (how) for variety
 * - Uses MEDIUM model tier (character voice needs context depth)
 * - Inherits retry logic and provider failover from base class
 *
 * Variety math: 12 topics x 10 approaches = 120 unique combinations
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects randomly selected topic and approach into prompt
 * - getCustomMetadata(): Tracks which topic and approach were selected
 *
 * @example
 * ```typescript
 * const generator = new ZaydeWisdomGenerator(
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
 * console.log(content.text); // "OY THE PRICE OF EGGS\nYOU COULD BUY A HOUSE..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GenerationContext } from '../../../types/content-generator.js';

/**
 * Topics for zayde wisdom generation
 *
 * These topics represent the everyday kvetch-worthy subjects
 * that a sweet-but-cranky Bronx elder would hold forth on.
 */
export const TOPICS = [
  'the price of things',
  'telemarketers',
  'the doctor',
  'technology',
  'the weather',
  'kids today',
  'the old neighborhood',
  'his knees',
  'restaurants',
  'traffic',
  'the news',
  'grocery shopping',
] as const;

/**
 * Delivery approaches for zayde wisdom generation
 *
 * These approaches control HOW the zayde delivers his wisdom,
 * orthogonal to the topic (WHAT he talks about).
 * 12 topics x 10 approaches = 120 unique combinations.
 */
export const APPROACHES = [
  'NOSTALGIC_COMPARISON',
  'UNSOLICITED_ADVICE',
  'RHETORICAL_QUESTION',
  'GRUDGING_COMPLIMENT',
  'DRAMATIC_RETELLING',
  'PROVERB_TWIST',
  'CONSPIRACY_THEORY',
  'OPEN_LETTER',
  'RUNNING_TALLY',
  'PHILOSOPHICAL_SHRUG',
] as const;

/**
 * Approach-specific guidance injected into prompts
 *
 * Each approach produces structurally different output. Only the
 * selected approach's guidance is injected to keep prompts lean.
 */
export const APPROACH_GUIDANCE: Record<(typeof APPROACHES)[number], string> = {
  NOSTALGIC_COMPARISON: `Compare today's version to how things were "in my day." The past was better, obviously. Specific prices, distances, and hardships sell it. "A NICKEL COULD BUY..." energy.`,

  UNSOLICITED_ADVICE: `Dispense wisdom nobody asked for, delivered with absolute certainty. "LET ME TELL YOU SOMETHING..." opener energy. The advice is oddly specific and strangely wise.`,

  RHETORICAL_QUESTION: `Ask questions you clearly already know the answer to. "YOU CALL THIS A BAGEL?" Build the case through incredulous questions. The answer is always obvious.`,

  GRUDGING_COMPLIMENT: `Admit something modern is actually good, but make it sound painful. Compliment wrapped in three layers of complaint. "OKAY SO MAYBE THE..." reluctant concession energy.`,

  DRAMATIC_RETELLING: `Recount a mundane event as if it were an epic saga. Waiting at the deli counter becomes a heroic ordeal. Specific times, names, and perceived slights required.`,

  PROVERB_TWIST: `Start with familiar wisdom, then twist it into something unexpectedly personal or cranky. "THEY SAY PATIENCE IS A VIRTUE..." then land somewhere only a zayde would go.`,

  CONSPIRACY_THEORY: `Develop a harmless, endearing conspiracy about everyday life. The grocery store rearranges aisles on purpose. The weather forecast is a personal vendetta. Delivered with total conviction.`,

  OPEN_LETTER: `Address the topic directly as if writing a formal complaint to it. "DEAR WHOEVER INVENTED..." Polite anger, the kind that cc's the manager.`,

  RUNNING_TALLY: `Keep score of specific grievances, tallying them up. Numbers and counts matter. "THATS THE FOURTH TIME..." Build a case through accumulated evidence.`,

  PHILOSOPHICAL_SHRUG: `Accept the absurdity of life with weary, Talmudic resignation. "SO IT GOES" energy. Find the cosmic humor in small indignities. The shrug IS the wisdom.`,
};

export type Approach = (typeof APPROACHES)[number];

/**
 * Generates wisdom from a sweet-but-cranky Bronx Jewish elder archetype
 *
 * Extends AIPromptGenerator with zayde-specific prompts,
 * MEDIUM model tier for character voice depth, and dual dictionary
 * selection (topic + approach) for content variety.
 */
export class ZaydeWisdomGenerator extends AIPromptGenerator {
  /**
   * Static access to topic dictionary for testing
   */
  static readonly TOPICS = TOPICS;

  /**
   * Static access to approach dictionary for testing
   */
  static readonly APPROACHES = APPROACHES;

  /**
   * Static access to approach guidance for testing
   */
  static readonly APPROACH_GUIDANCE = APPROACH_GUIDANCE;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedTopic: string = '';
  private selectedApproach: string = '';

  /**
   * Creates a new ZaydeWisdomGenerator instance
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
    // Use MEDIUM tier for character voice (needs context depth for authentic voice)
    super(promptLoader, modelTierSelector, ModelTier.MEDIUM, apiKeys);
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
   * Uses the zayde-wisdom prompt which specifies the character
   * archetype, tone, and Yiddish-sprinkled style.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'zayde-wisdom.txt';
  }

  /**
   * Selects a random topic from the TOPICS array
   *
   * @returns Randomly selected topic string
   */
  selectRandomTopic(): string {
    const randomIndex = Math.floor(Math.random() * TOPICS.length);
    return TOPICS[randomIndex];
  }

  /**
   * Selects a random approach from the APPROACHES array
   *
   * @returns Randomly selected approach string
   */
  selectRandomApproach(): Approach {
    return APPROACHES[Math.floor(Math.random() * APPROACHES.length)];
  }

  /**
   * Hook: Selects random topic and approach, returns as template variables.
   *
   * Topic is the WHAT (kvetch subject). Approach is the HOW (delivery pattern).
   * Approach guidance is injected selectively for the chosen approach only.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with payload (topic), approach, and approachGuidance
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedTopic = this.selectRandomTopic();
    const approach = this.selectRandomApproach();

    // Cache for metadata
    this.selectedApproach = approach;

    return {
      payload: this.selectedTopic,
      approach,
      approachGuidance: APPROACH_GUIDANCE[approach],
    };
  }

  /**
   * Hook: Returns selected topic and approach in metadata.
   *
   * @returns Metadata with the topic and approach used for generation
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      topic: this.selectedTopic,
      approach: this.selectedApproach,
    };
  }
}
