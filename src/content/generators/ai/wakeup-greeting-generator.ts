/**
 * Wakeup Greeting Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * warm, welcoming good morning messages when sleep mode deactivates.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/wakeup-greeting.txt for morning greeting guidance
 * - Morning theme dictionary for high-effectiveness variability
 * - Random theme injection via {{theme}} template variable
 * - Optimized with LIGHT model tier for efficiency (simple messages)
 * - Warm, cozy morning tone matching the Houseboy persona
 * - Standard framed mode (time/weather info bar applies)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects randomly selected theme
 * - getCustomMetadata(): Tracks theme selection in metadata
 *
 * Variability System:
 * - MORNING_THEMES (15+ items): Morning vibes to inspire content
 *   (e.g., "coffee ritual", "sunrise beauty", "fresh start energy")
 * - Random selection ensures varied outputs across generations
 *
 * @example
 * ```typescript
 * const generator = new WakeupGreetingGenerator(
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
 * console.log(content.text); // "RISE AND SHINE\nTHE COFFEE IS READY\nTODAY IS YOURS"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Morning themes to inspire wakeup greeting content
 *
 * Covers diverse morning experiences: rituals, sensations, nature, energy
 * Each theme should evoke a specific morning vibe or feeling
 */
export const MORNING_THEMES: readonly string[] = [
  // Rituals & Routines
  'the coffee ritual - that first perfect sip',
  'the gentle stretch after a good sleep',
  'the warm shower that wakes the senses',
  'the quiet moment before the day begins',

  // Nature & Environment
  'sunrise painting the sky with possibility',
  'birds chirping their morning chorus',
  'the fresh morning air through an open window',
  'morning dew glistening in early light',
  'the golden hour casting warm shadows',

  // Energy & Mindset
  'fresh start energy - a blank page',
  'the calm confidence of a new day',
  'morning motivation to chase dreams',
  'the peaceful optimism of early hours',
  'waking up on the right side of the bed',

  // Cozy & Comfort
  'warm blankets and the decision to finally emerge',
  'the satisfaction of rising with the sun',
  'that first morning smile',
] as const;

/**
 * Generates warm, welcoming good morning messages for wakeup events
 *
 * Extends AIPromptGenerator with wakeup-specific prompts,
 * efficient LIGHT model tier selection, and morning theme variability.
 * Uses the Houseboy persona with a warmer, cozier morning tone.
 *
 * Injects random {{theme}} via template variables to ensure
 * each generation produces meaningfully different content.
 */
export class WakeupGreetingGenerator extends AIPromptGenerator {
  /**
   * Selected theme for the current generation, used by getCustomMetadata
   */
  private selectedTheme: string = '';

  /**
   * Creates a new WakeupGreetingGenerator instance
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
    // Use LIGHT tier for wakeup greetings (simple content, fast and cheap)
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
   * Uses the wakeup greeting prompt which specifies the content type,
   * structure, and warm morning tone for welcoming messages.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'wakeup-greeting.txt';
  }

  /**
   * Selects a random theme from the MORNING_THEMES dictionary
   *
   * @returns A randomly selected morning theme
   */
  selectRandomTheme(): string {
    const index = Math.floor(Math.random() * MORNING_THEMES.length);
    return MORNING_THEMES[index];
  }

  /**
   * Hook: Selects random theme and returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with theme
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedTheme = this.selectRandomTheme();

    return {
      theme: this.selectedTheme,
    };
  }

  /**
   * Hook: Returns theme selection in metadata.
   *
   * @returns Metadata with selectedTheme
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      selectedTheme: this.selectedTheme,
    };
  }
}
