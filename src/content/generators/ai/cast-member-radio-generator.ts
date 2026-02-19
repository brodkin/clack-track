/**
 * Cast Member Radio Generator
 *
 * Generates intercepted walkie-talkie chatter between Cast Members at
 * the original Disneyland in Anaheim. The humor comes from the collision
 * between professional radio protocol and the absurd reality of theme
 * park operations — the mundane maintenance of magic.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/cast-member-radio.txt for radio chatter guidance
 * - Variety via CALLER_STATIONS (25), SITUATION_DOMAINS (20), URGENCY_LEVELS (5)
 * - 2,500+ unique combinations ensure high content variability
 * - Optimized with LIGHT model tier for efficiency
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects callerStation, situationDomain, urgencyLevel
 * - getCustomMetadata(): Tracks selections in generation metadata
 *
 * Dictionary design principle: Seeds, not scripts. Stations reference real
 * Disneyland locations (Jungle Cruise, Haunted Mansion, Space Mountain), but
 * the LLM invents the Cast Member's voice, the specific incident, and the
 * absurd details.
 *
 * IMPORTANT: This generator is scoped to the ORIGINAL Disneyland in Anaheim
 * only — no Walt Disney World, no overseas parks, no general Disney properties.
 *
 * @example
 * ```typescript
 * const generator = new CastMemberRadioGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   updateType: 'major',
 *   timestamp: new Date()
 * });
 *
 * console.log(content.text);
 * // "JUNGLE CRUISE TO BASE
 * //  HIPPO 3 IS STUCK AGAIN
 * //  GUEST TRIED TO FEED IT
 * //  A TURKEY LEG
 * //  SEND MAINTENANCE"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ModelTier, type GenerationContext } from '../../../types/content-generator.js';
import {
  CALLER_STATIONS,
  SITUATION_DOMAINS,
  URGENCY_LEVELS,
  selectRandomItem,
  type CallerStation,
  type SituationDomain,
  type UrgencyLevel,
} from './cast-member-radio-dictionaries.js';

/**
 * Generates intercepted Disneyland Cast Member radio chatter
 *
 * Extends AIPromptGenerator with Disneyland-specific prompts,
 * efficient LIGHT model tier selection, and variety dimensions
 * for caller station, situation domain, and urgency level.
 *
 * Uses the getTemplateVariables hook to inject randomly selected
 * parameters into prompts, and getCustomMetadata to track
 * the selections in generation metadata.
 */
export class CastMemberRadioGenerator extends AIPromptGenerator {
  /**
   * Stores the selected caller station for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedStation: CallerStation = 'JUNGLE_CRUISE_SKIPPER';

  /**
   * Stores the selected situation domain for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedDomain: SituationDomain = 'ANIMATRONIC_MALFUNCTION';

  /**
   * Stores the selected urgency level for metadata tracking.
   * Populated by getTemplateVariables() before each generation.
   */
  protected selectedUrgency: UrgencyLevel = 'MILDLY_CONCERNED';

  /**
   * Creates a new CastMemberRadioGenerator instance
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
    // Use LIGHT tier for radio chatter (simple content, fast and cheap)
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
   * Uses the cast-member-radio prompt which specifies
   * the radio chatter format, Disneyland context, and humor guidelines.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'cast-member-radio.txt';
  }

  /**
   * Hook: Selects random station, domain, and urgency for prompt injection.
   *
   * Selections are stored in instance properties for metadata tracking.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables for prompt placeholders
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedStation = selectRandomItem(CALLER_STATIONS);
    this.selectedDomain = selectRandomItem(SITUATION_DOMAINS);
    this.selectedUrgency = selectRandomItem(URGENCY_LEVELS);

    return {
      callerStation: this.selectedStation,
      situationDomain: this.selectedDomain,
      urgencyLevel: this.selectedUrgency,
    };
  }

  /**
   * Hook: Returns metadata with selected parameters for tracking.
   *
   * @returns Metadata with callerStation, situationDomain, and urgencyLevel
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      callerStation: this.selectedStation,
      situationDomain: this.selectedDomain,
      urgencyLevel: this.selectedUrgency,
    };
  }
}
