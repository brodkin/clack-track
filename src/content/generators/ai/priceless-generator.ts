/**
 * Priceless Parody Generator
 *
 * Generates Mastercard "Priceless" parody content - satirical scenes where
 * mundane purchases build to an embarrassing, ironic, or catastrophic reveal.
 *
 * The classic format:
 * 1. Item + price (sets the scene, seems innocent)
 * 2. Item + price (continues building context)
 * 3. Item + price (often hints something's off)
 * 4. The priceless moment (embarrassing/ironic reveal)
 * 5. "PRICELESS"
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/priceless.txt for format guidance
 * - Uses LIGHT model tier for cost efficiency (simple humor format)
 * - Three-dimensional variety: scenario × trope × tone (~300,000 combinations)
 * - Inherits retry logic and provider failover from base class
 *
 * DESIGN PHILOSOPHY:
 * Dictionaries provide CREATIVE DIRECTION, not punchlines. Scenarios set
 * the stage, tropes name the comedy pattern, and tones set the voice.
 * The LLM invents the specific items, prices, and reveal.
 *
 * @example
 * ```typescript
 * const generator = new PricelessGenerator(
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
 * console.log(content.text);
 * // "NEW SUIT: $400\nHAIRCUT: $35\nRESUMES: $12\nTHE INTERVIEWERS FACE\nPRICELESS"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import {
  PRICELESS_SCENARIOS,
  PRICELESS_TROPES,
  PRICELESS_TONES,
  selectRandomCategory,
  selectRandomScenario,
  getRandomTrope,
  getRandomTone,
  type PricelessScenarioCategory,
  type PricelessTrope,
  type PricelessTone,
} from './priceless-dictionaries.js';

/**
 * Generates Mastercard "Priceless" parody content
 *
 * Extends AIPromptGenerator with priceless-specific prompts,
 * LIGHT model tier for efficiency, and three-dimensional random
 * seed injection for maximum content variety.
 */
export class PricelessGenerator extends AIPromptGenerator {
  /**
   * Static access to scenario dictionaries for testing
   */
  static readonly PRICELESS_SCENARIOS = PRICELESS_SCENARIOS;

  /**
   * Static access to comedy tropes for testing
   */
  static readonly PRICELESS_TROPES = PRICELESS_TROPES;

  /**
   * Static access to tone registers for testing
   */
  static readonly PRICELESS_TONES = PRICELESS_TONES;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedCategory: string = '';
  private selectedScenario: string = '';
  private selectedTrope: string = '';
  private selectedTone: string = '';

  /**
   * Creates a new PricelessGenerator instance
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
    return 'priceless.txt';
  }

  /**
   * Selects a random scenario category and scenario within it
   */
  selectRandomScenario(): { category: PricelessScenarioCategory; scenario: string } {
    const category = selectRandomCategory();
    const scenario = selectRandomScenario(category);
    return { category, scenario };
  }

  /**
   * Selects a random comedy trope
   */
  selectRandomTrope(): PricelessTrope {
    return getRandomTrope();
  }

  /**
   * Selects a random tone register
   */
  selectRandomTone(): PricelessTone {
    return getRandomTone();
  }

  /**
   * Hook: Selects random scenario, trope, and tone, returns as template variables.
   *
   * All three seeds provide creative direction without scripting the joke.
   * The LLM uses them as inspiration to invent specific items, prices, and reveal.
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const { category, scenario } = this.selectRandomScenario();
    const trope = this.selectRandomTrope();
    const tone = this.selectRandomTone();

    // Cache for metadata
    this.selectedCategory = category;
    this.selectedScenario = scenario;
    this.selectedTrope = trope;
    this.selectedTone = tone;

    return {
      pricelessScenario: scenario,
      pricelessTrope: trope,
      pricelessTone: tone,
    };
  }

  /**
   * Hook: Returns selection choices in metadata.
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      category: this.selectedCategory,
      scenario: this.selectedScenario,
      trope: this.selectedTrope,
      tone: this.selectedTone,
    };
  }
}
