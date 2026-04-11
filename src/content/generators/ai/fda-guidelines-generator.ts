/**
 * FDA Guidelines Generator
 *
 * Generates fascinating, obscure facts about food regulations from
 * the FDA and international equivalents (EU, Japan, Canada, etc.).
 * Facts are presented dry and factual - the absurdity of the
 * regulations speaks for itself.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/fda-guidelines.txt for regulatory fact guidance
 * - Variety via REGULATORY_BODIES (12), TOPIC_CATEGORIES (~80 sub-topics), PRESENTATION_ANGLES (8)
 * - ~7,680 unique combinations ensure high content variability
 * - Uses MEDIUM model tier for factual accuracy (regulatory facts must be real)
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects regulatoryBody, topicArea, presentationAngle
 * - getCustomMetadata(): Tracks selections in generation metadata
 *
 * Dictionary design principle: Seeds, not scripts. Dictionaries provide
 * categorical guidance (e.g., "GRADING_AND_CLASSIFICATION") rather than
 * specific facts, giving the LLM freedom to select from its knowledge.
 *
 * @example
 * ```typescript
 * const generator = new FdaGuidelinesGenerator(
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
 * // "FDA: ICE CREAM MUST
 * //  CONTAIN 10% MILKFAT
 * //  WEIGH 4.5 LBS PER
 * //  GALLON AND HAVE LESS
 * //  THAN 100% OVERRUN"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import {
  REGULATORY_BODIES,
  TOPIC_CATEGORIES,
  PRESENTATION_ANGLES,
  selectRandomItem,
  selectRandomCategory,
  selectRandomTopic,
  type RegulatoryBody,
  type TopicCategory,
  type PresentationAngle,
} from './fda-guidelines-dictionaries.js';

/**
 * Generates fascinating food regulation facts from the FDA and international equivalents.
 *
 * Extends AIPromptGenerator with regulatory-fact-specific prompts,
 * MEDIUM model tier for factual accuracy, and three variety dimensions
 * (regulatory body, topic area, presentation angle) for diverse output.
 */
export class FdaGuidelinesGenerator extends AIPromptGenerator {
  /**
   * Static access to regulatory bodies for testing.
   */
  static readonly REGULATORY_BODIES = REGULATORY_BODIES;

  /**
   * Static access to topic categories for testing.
   */
  static readonly TOPIC_CATEGORIES = TOPIC_CATEGORIES;

  /**
   * Static access to presentation angles for testing.
   */
  static readonly PRESENTATION_ANGLES = PRESENTATION_ANGLES;

  /**
   * Stores the selected regulatory body for metadata tracking.
   */
  protected selectedBody: RegulatoryBody = 'US_FDA';

  /**
   * Stores the selected topic category key for metadata tracking.
   */
  protected selectedCategory: TopicCategory = 'FOOD_DEFINITIONS';

  /**
   * Stores the selected topic sub-area for metadata tracking.
   */
  protected selectedTopic: string = '';

  /**
   * Stores the selected presentation angle for metadata tracking.
   */
  protected selectedAngle: PresentationAngle = 'SURPRISING_DEFINITION';

  /**
   * Creates a new FdaGuidelinesGenerator instance.
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
    // Use MEDIUM tier for factual accuracy (real regulations, not hallucinated)
    super(promptLoader, modelTierSelector, ModelTierEnum.MEDIUM, apiKeys);
  }

  /**
   * Returns the filename for the system prompt.
   *
   * @returns Filename of the system prompt
   */
  protected getSystemPromptFile(): string {
    return 'major-update-base.txt';
  }

  /**
   * Returns the filename for the user prompt.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'fda-guidelines.txt';
  }

  /**
   * Hook: Selects random regulatory body, topic, and angle for prompt injection.
   *
   * Selections are stored in instance properties for metadata tracking.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables for prompt placeholders
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const body = selectRandomItem(REGULATORY_BODIES);
    const category = selectRandomCategory();
    const topic = selectRandomTopic(category);
    const angle = selectRandomItem(PRESENTATION_ANGLES);

    // Cache for metadata
    this.selectedBody = body;
    this.selectedCategory = category;
    this.selectedTopic = topic;
    this.selectedAngle = angle;

    return {
      regulatoryBody: body,
      topicArea: topic,
      presentationAngle: angle,
    };
  }

  /**
   * Hook: Returns metadata with selected parameters for tracking.
   *
   * @returns Metadata with regulatoryBody, topicCategory, topicArea, and presentationAngle
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      regulatoryBody: this.selectedBody,
      topicCategory: this.selectedCategory,
      topicArea: this.selectedTopic,
      presentationAngle: this.selectedAngle,
    };
  }
}
