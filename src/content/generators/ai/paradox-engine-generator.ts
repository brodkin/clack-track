/**
 * Paradox Engine Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * logical paradoxes applied to relatable everyday situations.
 *
 * CRITICAL DESIGN: Uses CURATED paradox database + relatable applications.
 * Novel paradox generation is unsolved by AI - humor comes from the
 * APPLICATION of well-known paradoxes to everyday contexts, not from
 * generating new paradoxes.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/logical-paradox.txt for paradox content guidance
 * - Curated database of 50+ classic logical paradoxes
 * - 30+ relatable everyday application contexts
 * - Optimized with LIGHT model tier (selection + application, not generation)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects paradox and application into prompt
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * @example
 * ```typescript
 * const generator = new ParadoxEngineGenerator(
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
 * console.log(content.text);
 * // "SHIP OF THESEUS:
 * //  IS YOUR COUCH STILL
 * //  THE SAME COUCH AFTER
 * //  ALL THOSE STAINS"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Generates logical paradoxes applied to relatable everyday situations
 *
 * Uses a curated database of classic paradoxes and applies them to
 * everyday contexts for humor and philosophical reflection.
 */
export class ParadoxEngineGenerator extends AIPromptGenerator {
  /**
   * Curated database of classic logical paradoxes
   *
   * These are well-known paradoxes that don't require AI generation.
   * The AI's job is to apply them creatively to everyday contexts.
   */
  static readonly PARADOX_DATABASE: readonly string[] = [
    'SHIP_OF_THESEUS',
    'LIARS_PARADOX',
    'GRANDFATHER',
    'BOOTSTRAP',
    'ZENO_ARROW',
    'SORITES',
    'OMNIPOTENCE',
    'FERMI',
    'BRAESS',
    'SIMPSONS',
    'BIRTHDAY',
    'MONTY_HALL',
    'BARBER',
    'CROCODILE',
    'ACHILLES_TORTOISE',
    'BURIDAN_DONKEY',
    'TWINS',
    'NEWCOMB',
    'UNEXPECTED_HANGING',
    'RAVENS',
    'HEAP',
    'EPIMENIDES',
    'RUSSELL',
    'BANACH_TARSKI',
    'HILBERT_HOTEL',
    'GALILEO',
    'DICHOTOMY',
    'GRELLING_NELSON',
    'CURRY',
    'YABLO',
    'ROSS_LITTLEWOOD',
    'TWO_ENVELOPE',
    'SLEEPING_BEAUTY',
    'DOOMSDAY',
    'SIMULATION',
    'TROLLEY',
    'TELEPORTER',
    'THESEUS_AXLE',
    'COASTLINE',
    'RAVEN_BLACK',
    'GETTIER',
    'MOORE',
    'SURPRISE_TEST',
    'KAVKA_TOXIN',
    'COUNTERFACTUAL',
    'VOTING',
    'PREFACE',
    'LOTTERY',
    'FITCH',
    'SORENSEN',
  ] as const;

  /**
   * Relatable everyday application contexts
   *
   * These contexts make the paradoxes accessible and humorous
   * by grounding abstract philosophy in daily life.
   */
  static readonly APPLICATION_CONTEXTS: readonly string[] = [
    'YOUR_COUCH',
    'YOUR_PLAYLIST',
    'YOUR_RELATIONSHIP',
    'MONDAY_MORNINGS',
    'YOUR_COFFEE_ORDER',
    'YOUR_CHILDHOOD_HOME',
    'YOUR_FAVORITE_BAND',
    'YOUR_WARDROBE',
    'YOUR_TO_DO_LIST',
    'YOUR_STREAMING_QUEUE',
    'YOUR_GYM_MEMBERSHIP',
    'YOUR_DIET',
    'YOUR_SOCIAL_MEDIA',
    'YOUR_SAVINGS_ACCOUNT',
    'YOUR_SLEEP_SCHEDULE',
    'YOUR_HOBBIES',
    'YOUR_COMMUTE',
    'YOUR_HAIRCUT',
    'YOUR_HOUSEPLANTS',
    'YOUR_FRIDGE_CONTENTS',
    'YOUR_EMAIL_INBOX',
    'YOUR_PHONE_BATTERY',
    'YOUR_WI_FI_SIGNAL',
    'YOUR_LUNCH_CHOICE',
    'YOUR_PARKING_SPOT',
    'YOUR_WEEKEND_PLANS',
    'YOUR_NEW_YEARS_RESOLUTION',
    'YOUR_LAUNDRY_PILE',
    'YOUR_BROWSER_TABS',
    'YOUR_LEFTOVERS',
    'YOUR_MEETING_SCHEDULE',
  ] as const;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedParadox: string = '';
  private selectedApplication: string = '';

  /**
   * Creates a new ParadoxEngineGenerator instance
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
    // Use LIGHT tier for paradox application (selection + application, not generation)
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
   * Uses the logical-paradox prompt which specifies instructions for
   * applying curated paradoxes to everyday situations.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'logical-paradox.txt';
  }

  /**
   * Selects a random paradox from the curated database
   *
   * @returns A randomly selected paradox identifier
   */
  private selectRandomParadox(): string {
    const index = Math.floor(Math.random() * ParadoxEngineGenerator.PARADOX_DATABASE.length);
    return ParadoxEngineGenerator.PARADOX_DATABASE[index];
  }

  /**
   * Selects a random application context
   *
   * @returns A randomly selected application context
   */
  private selectRandomApplication(): string {
    const index = Math.floor(Math.random() * ParadoxEngineGenerator.APPLICATION_CONTEXTS.length);
    return ParadoxEngineGenerator.APPLICATION_CONTEXTS[index];
  }

  /**
   * Hook: Selects random paradox and application, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with paradox and application (spaces instead of underscores)
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedParadox = this.selectRandomParadox();
    this.selectedApplication = this.selectRandomApplication();

    return {
      paradox: this.selectedParadox.replace(/_/g, ' '),
      application: this.selectedApplication.replace(/_/g, ' '),
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with paradox and application (original format with underscores)
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      paradox: this.selectedParadox,
      application: this.selectedApplication,
    };
  }
}
