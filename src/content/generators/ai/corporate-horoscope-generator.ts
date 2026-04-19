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
 * Corporate buzzword pool
 *
 * A random subset of 5 is selected per generation to prevent
 * the LLM from gravitating to the same high-frequency terms.
 */
const CORPORATE_BUZZWORDS = [
  'synergy',
  'leverage',
  'bandwidth',
  'deliverables',
  'circle back',
  'take offline',
  'low-hanging fruit',
  'move the needle',
  'deep dive',
  'pivot',
  'actionable',
  'stakeholder',
  'optimize',
  'scalable',
  'runway',
  'align',
  'unpack',
  'ecosystem',
  'paradigm shift',
  'value proposition',
  'thought leadership',
  'boil the ocean',
  'net-net',
  'tiger team',
  'north star',
  'right-size',
  'ideate',
  'cross-pollinate',
  'cadence',
  'guardrails',
  'swim lane',
  'table stakes',
  'headwinds',
  'double-click',
] as const;

/**
 * Planet pool with corporate mappings
 *
 * Rotated per-generation to prevent Mercury/Saturn dominance.
 * Each entry pairs a planet with its corporate concept — the LLM
 * receives one per generation and must anchor the horoscope on it.
 */
const PLANETS = [
  'Mercury (communications/email)',
  'Venus (stakeholder relationships)',
  'Mars (aggressive timelines)',
  'Jupiter (growth metrics)',
  'Saturn (compliance/legal)',
  'Uranus (disruptive innovation)',
  'Neptune (vision alignment)',
  'Pluto (organizational transformation)',
] as const;

/**
 * House pool with department mappings
 *
 * All 12 astrological houses mapped to plausible corporate departments.
 * One is selected per generation as the department focus.
 */
const HOUSES = [
  '1st house (personal brand)',
  '2nd house (compensation/salary)',
  '3rd house (internal communications)',
  '4th house (work-life balance)',
  '5th house (creative deliverables)',
  '6th house (daily operations)',
  '7th house (partnerships)',
  '8th house (shared resources/M&A)',
  '9th house (corporate philosophy)',
  '10th house (leadership visibility)',
  '11th house (team alignment)',
  '12th house (hidden blockers)',
] as const;

/**
 * Aspect pool with corporate mappings
 *
 * Astrological aspects paired with corporate concepts. One is selected
 * per generation to vary the tension/alignment angle of the horoscope.
 */
const ASPECTS = [
  'Retrograde (circle back / revisit action items)',
  'Conjunction (alignment session)',
  'Opposition (competing priorities)',
  'Trine (natural synergies)',
  'Square (friction with stakeholders)',
  'Sextile (productive collaboration opportunity)',
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
   * Selected buzzwords for the current generation
   */
  private selectedBuzzwords: string[] = [];

  /**
   * Selected planet for the current generation
   */
  private selectedPlanet: string = '';

  /**
   * Selected house for the current generation
   */
  private selectedHouse: string = '';

  /**
   * Selected aspect for the current generation
   */
  private selectedAspect: string = '';

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
   * Selects a random subset of buzzwords without replacement
   *
   * @returns Array of 5 unique buzzword strings
   */
  private selectRandomBuzzwords(): string[] {
    const pool = [...CORPORATE_BUZZWORDS];
    const selected: string[] = [];

    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      selected.push(pool[randomIndex]);
      pool.splice(randomIndex, 1);
    }

    return selected;
  }

  /**
   * Selects a random planet with its corporate mapping
   *
   * @returns A random planet string (e.g., "Jupiter (growth metrics)")
   */
  private getRandomPlanet(): string {
    return PLANETS[Math.floor(Math.random() * PLANETS.length)];
  }

  /**
   * Selects a random house with its department mapping
   *
   * @returns A random house string (e.g., "4th house (work-life balance)")
   */
  private getRandomHouse(): string {
    return HOUSES[Math.floor(Math.random() * HOUSES.length)];
  }

  /**
   * Selects a random astrological aspect with its corporate mapping
   *
   * @returns A random aspect string (e.g., "Opposition (competing priorities)")
   */
  private getRandomAspect(): string {
    return ASPECTS[Math.floor(Math.random() * ASPECTS.length)];
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
    this.selectedBuzzwords = this.selectRandomBuzzwords();
    this.selectedPlanet = this.getRandomPlanet();
    this.selectedHouse = this.getRandomHouse();
    this.selectedAspect = this.getRandomAspect();

    return {
      zodiacSign: this.selectedSign,
      businessContext: this.selectedContext,
      selectedBuzzwords: this.selectedBuzzwords.join(', '),
      selectedPlanet: this.selectedPlanet,
      selectedHouse: this.selectedHouse,
      selectedAspect: this.selectedAspect,
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
      selectedBuzzwords: this.selectedBuzzwords,
      selectedPlanet: this.selectedPlanet,
      selectedHouse: this.selectedHouse,
      selectedAspect: this.selectedAspect,
    };
  }
}
