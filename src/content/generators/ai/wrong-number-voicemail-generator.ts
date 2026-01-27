/**
 * Wrong Number Voicemail Generator
 *
 * Generates fragments of voicemail messages clearly meant for someone else.
 * The viewer gets a glimpse into bizarre situations they were never supposed
 * to know about, creating humor through mystery and unexplained context.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/wrong-number-voicemail.txt for voicemail content guidance
 * - Variety via CALLER_ARCHETYPES (15), SITUATION_DOMAINS (20), URGENCY_LEVELS (4)
 * - 1,200+ unique combinations ensure high content variability
 * - Optimized with LIGHT model tier for efficiency
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects callerArchetype, situationDomain, urgencyLevel
 * - getCustomMetadata(): Tracks selections in generation metadata
 *
 * Dictionary design principle: Seeds, not scripts. Dictionaries provide
 * categorical guidance (e.g., "ANIMAL_INCIDENT") rather than specific
 * scenarios (e.g., "bees escaped"), giving the LLM creative freedom.
 *
 * @example
 * ```typescript
 * const generator = new WrongNumberVoicemailGenerator(
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
 * // "HEY ITS LINDA
 * //  THE GEESE ARE BACK
 * //  AND THEYRE IN YOUR
 * //  GARAGE THIS TIME
 * //  CALL ME NOW"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GenerationContext } from '../../../types/content-generator.js';
import {
  CALLER_ARCHETYPES,
  SITUATION_DOMAINS,
  URGENCY_LEVELS,
  selectRandomItem,
  type CallerArchetype,
  type SituationDomain,
  type UrgencyLevel,
} from './wrong-number-voicemail-dictionaries.js';

/**
 * Generates wrong number voicemail fragments
 *
 * Extends AIPromptGenerator with voicemail-specific prompts,
 * efficient LIGHT model tier selection, and variety dimensions
 * for caller archetype, situation domain, and urgency level.
 *
 * Uses the getTemplateVariables hook to inject randomly selected
 * parameters into prompts, and getCustomMetadata to track
 * the selections in generation metadata.
 */
export class WrongNumberVoicemailGenerator extends AIPromptGenerator {
  /**
   * Stores the selected caller archetype for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedArchetype: CallerArchetype = 'FRANTIC_NEIGHBOR';

  /**
   * Stores the selected situation domain for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedDomain: SituationDomain = 'ANIMAL_INCIDENT';

  /**
   * Stores the selected urgency level for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedUrgency: UrgencyLevel = 'FULL_PANIC';

  /**
   * Creates a new WrongNumberVoicemailGenerator instance
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
    // Use LIGHT tier for voicemails (simple content, fast and cheap)
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
   * Uses the wrong-number-voicemail prompt which specifies
   * the voicemail format, conventions, and humor guidelines.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'wrong-number-voicemail.txt';
  }

  /**
   * Hook: Selects random archetype, domain, and urgency for prompt injection.
   *
   * Selections are stored in instance properties for metadata tracking.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables for prompt placeholders
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedArchetype = selectRandomItem(CALLER_ARCHETYPES);
    this.selectedDomain = selectRandomItem(SITUATION_DOMAINS);
    this.selectedUrgency = selectRandomItem(URGENCY_LEVELS);

    return {
      callerArchetype: this.selectedArchetype,
      situationDomain: this.selectedDomain,
      urgencyLevel: this.selectedUrgency,
    };
  }

  /**
   * Hook: Returns metadata with selected parameters for tracking.
   *
   * @returns Metadata with callerArchetype, situationDomain, and urgencyLevel
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      callerArchetype: this.selectedArchetype,
      situationDomain: this.selectedDomain,
      urgencyLevel: this.selectedUrgency,
    };
  }
}
