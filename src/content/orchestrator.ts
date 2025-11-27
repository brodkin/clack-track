/**
 * ContentOrchestrator - Main pipeline coordinator
 *
 * Coordinates selection, generation, retry, P3 failover, frame decoration,
 * and content caching for Vestaboard updates.
 *
 * Pipeline Flow:
 * 1. Use ContentSelector to select appropriate generator
 * 2. Call generateWithRetry with preferred/alternate providers
 * 3. On retry failure → fall back to StaticFallbackGenerator (P3)
 * 4. If outputMode === 'text' → apply FrameDecorator
 * 5. Cache successful content for minor updates
 * 6. Send to VestaboardClient
 *
 * @module content/orchestrator
 */

import { generateWithRetry } from './orchestrator-retry.js';
import type { ContentSelector } from './registry/content-selector.js';
import type { FrameDecorator } from './frame/frame-decorator.js';
import type { StaticFallbackGenerator } from './generators/static-fallback-generator.js';
import type { VestaboardClient } from '../api/vestaboard/types.js';
import type { AIProvider } from '../types/ai.js';
import type { GenerationContext, GeneratedContent } from '../types/content-generator.js';

/**
 * Configuration options for ContentOrchestrator
 */
export interface ContentOrchestratorConfig {
  /** Content generator selector */
  selector: ContentSelector;
  /** Frame decorator for text content */
  decorator: FrameDecorator;
  /** Vestaboard client for sending content */
  vestaboardClient: VestaboardClient;
  /** P3 fallback generator when all providers fail */
  fallbackGenerator: StaticFallbackGenerator;
  /** Preferred AI provider (primary) */
  preferredProvider: AIProvider;
  /** Alternate AI provider (failover) */
  alternateProvider: AIProvider;
}

/**
 * ContentOrchestrator - Main content pipeline coordinator
 *
 * @class ContentOrchestrator
 *
 * @example
 * ```typescript
 * const orchestrator = new ContentOrchestrator({
 *   selector: contentSelector,
 *   decorator: frameDecorator,
 *   vestaboardClient: client,
 *   fallbackGenerator: staticFallback,
 *   preferredProvider: openai,
 *   alternateProvider: anthropic
 * });
 *
 * // Generate and send content
 * await orchestrator.generateAndSend({
 *   updateType: 'major',
 *   timestamp: new Date()
 * });
 *
 * // Get cached content for minor updates
 * const cached = orchestrator.getCachedContent();
 * ```
 */
export class ContentOrchestrator {
  private readonly selector: ContentSelector;
  private readonly decorator: FrameDecorator;
  private readonly vestaboardClient: VestaboardClient;
  private readonly fallbackGenerator: StaticFallbackGenerator;
  private readonly preferredProvider: AIProvider;
  private readonly alternateProvider: AIProvider;
  private cachedContent: GeneratedContent | null = null;

  /**
   * Create a new ContentOrchestrator instance
   *
   * @param config - Orchestrator configuration with all dependencies
   */
  constructor(config: ContentOrchestratorConfig) {
    this.selector = config.selector;
    this.decorator = config.decorator;
    this.vestaboardClient = config.vestaboardClient;
    this.fallbackGenerator = config.fallbackGenerator;
    this.preferredProvider = config.preferredProvider;
    this.alternateProvider = config.alternateProvider;
  }

  /**
   * Generate and send content through the full pipeline
   *
   * Pipeline steps:
   * 1. Select generator based on context
   * 2. Generate with retry logic (preferred → alternate provider)
   * 3. On failure → P3 fallback (StaticFallbackGenerator)
   * 4. Decorate with frame if outputMode === 'text'
   * 5. Cache successful content
   * 6. Send to Vestaboard
   *
   * @param context - Generation context with update type and metadata
   * @throws Error if no generator available or Vestaboard send fails
   *
   * @example
   * ```typescript
   * await orchestrator.generateAndSend({
   *   updateType: 'major',
   *   timestamp: new Date(),
   *   eventData: { event_type: 'door.opened' }
   * });
   * ```
   */
  async generateAndSend(context: GenerationContext): Promise<void> {
    // Step 1: Select generator based on context
    const registeredGenerator = this.selector.select(context);

    if (!registeredGenerator) {
      throw new Error('No content generator available for context');
    }

    let content: GeneratedContent;

    try {
      // Step 2: Generate with retry logic
      content = await generateWithRetry(
        registeredGenerator.generator,
        context,
        this.preferredProvider,
        this.alternateProvider
      );
    } catch {
      // Step 3: P3 fallback on retry failure
      content = await this.fallbackGenerator.generate(context);
    }

    // Step 4: Apply frame decoration if outputMode === 'text'
    let layoutToSend: number[][];

    if (content.outputMode === 'text') {
      const frameResult = await this.decorator.decorate(content.text, context.timestamp);
      layoutToSend = frameResult.layout;
    } else {
      // outputMode === 'layout', use pre-formatted layout
      // VestaboardLayout has characterCodes which is the number[][] format
      if (!content.layout?.characterCodes) {
        throw new Error('Layout mode requires valid characterCodes');
      }
      layoutToSend = content.layout.characterCodes;
    }

    // Step 5: Cache successful content
    this.cachedContent = content;

    // Step 6: Send to Vestaboard
    await this.vestaboardClient.sendLayout(layoutToSend);
  }

  /**
   * Get cached content from last successful generation
   *
   * Used for minor updates to preserve main content while updating
   * time/weather information only.
   *
   * @returns Cached content or null if no content has been cached
   *
   * @example
   * ```typescript
   * const cached = orchestrator.getCachedContent();
   * if (cached) {
   *   console.log('Last content:', cached.text);
   * }
   * ```
   */
  getCachedContent(): GeneratedContent | null {
    return this.cachedContent;
  }

  /**
   * Clear cached content
   *
   * Resets the cache to null, useful for testing or forcing fresh content.
   *
   * @example
   * ```typescript
   * orchestrator.clearCache();
   * ```
   */
  clearCache(): void {
    this.cachedContent = null;
  }
}
