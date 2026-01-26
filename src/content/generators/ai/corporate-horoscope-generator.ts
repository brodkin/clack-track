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
 * - Randomly selects zodiac sign for variety and inclusivity
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
 * All twelve zodiac signs
 *
 * Randomly selected for each generation to provide variety
 * and be inclusive of all audience members regardless of birth date.
 */
const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

/**
 * Generates corporate jargon horoscopes
 *
 * Extends AIPromptGenerator with horoscope-specific prompts,
 * random zodiac sign selection for variety and inclusivity,
 * and random business context for topical flavor.
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
   * Selects a random zodiac sign
   *
   * Randomly picks from all 12 zodiac signs to provide variety
   * and be inclusive of all audience members.
   *
   * @returns A random zodiac sign name (e.g., "Capricorn", "Gemini")
   */
  private getRandomZodiacSign(): string {
    const randomIndex = Math.floor(Math.random() * ZODIAC_SIGNS.length);
    return ZODIAC_SIGNS[randomIndex];
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
   * Selects a random zodiac sign and business context
   * to inject into the prompt template.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with zodiacSign and businessContext
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedSign = this.getRandomZodiacSign();
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
