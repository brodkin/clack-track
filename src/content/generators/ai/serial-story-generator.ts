/**
 * Serial Story Generator
 *
 * Concrete implementation of AIPromptGenerator for generating serialized
 * micro-stories with chapter continuity. Tracks story state across sessions
 * via ContentRepository and produces either Chapter 1 (new story) or
 * continuation chapters based on previous content.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/serial-story-chapter1.txt for new stories
 * - Uses prompts/user/serial-story-continuation.txt for continuations
 * - Queries ContentRepository for previous chapters
 * - Reuses SCENARIO and EMOTIONAL_BEAT dictionaries from story-fragment-generator
 * - Tracks arc phase (early/mid/late/resolution) for narrative guidance
 * - Optimized with MEDIUM model tier for story coherence
 *
 * Story State Detection:
 * - New story: No previous chapters, OR last chapter had continueStory:false,
 *   OR chapter count >= maxChapters
 * - Continuation: Previous chapters exist and story is not complete
 *
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects scenario/emotionalBeat (chapter 1) or
 *   previousChapters/currentChapter/arcPhase (continuation)
 * - getCustomMetadata(): Returns StoryChapterMetadata with chapter info
 *
 * @example
 * ```typescript
 * const generator = new SerialStoryGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   contentRepository,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' }
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date(),
 *   updateType: 'major'
 * });
 *
 * // Chapter 1 output:
 * // "THE DOOR APPEARED
 * // IN THE OLD BARN
 * // WHERE NOTHING HAD BEEN
 * // SHE REACHED FOR THE HANDLE"
 *
 * // Continuation output:
 * // "THE HANDLE WAS WARM
 * // THOUGH THE BARN WAS COLD
 * // SOMETHING MOVED INSIDE"
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { ContentRepository } from '../../../storage/repositories/content-repo.js';
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import type { ContentRecord } from '../../../storage/models/content.js';

/**
 * Scenario dictionary for serial stories
 *
 * Each scenario represents a moment type that can anchor a micro-fiction scene.
 * The scenario provides the situational context for the emotional beat.
 */
export const SCENARIO = [
  'KEEPING_OBJECT',
  'AFTER_PHONE_CALL',
  'ALMOST_SPOKE',
  'LAST_TIME',
  'WAITING',
  'FOUND_NOTE',
  'EMPTY_CHAIR',
  'HELD_DOOR',
  'PACKED_BOX',
  'KEPT_SECRET',
  'RETURNED_KEY',
  'WRONG_NUMBER',
  'OLD_PHOTO',
  'MISSED_TRAIN',
  'LEFT_MESSAGE',
  'UNOPENED_LETTER',
  'SAVED_SEAT',
] as const;

/**
 * Emotional beat dictionary for serial stories
 *
 * Each emotional beat represents the core feeling to convey through action,
 * not by naming the emotion directly.
 */
export const EMOTIONAL_BEAT = [
  'LOSS',
  'HOPE',
  'REGRET',
  'RELIEF',
  'LONGING',
  'RESOLVE',
  'TENDERNESS',
  'ACCEPTANCE',
] as const;

export type ScenarioType = (typeof SCENARIO)[number];
export type EmotionalBeatType = (typeof EMOTIONAL_BEAT)[number];

/**
 * Arc phases for narrative guidance
 */
export type ArcPhase = 'early' | 'mid' | 'late' | 'resolution';

/**
 * Story state information for generation decisions
 */
export interface StoryState {
  /** Whether this is a new story (chapter 1) or continuation */
  isNewStory: boolean;
  /** Current chapter number to generate */
  currentChapter: number;
  /** Previous chapters in chronological order (oldest first) */
  previousChapters: ContentRecord[];
  /** Current arc phase for narrative guidance */
  arcPhase: ArcPhase;
}

/**
 * Metadata stored with each generated chapter
 *
 * This interface includes:
 * - Fields set by the generator (storyChapter, isNewStory, arcPhase, scenario, emotionalBeat)
 * - Fields set by the AI via submit_content tool (continueStory, chapterSummary)
 */
export interface StoryChapterMetadata {
  /** Chapter number */
  storyChapter: number;
  /** Whether this is the first chapter of a new story */
  isNewStory: boolean;
  /** Arc phase when generated */
  arcPhase: ArcPhase;
  /** Scenario used (chapter 1 only) */
  scenario?: ScenarioType;
  /** Emotional beat used (chapter 1 only) */
  emotionalBeat?: EmotionalBeatType;
  /** Whether to continue the story (true = continue, false = this is the final chapter) */
  continueStory?: boolean;
  /** Brief summary of this chapter for context in continuations (set by AI via submit_content tool) */
  chapterSummary?: string;
}

/**
 * Generator ID used for ContentRepository queries
 */
const GENERATOR_ID = 'serial-story';

/**
 * Generates serialized micro-stories with chapter continuity
 *
 * Extends AIPromptGenerator with story-state-aware prompts
 * and MEDIUM model tier selection for coherent narratives.
 */
export class SerialStoryGenerator extends AIPromptGenerator {
  /**
   * Default maximum chapters per story arc
   */
  static readonly DEFAULT_MAX_CHAPTERS = 15;

  /**
   * Maximum chapters for this generator instance
   */
  readonly maxChapters: number;

  /**
   * Content repository for querying previous chapters
   */
  private readonly repository: ContentRepository;

  /**
   * Cached story state after getStoryState() is called
   */
  private cachedStoryState: StoryState | null = null;

  /**
   * Selected scenario for chapter 1 (set during getTemplateVariables)
   */
  private selectedScenario: ScenarioType | undefined;

  /**
   * Selected emotional beat for chapter 1 (set during getTemplateVariables)
   */
  private selectedEmotionalBeat: EmotionalBeatType | undefined;

  /**
   * Creates a new SerialStoryGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param repository - Content repository for querying previous chapters
   * @param apiKeys - Record of provider names to API keys
   * @param maxChapters - Maximum chapters per story arc (default: 15)
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    repository: ContentRepository,
    apiKeys: AIProviderAPIKeys = {},
    maxChapters: number = SerialStoryGenerator.DEFAULT_MAX_CHAPTERS
  ) {
    // Use MEDIUM tier for serial stories (story coherence requires nuance)
    super(promptLoader, modelTierSelector, ModelTierEnum.MEDIUM, apiKeys);
    this.repository = repository;
    this.maxChapters = maxChapters;
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
   * Returns chapter 1 prompt for new stories, continuation prompt for ongoing.
   * Must call getStoryState() first to determine story state.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    // Use cached state if available, otherwise default to chapter 1
    if (this.cachedStoryState?.isNewStory ?? true) {
      return 'serial-story-chapter1.txt';
    }
    return 'serial-story-continuation.txt';
  }

  /**
   * Queries previous chapters and determines story state
   *
   * Story is "new" when:
   * - No previous chapters exist
   * - Last chapter had continueStory:false in metadata
   * - Chapter count >= maxChapters
   *
   * @returns Story state with chapter info and arc phase
   */
  async getStoryState(): Promise<StoryState> {
    // Return cached state if available
    if (this.cachedStoryState) {
      return this.cachedStoryState;
    }

    // Query previous chapters
    const previousChapters = await this.repository.findLatestByGenerator(
      GENERATOR_ID,
      this.maxChapters
    );

    // Determine if this is a new story
    let isNewStory = true;
    let currentChapter = 1;

    if (previousChapters.length > 0) {
      // Check if the most recent chapter was the final chapter
      // Final chapter is indicated by continueStory === false
      const latestChapter = previousChapters[0];
      const latestMetadata = latestChapter.metadata as StoryChapterMetadata | undefined;
      const storyEnded = latestMetadata?.continueStory === false;

      // Check if we've reached max chapters
      const chapterCount = previousChapters.length;
      const reachedMaxChapters = chapterCount >= this.maxChapters;

      if (!storyEnded && !reachedMaxChapters) {
        // Continue the story
        isNewStory = false;
        currentChapter = chapterCount + 1;
      }
    }

    // Sort chapters chronologically (oldest first) for continuation context
    const chronologicalChapters = isNewStory ? [] : [...previousChapters].reverse();

    // Determine arc phase based on current chapter
    const arcPhase = this.getArcPhase(currentChapter);

    this.cachedStoryState = {
      isNewStory,
      currentChapter,
      previousChapters: chronologicalChapters,
      arcPhase,
    };

    return this.cachedStoryState;
  }

  /**
   * Determines arc phase based on chapter number
   *
   * @param chapter - Current chapter number
   * @returns Arc phase for narrative guidance
   */
  private getArcPhase(chapter: number): ArcPhase {
    if (chapter <= 3) return 'early';
    if (chapter <= 6) return 'mid';
    if (chapter <= 9) return 'late';
    return 'resolution';
  }

  /**
   * Selects a random scenario from the SCENARIO dictionary
   *
   * @returns Random scenario string
   */
  private selectRandomScenario(): ScenarioType {
    const index = Math.floor(Math.random() * SCENARIO.length);
    return SCENARIO[index];
  }

  /**
   * Selects a random emotional beat from the EMOTIONAL_BEAT dictionary
   *
   * @returns Random emotional beat string
   */
  private selectRandomEmotionalBeat(): EmotionalBeatType {
    const index = Math.floor(Math.random() * EMOTIONAL_BEAT.length);
    return EMOTIONAL_BEAT[index];
  }

  /**
   * Formats previous chapters for the continuation prompt
   *
   * @param chapters - Previous chapters in chronological order
   * @returns Formatted string for template variable
   */
  private formatPreviousChapters(chapters: ContentRecord[]): string {
    return chapters
      .map((chapter, index) => {
        const metadata = chapter.metadata as StoryChapterMetadata | undefined;
        const summary = metadata?.chapterSummary ?? chapter.text;
        return `Chapter ${index + 1}:\n${summary}`;
      })
      .join('\n\n');
  }

  /**
   * Hook: Returns template variables based on story state
   *
   * For chapter 1: Returns scenario and emotionalBeat
   * For continuation: Returns previousChapters, currentChapter, and arc phase flags
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables for prompt substitution
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    const state = await this.getStoryState();

    if (state.isNewStory) {
      // Chapter 1: Use scenario and emotional beat
      this.selectedScenario = this.selectRandomScenario();
      this.selectedEmotionalBeat = this.selectRandomEmotionalBeat();

      return {
        scenario: this.selectedScenario,
        emotionalBeat: this.selectedEmotionalBeat,
      };
    }

    // Continuation: Use previous chapters and arc phase
    this.selectedScenario = undefined;
    this.selectedEmotionalBeat = undefined;

    // Calculate chapter budget counters for ending guidance
    const chaptersRemaining = Math.max(0, 12 - state.currentChapter);
    const mustEndIn = Math.max(0, this.maxChapters - state.currentChapter);

    return {
      previousChapters: this.formatPreviousChapters(state.previousChapters),
      currentChapter: String(state.currentChapter),
      isEarlyArc: String(state.arcPhase === 'early'),
      isMidArc: String(state.arcPhase === 'mid'),
      isLateArc: String(state.arcPhase === 'late'),
      isResolutionArc: String(state.arcPhase === 'resolution'),
      isOverdue: String(state.currentChapter > 12),
      chaptersRemaining: String(chaptersRemaining),
      mustEndIn: String(mustEndIn),
    };
  }

  /**
   * Hook: Returns StoryChapterMetadata for the generated content
   *
   * @returns Chapter metadata including chapter number, arc phase, and selections
   */
  protected getCustomMetadata(): Record<string, unknown> {
    // Use cached state or default values
    const state = this.cachedStoryState ?? {
      isNewStory: true,
      currentChapter: 1,
      arcPhase: 'early' as ArcPhase,
    };

    const metadata: StoryChapterMetadata = {
      storyChapter: state.currentChapter,
      isNewStory: state.isNewStory,
      arcPhase: state.arcPhase,
    };

    // Include scenario and emotional beat for chapter 1
    if (this.selectedScenario) {
      metadata.scenario = this.selectedScenario;
    }
    if (this.selectedEmotionalBeat) {
      metadata.emotionalBeat = this.selectedEmotionalBeat;
    }

    return metadata as unknown as Record<string, unknown>;
  }

  /**
   * Generates serial story content with fresh state
   *
   * Clears cached story state at the start of each generation to ensure
   * proper chapter progression when the same generator instance is reused
   * across multiple updates (e.g., event-driven scenarios).
   *
   * @param context - Generation context
   * @returns Generated content with story metadata
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Clear cached state to force fresh DB query for this generation cycle
    // This ensures getUserPromptFile() sees current story state, not stale cache
    this.cachedStoryState = null;
    this.selectedScenario = undefined;
    this.selectedEmotionalBeat = undefined;

    return super.generate(context);
  }
}
