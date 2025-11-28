/**
 * MinorUpdateGenerator - Generates minor updates by refreshing frame around cached content
 *
 * This generator is responsible for minor updates that occur every minute.
 * Instead of regenerating full content, it retrieves cached content from the
 * ContentOrchestrator and applies only updated time/weather information via
 * the FrameDecorator.
 *
 * Design Patterns:
 * - Dependency Injection: Accepts ContentOrchestrator and FrameDecorator via constructor
 * - Single Responsibility: Focused on minor update logic only
 * - Separation of Concerns: Cache management by orchestrator, frame decoration by decorator
 *
 * @example
 * ```typescript
 * const generator = new MinorUpdateGenerator(orchestrator, frameDecorator);
 *
 * // Generate minor update (reapplies frame to cached content)
 * const content = await generator.generate({
 *   updateType: 'minor',
 *   timestamp: new Date()
 * });
 * ```
 *
 * @module content/generators/minor-update
 */

import type { ContentOrchestrator } from '../orchestrator.js';
import type { FrameDecorator } from '../frame/frame-decorator.js';
import type {
  ContentGenerator,
  GeneratedContent,
  GenerationContext,
  GeneratorValidationResult,
} from '../../types/content-generator.js';

/**
 * MinorUpdateGenerator class
 *
 * Handles minor updates by retrieving cached content from the orchestrator
 * and applying updated time/weather frame via the decorator.
 */
export class MinorUpdateGenerator implements ContentGenerator {
  private readonly orchestrator: ContentOrchestrator;
  private readonly frameDecorator: FrameDecorator;

  /**
   * Create a new MinorUpdateGenerator instance
   *
   * @param orchestrator - ContentOrchestrator for retrieving cached content
   * @param frameDecorator - FrameDecorator for applying time/weather frame
   */
  constructor(orchestrator: ContentOrchestrator, frameDecorator: FrameDecorator) {
    this.orchestrator = orchestrator;
    this.frameDecorator = frameDecorator;
  }

  /**
   * Generate minor update content
   *
   * Process:
   * 1. Retrieve cached content from orchestrator
   * 2. If outputMode === 'text': Apply new frame via decorator
   * 3. If outputMode === 'layout': Return cached layout directly
   * 4. Preserve metadata and add minor update tracking
   *
   * @param context - Generation context with timestamp for frame decoration
   * @returns Generated content with updated frame or cached layout
   * @throws Error if no cached content is available
   *
   * @example
   * ```typescript
   * const content = await generator.generate({
   *   updateType: 'minor',
   *   timestamp: new Date()
   * });
   * ```
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Retrieve cached content from orchestrator
    const cachedContent = this.getCachedContentOrThrow();

    // Step 2: Handle outputMode 'layout' - return directly (no frame refresh needed)
    if (cachedContent.outputMode === 'layout') {
      return cachedContent;
    }

    // Step 3: Handle outputMode 'text' - reapply frame with updated time/weather
    return this.applyFreshFrame(cachedContent, context.timestamp);
  }

  /**
   * Retrieve cached content from orchestrator or throw descriptive error
   *
   * @returns Cached content from last major update
   * @throws Error if no cached content is available
   */
  private getCachedContentOrThrow(): GeneratedContent {
    const cachedContent = this.orchestrator.getCachedContent();

    if (!cachedContent) {
      throw new Error(
        'No cached content available for minor update. A major update must be performed first.'
      );
    }

    return cachedContent;
  }

  /**
   * Apply fresh frame decoration to cached content
   *
   * Decorates cached text content with updated time/weather information
   * while preserving the original content and metadata.
   *
   * @param cachedContent - Original content from last major update
   * @param timestamp - Current timestamp for frame decoration
   * @returns Updated content with new frame layout
   */
  private async applyFreshFrame(
    cachedContent: GeneratedContent,
    timestamp: Date
  ): Promise<GeneratedContent> {
    const frameResult = await this.frameDecorator.decorate(cachedContent.text, timestamp);

    return {
      text: cachedContent.text,
      outputMode: 'layout',
      layout: {
        rows: [], // Empty rows array - layout is in characterCodes
        characterCodes: frameResult.layout,
      },
      metadata: this.buildMetadata(cachedContent, timestamp, frameResult.warnings),
    };
  }

  /**
   * Build metadata for minor update
   *
   * Preserves original metadata and adds minor update tracking information
   * and any warnings from frame decoration.
   *
   * @param cachedContent - Original cached content with metadata
   * @param timestamp - Timestamp of minor update
   * @param warnings - Optional warnings from frame decoration
   * @returns Combined metadata object
   */
  private buildMetadata(
    cachedContent: GeneratedContent,
    timestamp: Date,
    warnings?: string[]
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      ...(cachedContent.metadata || {}),
      minorUpdate: true,
      updatedAt: timestamp.toISOString(),
    };

    // Add warnings from frame decoration if present
    if (warnings && warnings.length > 0) {
      metadata.warnings = warnings;
    }

    return metadata;
  }

  /**
   * Determine if minor update should be skipped
   *
   * Minor updates should be skipped when cached content has outputMode 'layout'
   * because full-frame layouts have no time/weather frame to refresh.
   *
   * @returns true if minor update should be skipped, false otherwise
   *
   * @example
   * ```typescript
   * if (generator.shouldSkip()) {
   *   console.log('Skipping minor update - cached content is full frame');
   *   return;
   * }
   * ```
   */
  shouldSkip(): boolean {
    const cachedContent = this.orchestrator.getCachedContent();

    // Skip if cached content is layout mode (full-frame, no frame to refresh)
    if (cachedContent?.outputMode === 'layout') {
      return true;
    }

    // Don't skip for text mode (needs frame refresh) or no cache (will error during generate)
    return false;
  }

  /**
   * Validate generator configuration
   *
   * Since dependencies are provided via constructor and TypeScript ensures
   * they exist, this always returns valid.
   *
   * @returns Validation result (always valid when constructed)
   */
  async validate(): Promise<GeneratorValidationResult> {
    return { valid: true };
  }
}
