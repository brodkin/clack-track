/**
 * No Thank You Generator
 *
 * Generates edgy, punchy phrases that always start with "NO THANK YOU,"
 * followed by a short provocative statement that implies a wild backstory
 * without explaining it. The humor comes from what's left unsaid.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/no-thank-you.txt for content guidance
 * - Dual variety dimensions: scenarios (64) x tones (16) = 1024 combinations
 * - Optimized with LIGHT model tier (short, punchy content)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects randomly selected scenario and tone
 * - getCustomMetadata(): Tracks which scenario and tone were selected
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GenerationContext } from '../../../types/content-generator.js';

/**
 * Social scenarios that provide context for the "no thank you" refusal.
 * Each scenario implies a different social situation, giving the AI
 * a specific context to riff on while keeping the output mysterious.
 *
 * 64 scenarios across 8 categories for strong variety.
 */
export const NO_THANK_YOU_SCENARIOS: readonly string[] = [
  // Social gatherings (8)
  'at a dinner party',
  'at a wedding reception',
  'at a house party',
  'at a family reunion',
  'at a work happy hour',
  'at a neighborhood barbecue',
  'at a baby shower',
  'at a housewarming party',
  // Professional situations (8)
  'in a job interview',
  'in a board meeting',
  'at a networking event',
  'during a performance review',
  'at an office potluck',
  'during a team building exercise',
  'at a business lunch',
  'during a company retreat',
  // Dating & romance (8)
  'on a first date',
  'on a blind date',
  'at a singles mixer',
  'meeting the in-laws',
  'at a couples retreat',
  'during a proposal',
  'at an ex\'s wedding',
  'at a speed dating event',
  // Travel & adventure (8)
  'at airport security',
  'on a cruise ship',
  'at a resort all-inclusive bar',
  'at customs in a foreign country',
  'on a group tour',
  'at a roadside diner at 3am',
  'in a taxi in another country',
  'at a hotel check-in',
  // Food & drink (8)
  'at a wine tasting',
  'at a tequila bar',
  'at a fancy restaurant',
  'at a food truck festival',
  'at a cooking class',
  'at a potluck where someone brought something suspicious',
  'at a tasting menu dinner',
  'at a mixology class',
  // Medical & wellness (8)
  'at a doctor\'s appointment',
  'at the dentist',
  'at a wellness retreat',
  'at a spa day',
  'at a therapy session',
  'at a fitness class',
  'at a meditation circle',
  'at a juice cleanse orientation',
  // Retail & services (8)
  'at a car dealership',
  'in a timeshare presentation',
  'at a salon',
  'at a tattoo parlor',
  'at a psychic reading',
  'at a mall kiosk',
  'at an open house',
  'at an auction',
  // Unexpected situations (8)
  'during a police ride-along',
  'at a PTA meeting',
  'at jury duty',
  'at a HOA meeting',
  'during a lie detector test',
  'at a seance',
  'at a stranger\'s funeral',
  'during a fire drill',
] as const;

/**
 * Tone modifiers that shape how the refusal is delivered.
 * Each tone creates a different comedic flavor while maintaining
 * the core mystery of the implied backstory.
 *
 * 16 tones for structural variety in delivery.
 */
export const NO_THANK_YOU_TONES: readonly string[] = [
  // Cool & collected
  'casual and unbothered, like this is totally normal',
  'mysteriously calm, as if hiding a secret',
  'breezy nonchalance, like someone who\'s seen it all',
  'deadpan delivery with zero explanation',
  // Dramatic & theatrical
  'dramatically firm, as if drawing a line in the sand',
  'cryptically ominous, hinting at past disasters',
  'theatrically weary, like someone with a long history',
  'pointedly specific in a way that raises more questions',
  // Confident & bold
  'supremely confident, already has a better plan',
  'unapologetically honest about something unexpected',
  'matter-of-fact about something clearly outrageous',
  'cheerfully unhinged, smiling through chaos',
  // Mischievous & playful
  'slyly implying there\'s a much better story',
  'wickedly suggestive without crossing any lines',
  'playfully evasive, dodging the real reason',
  'knowingly vague, as if everyone should already know why',
] as const;

/**
 * Generates "NO THANK YOU" phrases with implied wild backstories
 *
 * Extends AIPromptGenerator with dual variety dimensions (scenario + tone)
 * to ensure high output diversity. Each generation randomly selects one
 * scenario and one tone, creating 1024 unique input combinations.
 */
export class NoThankYouGenerator extends AIPromptGenerator {
  /** Selected scenario for the current generation */
  private selectedScenario: string = '';

  /** Selected tone for the current generation */
  private selectedTone: string = '';

  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    super(promptLoader, modelTierSelector, ModelTier.LIGHT, apiKeys);
  }

  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  protected getUserPromptFile(): string {
    return 'no-thank-you.txt';
  }

  /**
   * Hook: Selects random scenario and tone for prompt injection.
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedScenario = this.selectRandom(NO_THANK_YOU_SCENARIOS);
    this.selectedTone = this.selectRandom(NO_THANK_YOU_TONES);

    return {
      scenario: this.selectedScenario,
      tone: this.selectedTone,
    };
  }

  /**
   * Hook: Returns selected scenario and tone in metadata.
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedScenario: this.selectedScenario,
      selectedTone: this.selectedTone,
    };
  }

  private selectRandom<T>(array: readonly T[]): T {
    const index = Math.floor(Math.random() * array.length);
    return array[index];
  }
}
