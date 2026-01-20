/**
 * Haiku Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * humorous haikus about randomly selected topics.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/haiku.txt for haiku content guidance
 * - Randomly selects topic from predefined list for variety
 * - Optimized with LIGHT model tier for efficiency (haikus are simple)
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects randomly selected topic into prompt
 * - getCustomMetadata(): Tracks which topic was selected
 *
 * @example
 * ```typescript
 * const generator = new HaikuGenerator(
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
 * console.log(content.text); // "TRAINS SPEED FAST\nWHISTLES ECHO LOUD..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Topics for haiku generation
 *
 * These topics provide variety and unexpected combinations
 * for humorous haiku content.
 */
const TOPICS = [
  'Trains',
  'Business',
  'Architecture',
  'Food',
  'Comedy',
  'EDM Music',
  'Software development',
  'Aviation',
  'Disneyland',
  'Street lighting',
  'Current Weather',
  'Current Date',
  'Current holidays',
] as const;

/**
 * Generates humorous haikus about random topics
 *
 * Extends AIPromptGenerator with haiku-specific prompts,
 * efficient LIGHT model tier selection, and random topic
 * selection for content variety.
 */
export class HaikuGenerator extends AIPromptGenerator {
  /**
   * Selected topic for the current generation, used by getCustomMetadata
   */
  private selectedTopic: string = '';

  /**
   * Creates a new HaikuGenerator instance
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
    // Use LIGHT tier for haiku content (simple, fast and cheap)
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
   * Uses the haiku prompt which specifies the content type,
   * structure, and tone for haiku content.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'haiku.txt';
  }

  /**
   * Selects a random topic from the TOPICS array
   *
   * @returns Randomly selected topic string
   */
  private selectRandomTopic(): string {
    const randomIndex = Math.floor(Math.random() * TOPICS.length);
    return TOPICS[randomIndex];
  }

  /**
   * Hook: Selects random topic and returns as template variable.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with payload (topic) string
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    this.selectedTopic = this.selectRandomTopic();
    return { payload: this.selectedTopic };
  }

  /**
   * Hook: Returns selected topic in metadata.
   *
   * @returns Metadata with the topic used for generation
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      topic: this.selectedTopic,
    };
  }
}
