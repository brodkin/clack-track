/**
 * One-Star Review Generator
 *
 * Generates satirical one-star reviews of concepts, phenomena, and universal
 * experiences that cannot actually be rated. The humor comes from applying
 * consumer review tropes to existence itself.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/one-star-review.txt for review format guidance
 * - Uses LIGHT model tier for cost efficiency
 * - Injects subject inspiration and style-specific guidance
 * - Inherits retry logic and provider failover from base class
 *
 * DESIGN PHILOSOPHY:
 * The subject dictionary provides INSPIRATION, not literal requirements.
 * The LLM can pivot freely to find the funniest angle. Style guidance
 * is injected selectively based on random selection.
 *
 * @example
 * ```typescript
 * const generator = new OneStarReviewGenerator(
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
 * console.log(content.text); // "1 STAR\nORDERED CONSCIOUSNESS..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Subject categories for one-star reviews
 *
 * These are INSPIRATIONAL starting points. The LLM can pivot freely
 * to find the funniest angle - these just provide creative springboards.
 */
export const REVIEW_SUBJECTS = {
  // Cosmic & Existential (beyond our control)
  COSMIC: [
    'existence',
    'consciousness',
    'the passage of time',
    'mortality',
    'the void',
    'being sentient',
    'free will',
    'reality',
    'being alive',
  ],

  // Natural Phenomena (unchangeable features)
  NATURAL: [
    'gravity',
    'entropy',
    'weather',
    'seasons changing',
    'the sun',
    'sleep requirements',
    'aging',
    'needing to eat',
    'circadian rhythm',
  ],

  // Time-Based (calendar grievances)
  TEMPORAL: [
    'Mondays',
    'mornings',
    '3am thoughts',
    'waiting',
    'deadlines',
    'the weekend being only 2 days',
    'time zones',
    'daylight savings',
  ],

  // Social Constructs (human inventions we endure)
  SOCIAL: [
    'small talk',
    'networking events',
    'reply all emails',
    'terms and conditions',
    'hold music',
    'meetings that could be emails',
    'voicemail',
  ],

  // Modern Life (contemporary frustrations)
  MODERN: [
    'adulting',
    'algorithms',
    'notifications',
    'infinite scroll',
    'captchas',
    'password requirements',
    'software updates',
    'buffering',
  ],

  // Physical Reality (body complaints)
  PHYSICAL: [
    'needing sleep',
    'having a body',
    'temperature sensitivity',
    'the need for oxygen',
    'physical form',
    'having bones',
  ],

  // Expectations vs Reality (disappointments)
  EXPECTATIONS: [
    'adulthood vs the brochure',
    'the future we were promised',
    'jet packs not existing',
    'flying cars never happening',
    'work life balance',
  ],
} as const;

/**
 * Review style types
 */
export const REVIEW_STYLES = [
  'VENTING',
  'SATIRIC',
  'ACADEMIC',
  'MAD_AT_MANAGEMENT',
  'ENTITLED_CUSTOMER',
  'DISAPPOINTED_EXPECTATIONS',
  'WOULD_NOT_RECOMMEND',
] as const;

/**
 * Style-specific guidance injected into prompts
 *
 * Each style produces structurally different output. Only the
 * selected style's guidance is injected to keep prompts lean.
 */
export const STYLE_GUIDANCE: Record<(typeof REVIEW_STYLES)[number], string> = {
  VENTING: `Caps-lock rage energy. "I WAITED 9 MONTHS FOR THIS?" The kind of person who asks for the manager of the universe.`,

  SATIRIC: `Dry, understated disappointment. British complaint letter energy. Deadpan observations about cosmic design flaws.`,

  ACADEMIC: `Peer-review formality for trivial complaints. "Upon extensive testing over 40 years..." Grant proposal energy.`,

  MAD_AT_MANAGEMENT: `Complaints directed at whoever designed this. "I NEED TO SPEAK TO WHOEVER MADE GRAVITY." Performance review for reality.`,

  ENTITLED_CUSTOMER: `Unreasonable expectations. "I was promised eternal happiness." Demanding refunds from the void.`,

  DISAPPOINTED_EXPECTATIONS: `Gap between marketing and reality. "The brochure showed flying cars." Unmet promises of adulthood.`,

  WOULD_NOT_RECOMMEND: `Public service announcement energy. "AVOID AT ALL COSTS." Consumer protection for existence.`,
};

export type ReviewSubjectCategory = keyof typeof REVIEW_SUBJECTS;
export type ReviewStyle = (typeof REVIEW_STYLES)[number];

/**
 * Generates one-star reviews of unrateable things
 *
 * Extends AIPromptGenerator with review-specific prompts,
 * LIGHT model tier for efficiency, and random subject/style
 * injection for content variety.
 */
export class OneStarReviewGenerator extends AIPromptGenerator {
  /**
   * Static access to review subjects for testing
   */
  static readonly REVIEW_SUBJECTS = REVIEW_SUBJECTS;

  /**
   * Static access to review styles for testing
   */
  static readonly REVIEW_STYLES = REVIEW_STYLES;

  /**
   * Static access to style guidance for testing
   */
  static readonly STYLE_GUIDANCE = STYLE_GUIDANCE;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedCategory: string = '';
  private selectedSubject: string = '';
  private selectedStyle: string = '';

  /**
   * Creates a new OneStarReviewGenerator instance
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
    return 'one-star-review.txt';
  }

  /**
   * Selects a random subject category and subject within it
   */
  selectRandomSubject(): { category: string; subject: string } {
    const categoryKeys = Object.keys(REVIEW_SUBJECTS) as ReviewSubjectCategory[];
    const randomCategory = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const subjects = REVIEW_SUBJECTS[randomCategory];
    const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];

    return {
      category: randomCategory,
      subject: randomSubject,
    };
  }

  /**
   * Selects a random review style
   */
  selectRandomStyle(): ReviewStyle {
    return REVIEW_STYLES[Math.floor(Math.random() * REVIEW_STYLES.length)];
  }

  /**
   * Hook: Selects random subject and style, returns as template variables.
   *
   * Subject is positioned as inspiration (LLM can pivot freely).
   * Style guidance is injected selectively for the chosen style only.
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const { category, subject } = this.selectRandomSubject();
    const style = this.selectRandomStyle();

    // Cache for metadata
    this.selectedCategory = category;
    this.selectedSubject = subject;
    this.selectedStyle = style;

    return {
      reviewSubject: subject,
      reviewStyle: style,
      styleGuidance: STYLE_GUIDANCE[style],
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      category: this.selectedCategory,
      subject: this.selectedSubject,
      style: this.selectedStyle,
    };
  }
}
