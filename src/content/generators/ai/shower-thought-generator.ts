/**
 * Shower Thought Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * philosophical musings and "wait, why IS that?" moments using AI.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/shower-thought.txt for shower thought guidance
 * - Optimized with LIGHT model tier for efficiency (simple thoughts)
 * - Injects random thought-type and subject-domain into prompts
 * - Inherits retry logic and provider failover from base class
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects thoughtType and subjectDomain
 * - getCustomMetadata(): Tracks selection choices in metadata
 *
 * DESIGN PRINCIPLE: Dictionaries set territory, not destination.
 * Thought-type categories describe cognitive patterns (PARADOX, SCALE_SHIFT),
 * not joke formulas. Subject domains are broad (DAILY_ROUTINES, LANGUAGE),
 * not specific observations. The prompt guides the LLM's cognitive move
 * without suggesting the observation itself.
 *
 * @example
 * ```typescript
 * const generator = new ShowerThoughtGenerator(
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
 * console.log(content.text); // "DO FISH KNOW\nTHEY'RE WET\nOR IS THAT JUST LIFE"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier } from '../../../types/content-generator.js';

/**
 * Cognitive pattern categories for shower thoughts
 *
 * Each type describes a kind of mental move the LLM should make,
 * not a joke structure or formula. These steer the direction of
 * the observation without constraining the specific content.
 */
export const THOUGHT_TYPES = [
  'PARADOX',
  'SCALE_SHIFT',
  'HIDDEN_CONNECTION',
  'ROLE_REVERSAL',
  'TIME_WARP',
  'FALSE_BINARY',
  'UNNOTICED_ABSURDITY',
] as const;

/**
 * Subject domains for shower thoughts
 *
 * Each domain is a broad territory with seed subjects that give
 * the LLM a starting area to explore. Domains are universal and
 * relatable -- the kind of stuff everyone encounters.
 */
export const SUBJECT_DOMAINS = {
  DAILY_ROUTINES: [
    'sleeping',
    'eating meals',
    'commuting',
    'showering',
    'brushing teeth',
    'cooking',
  ],
  LANGUAGE: ['spelling', 'idioms', 'names', 'accents', 'slang', 'punctuation'],
  SOCIAL_NORMS: ['politeness', 'queuing', 'tipping', 'dress codes', 'handshakes', 'eye contact'],
  TECHNOLOGY: ['passwords', 'notifications', 'charging', 'autocorrect', 'updates', 'screenshots'],
  NATURE: ['seasons', 'gravity', 'rain', 'animal behavior', 'plants growing', 'ocean tides'],
  TIME: ['aging', 'calendars', 'deadlines', 'naps', 'time zones', 'waiting'],
  FOOD: ['leftovers', 'expiration dates', 'recipes', 'snacking', 'spices', 'breakfast rules'],
} as const;

export type ThoughtType = (typeof THOUGHT_TYPES)[number];
export type SubjectDomain = keyof typeof SUBJECT_DOMAINS;

/**
 * Generates philosophical shower thoughts and oddly profound musings
 *
 * Extends AIPromptGenerator with shower-thought-specific prompts,
 * LIGHT model tier selection, and random thought-type / subject-domain
 * injection for variety.
 */
export class ShowerThoughtGenerator extends AIPromptGenerator {
  /**
   * Static access to thought types for testing
   */
  static readonly THOUGHT_TYPES = THOUGHT_TYPES;

  /**
   * Static access to subject domains for testing
   */
  static readonly SUBJECT_DOMAINS = SUBJECT_DOMAINS;

  /**
   * Selected values for the current generation, used by getCustomMetadata
   */
  private selectedThoughtType: string = '';
  private selectedSubjectDomain: string = '';
  private selectedSubject: string = '';

  /**
   * Creates a new ShowerThoughtGenerator instance
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
    // Use LIGHT tier for shower thoughts (simple content, fast and cheap)
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
   * Uses the shower thought prompt which specifies the content type,
   * structure, and tone for philosophical musings.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'shower-thought.txt';
  }

  /**
   * Selects a random thought-type cognitive pattern
   *
   * @returns The selected thought type
   */
  selectRandomThoughtType(): string {
    return THOUGHT_TYPES[Math.floor(Math.random() * THOUGHT_TYPES.length)];
  }

  /**
   * Selects a random subject domain and seed subject within it
   *
   * @returns Object containing the selected subjectDomain and subject
   */
  selectRandomSubjectDomain(): { subjectDomain: string; subject: string } {
    const domainKeys = Object.keys(SUBJECT_DOMAINS) as SubjectDomain[];
    const randomDomain = domainKeys[Math.floor(Math.random() * domainKeys.length)];
    const subjects = SUBJECT_DOMAINS[randomDomain];
    const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];

    return {
      subjectDomain: randomDomain,
      subject: randomSubject,
    };
  }

  /**
   * Hook: Selects random thought-type and subject-domain, returns as template variables.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with thoughtType and subjectDomain
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const thoughtType = this.selectRandomThoughtType();
    const { subjectDomain, subject } = this.selectRandomSubjectDomain();

    // Cache for metadata
    this.selectedThoughtType = thoughtType;
    this.selectedSubjectDomain = subjectDomain;
    this.selectedSubject = subject;

    return { thoughtType, subjectDomain, subject };
  }

  /**
   * Hook: Returns selection choices in metadata.
   *
   * @returns Metadata with thoughtType, subjectDomain, and subject
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      thoughtType: this.selectedThoughtType,
      subjectDomain: this.selectedSubjectDomain,
      subject: this.selectedSubject,
    };
  }
}
