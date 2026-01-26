/**
 * Corporate Horoscope Generator
 *
 * Generates daily horoscopes written entirely in insufferable corporate
 * buzzword speak. Combines legitimate astrological concepts with business
 * jargon for maximum absurdity.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/corporate-horoscope.txt for content guidance
 * - Selects zodiac sign based on current date (which sign season it is)
 * - Randomly selects business context for variety
 * - Optimized with LIGHT model tier (comedic content, simple generation)
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects zodiac sign and business context
 * - getCustomMetadata(): Tracks which sign and context were selected
 *
 * @example
 * ```typescript
 * const generator = new CorporateHoroscopeGenerator(
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
 * console.log(content.text); // "CAPRICORN MERCURY..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Business contexts for horoscope variety
 *
 * These contexts add topical corporate flavor to the horoscope,
 * making each generation feel timely and specific.
 */
const BUSINESS_CONTEXTS = [
  'Q1 planning season',
  'Q2 performance reviews',
  'Q3 budget reconciliation',
  'Q4 year-end crunch',
  'annual reorg announcement',
  'mandatory team building event',
  'open enrollment period',
  'all-hands meeting prep',
  'strategic pivot initiative',
  'headcount freeze',
  'digital transformation rollout',
  'synergy optimization sprint',
] as const;

/**
 * Zodiac sign date ranges
 *
 * Each entry defines the start month/day for a zodiac sign.
 * Signs are ordered by their start date throughout the year.
 */
const ZODIAC_SIGNS = [
  { sign: 'Capricorn', startMonth: 1, startDay: 1 }, // Jan 1-19
  { sign: 'Aquarius', startMonth: 1, startDay: 20 }, // Jan 20 - Feb 18
  { sign: 'Pisces', startMonth: 2, startDay: 19 }, // Feb 19 - Mar 20
  { sign: 'Aries', startMonth: 3, startDay: 21 }, // Mar 21 - Apr 19
  { sign: 'Taurus', startMonth: 4, startDay: 20 }, // Apr 20 - May 20
  { sign: 'Gemini', startMonth: 5, startDay: 21 }, // May 21 - Jun 20
  { sign: 'Cancer', startMonth: 6, startDay: 21 }, // Jun 21 - Jul 22
  { sign: 'Leo', startMonth: 7, startDay: 23 }, // Jul 23 - Aug 22
  { sign: 'Virgo', startMonth: 8, startDay: 23 }, // Aug 23 - Sep 22
  { sign: 'Libra', startMonth: 9, startDay: 23 }, // Sep 23 - Oct 22
  { sign: 'Scorpio', startMonth: 10, startDay: 23 }, // Oct 23 - Nov 21
  { sign: 'Sagittarius', startMonth: 11, startDay: 22 }, // Nov 22 - Dec 21
  { sign: 'Capricorn', startMonth: 12, startDay: 22 }, // Dec 22-31
] as const;

/**
 * Generates corporate jargon horoscopes
 *
 * Extends AIPromptGenerator with horoscope-specific prompts,
 * zodiac sign selection based on current date, and random
 * business context for variety.
 */
export class CorporateHoroscopeGenerator extends AIPromptGenerator {
  /**
   * Selected zodiac sign for the current generation
   */
  private selectedSign: string = '';

  /**
   * Selected business context for the current generation
   */
  private selectedContext: string = '';

  /**
   * Creates a new CorporateHoroscopeGenerator instance
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
    // Use LIGHT tier for comedic content (simple, fast and cheap)
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
   * Uses the corporate horoscope prompt which specifies the
   * corporate jargon requirements and astrological framing.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'corporate-horoscope.txt';
  }

  /**
   * Determines the current zodiac sign based on date
   *
   * Returns the zodiac sign whose "season" the current date falls within.
   * This provides natural variety (changes monthly) while being deterministic.
   *
   * @param date - Date to calculate zodiac sign for (defaults to now)
   * @returns The zodiac sign name (e.g., "Capricorn", "Aquarius")
   */
  public getCurrentZodiacSign(date: Date = new Date()): string {
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();

    // Find the sign for the current date
    // Iterate backwards through signs to find the most recent start date
    for (let i = ZODIAC_SIGNS.length - 1; i >= 0; i--) {
      const zodiac = ZODIAC_SIGNS[i];
      if (
        month > zodiac.startMonth ||
        (month === zodiac.startMonth && day >= zodiac.startDay)
      ) {
        return zodiac.sign;
      }
    }

    // Fallback to Capricorn (shouldn't happen with proper date ranges)
    return 'Capricorn';
  }

  /**
   * Selects a random business context
   *
   * @returns Random business context string
   */
  private getRandomBusinessContext(): string {
    const randomIndex = Math.floor(Math.random() * BUSINESS_CONTEXTS.length);
    return BUSINESS_CONTEXTS[randomIndex];
  }

  /**
   * Hook: Returns template variables for prompt injection
   *
   * Selects the current zodiac sign and a random business context
   * to inject into the prompt template.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with zodiacSign and businessContext
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedSign = this.getCurrentZodiacSign();
    this.selectedContext = this.getRandomBusinessContext();

    return {
      zodiacSign: this.selectedSign,
      businessContext: this.selectedContext,
    };
  }

  /**
   * Hook: Returns metadata about the generation
   *
   * Tracks which zodiac sign and business context were used
   * for debugging and analytics purposes.
   *
   * @returns Metadata with sign and context used
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      zodiacSign: this.selectedSign,
      businessContext: this.selectedContext,
    };
  }
}
