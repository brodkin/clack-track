/**
 * Daily Roast Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * affectionate mockery of everyday life topics with comedic edge.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/daily-roast.txt for roast content guidance
 * - Uses MEDIUM model tier for tone calibration (nuance required)
 * - Injects random topic domain, topic, and roast format into prompts
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects topicDomain, topic, and roastFormat
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * CRITICAL TONE GUARDRAIL:
 * Roast the SITUATION, never the viewer. The viewer should feel
 * IN ON THE JOKE, not targeted. Affectionate mockery, not mean-spirited.
 *
 * Good: "MONDAY EMAILS HIT DIFFERENT WHEN YOU HAVENT HAD COFFEE"
 * Bad: "YOURE STILL NOT A MORNING PERSON HUH"
 *
 * @example
 * ```typescript
 * const generator = new DailyRoastGenerator(
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
 * console.log(content.text); // "INBOX ZERO\nTHE MYTHICAL CREATURE\nWE ALL PRETEND EXISTS"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

/**
 * Topic domains for daily roasts
 *
 * Each domain contains specific topics that resonate with everyday life.
 * Topics are universal, relatable situations that everyone experiences.
 */
export const TOPIC_DOMAINS = {
  WORK_LIFE: ['meetings', 'reply-all', 'inbox zero', 'slack', 'zoom fatigue'],
  MORNING_RITUALS: ['snooze button', 'coffee dependency', 'alarm clocks'],
  TECHNOLOGY: ['passwords', 'captchas', 'updates', 'wifi', 'charging cables'],
  SOCIAL: ['small talk', 'networking', 'linkedin', 'group chats'],
  LIFESTYLE: ['gym memberships', 'meal prep', 'plants dying', 'laundry'],
  DATING: ['dating apps', 'ghosting', 'situationships', 'texting back'],
} as const;

/**
 * Roast format styles
 *
 * Each format provides a different comedic angle for the roast:
 * - OBSERVATION: Noticing an absurd truth ("Meetings that could have been emails")
 * - ACCUSATION: Calling out universal behavior ("We all do this")
 * - CONFESSION: Admitting shared guilt ("Im guilty of this too")
 * - COMPARISON: Drawing absurd parallels ("This is basically that")
 */
export const ROAST_FORMATS = ['OBSERVATION', 'ACCUSATION', 'CONFESSION', 'COMPARISON'] as const;

export type TopicDomain = keyof typeof TOPIC_DOMAINS;
export type RoastFormat = (typeof ROAST_FORMATS)[number];

/**
 * Generates daily roasts - affectionate mockery of everyday life
 *
 * Extends AIPromptGenerator with roast-specific prompts,
 * MEDIUM model tier selection for tone calibration, and
 * random topic/format injection for variety.
 */
export class DailyRoastGenerator extends AIPromptGenerator {
  /**
   * Static access to topic domains for testing
   */
  static readonly TOPIC_DOMAINS = TOPIC_DOMAINS;

  /**
   * Static access to roast formats for testing
   */
  static readonly ROAST_FORMATS = ROAST_FORMATS;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedTopicDomain: string = '';
  private selectedTopic: string = '';
  private selectedRoastFormat: string = '';

  /**
   * Creates a new DailyRoastGenerator instance
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
    // Use MEDIUM tier for daily roasts (tone calibration requires nuance)
    super(promptLoader, modelTierSelector, ModelTierEnum.MEDIUM, apiKeys);
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
   * Uses the daily-roast prompt which specifies the content type,
   * structure, and tone for affectionate everyday life mockery.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'daily-roast.txt';
  }

  /**
   * Selects a random topic domain and topic within it
   *
   * @returns Object containing the selected topicDomain and topic
   */
  selectRandomTopic(): { topicDomain: string; topic: string } {
    const domainKeys = Object.keys(TOPIC_DOMAINS) as TopicDomain[];
    const randomDomain = domainKeys[Math.floor(Math.random() * domainKeys.length)];
    const topics = TOPIC_DOMAINS[randomDomain];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    return {
      topicDomain: randomDomain,
      topic: randomTopic,
    };
  }

  /**
   * Selects a random roast format
   *
   * @returns The selected roast format
   */
  selectRandomRoastFormat(): string {
    return ROAST_FORMATS[Math.floor(Math.random() * ROAST_FORMATS.length)];
  }

  /**
   * Hook: Selects random topic and format, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with topicDomain, topic, and roastFormat
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const { topicDomain, topic } = this.selectRandomTopic();
    const roastFormat = this.selectRandomRoastFormat();

    // Cache for metadata
    this.selectedTopicDomain = topicDomain;
    this.selectedTopic = topic;
    this.selectedRoastFormat = roastFormat;

    return { topicDomain, topic, roastFormat };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with topicDomain, topic, and roastFormat
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      topicDomain: this.selectedTopicDomain,
      topic: this.selectedTopic,
      roastFormat: this.selectedRoastFormat,
    };
  }
}
