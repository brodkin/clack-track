/**
 * Compliment Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * genuine compliments and affirmations directed at the viewer.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/compliment.txt for compliment content guidance
 * - Topic and style dictionaries for high-effectiveness variability
 * - Random topic/style injection via {{topic}} and {{style}} template variables
 * - Optimized with LIGHT model tier for efficiency (simple messages)
 * - Uses second-person voice ('you') for direct, personal connection
 * - Wholesome, uplifting tone - occasionally cheeky but always kind
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects randomly selected topic and style
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * Variability System:
 * - COMPLIMENT_TOPICS (20+ items): What to compliment (e.g., "your energy today")
 * - COMPLIMENT_STYLES (8+ items): How to deliver it (e.g., "sincere", "over-the-top dramatic")
 * - Random selection ensures varied outputs across generations
 *
 * @example
 * ```typescript
 * const generator = new ComplimentGenerator(
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
 * console.log(content.text); // "HEY YOU\nYOU'RE DOING GREAT\nKEEP IT UP CHAMP"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Topics/subjects to compliment the viewer about
 *
 * Covers diverse areas: personality, abilities, presence, effort, taste, impact
 * Each topic should work naturally in the phrase "compliment about [topic]"
 */
export const COMPLIMENT_TOPICS: readonly string[] = [
  // Personality & Vibe
  'your energy today',
  'your positive attitude',
  'your unique vibe',
  'your contagious smile',
  'your calm presence',

  // Abilities & Skills
  'your creativity',
  'your problem-solving skills',
  'your hustle and work ethic',
  'your attention to detail',
  'your ability to stay focused',

  // Taste & Style
  'your taste in music',
  'your fashion sense',
  'your home decor choices',
  'your excellent taste in friends',
  'your playlist selections',

  // Impact & Presence
  'the way you light up a room',
  'your impact on others',
  'how you make people feel welcome',
  'your thoughtful gestures',
  'the effect you have on the mood',

  // Effort & Growth
  'how hard you work',
  'your dedication to improvement',
  'the progress you have made',
  'your resilience through challenges',
  'your commitment to your goals',
] as const;

/**
 * Delivery styles for compliments
 *
 * Controls the tone and approach - from sincere to absurdist
 * Each style creates a distinctly different feel for the compliment
 */
export const COMPLIMENT_STYLES: readonly string[] = [
  'sincere and heartfelt',
  'over-the-top dramatic',
  'poetic and lyrical',
  'absurdist but endearing',
  'casual and breezy',
  'hype man energy',
  'gentle and encouraging',
  'playfully exaggerated',
  'warm and cozy',
  'confidently matter-of-fact',
] as const;

/**
 * Generates genuine compliments and affirmations for the viewer
 *
 * Extends AIPromptGenerator with compliment-specific prompts,
 * efficient LIGHT model tier selection, and variability dictionaries.
 * Uses second-person voice for a direct, personal connection with the reader.
 *
 * Injects random {{topic}} and {{style}} via template variables to ensure
 * each generation produces meaningfully different content.
 */
export class ComplimentGenerator extends AIPromptGenerator {
  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedTopic: string = '';
  private selectedStyle: string = '';

  /**
   * Creates a new ComplimentGenerator instance
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
    // Use LIGHT tier for compliments (simple content, fast and cheap)
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
   * Uses the compliment prompt which specifies the content type,
   * structure, and tone for genuine, uplifting compliments.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'compliment.txt';
  }

  /**
   * Selects a random topic from the COMPLIMENT_TOPICS dictionary
   *
   * @returns A randomly selected compliment topic
   */
  selectRandomTopic(): string {
    const index = Math.floor(Math.random() * COMPLIMENT_TOPICS.length);
    return COMPLIMENT_TOPICS[index];
  }

  /**
   * Selects a random style from the COMPLIMENT_STYLES dictionary
   *
   * @returns A randomly selected compliment style
   */
  selectRandomStyle(): string {
    const index = Math.floor(Math.random() * COMPLIMENT_STYLES.length);
    return COMPLIMENT_STYLES[index];
  }

  /**
   * Hook: Selects random topic and style, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with topic and style
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedTopic = this.selectRandomTopic();
    this.selectedStyle = this.selectRandomStyle();

    return {
      topic: this.selectedTopic,
      style: this.selectedStyle,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with selectedTopic and selectedStyle
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedTopic: this.selectedTopic,
      selectedStyle: this.selectedStyle,
    };
  }
}
