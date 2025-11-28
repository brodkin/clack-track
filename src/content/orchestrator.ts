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
import { validateGeneratorOutput } from '../utils/validators.js';
import type { ContentSelector } from './registry/content-selector.js';
import type { FrameDecorator } from './frame/frame-decorator.js';
import type { StaticFallbackGenerator } from './generators/static-fallback-generator.js';
import type { VestaboardClient } from '../api/vestaboard/types.js';
import type { AIProvider } from '../types/ai.js';
import type { GenerationContext, GeneratedContent } from '../types/content-generator.js';
import type { ContentDataProvider } from '../services/content-data-provider.js';
import type { ContentRepository } from '../storage/repositories/content-repo.js';

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
  /** Optional data provider for pre-fetching weather and color data */
  dataProvider?: ContentDataProvider;
  /** Optional content repository for database persistence */
  contentRepository?: ContentRepository;
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
  private readonly dataProvider?: ContentDataProvider;
  private readonly contentRepository?: ContentRepository;
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
    this.dataProvider = config.dataProvider;
    this.contentRepository = config.contentRepository;
  }

  /**
   * Generate and send content through the full pipeline
   *
   * Pipeline steps:
   * 1. Pre-fetch data (weather, colors) via ContentDataProvider (major updates only)
   * 2. Select generator based on context
   * 3. Generate with retry logic (preferred → alternate provider)
   * 4. On failure → P3 fallback (StaticFallbackGenerator)
   * 5. Decorate with frame if outputMode === 'text', passing pre-fetched data
   * 6. Cache successful content
   * 7. Send to Vestaboard
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
    // Step 1: Pre-fetch data if dataProvider is available and this is a major update
    if (this.dataProvider && context.updateType === 'major') {
      try {
        const data = await this.dataProvider.fetchData();
        context.data = data;
      } catch {
        // Graceful degradation - continue without pre-fetched data
        // FrameDecorator will fetch its own data if needed
        context.data = undefined;
      }
    }

    // Step 2: Select generator based on context
    const registeredGenerator = this.selector.select(context);

    if (!registeredGenerator) {
      throw new Error('No content generator available for context');
    }

    let content: GeneratedContent;
    let generationError: Error | null = null;

    try {
      // Step 3: Generate with retry logic
      content = await generateWithRetry(
        registeredGenerator.generator,
        context,
        this.preferredProvider,
        this.alternateProvider
      );

      // Step 2.5: Validate generator output
      validateGeneratorOutput(content);
    } catch (error) {
      // Capture the original error for persistence
      generationError = error instanceof Error ? error : new Error('Unknown error');

      // Step 3: P3 fallback on retry failure or validation error
      console.warn(
        'Generator failed, using P3 fallback:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Save failed generation to database (fire-and-forget)
      if (this.contentRepository && context.updateType === 'major') {
        this.saveFailedContent(context, registeredGenerator, generationError).catch(() => {
          // Silently catch database errors - don't block content delivery
        });
      }

      content = await this.fallbackGenerator.generate(context);
    }

    // Step 5: Apply frame decoration if outputMode === 'text'
    let layoutToSend: number[][];

    if (content.outputMode === 'text') {
      const frameResult = await this.decorator.decorate(
        content.text,
        context.timestamp,
        context.data
      );
      layoutToSend = frameResult.layout;
    } else {
      // outputMode === 'layout', use pre-formatted layout
      // VestaboardLayout has characterCodes which is the number[][] format
      if (!content.layout?.characterCodes) {
        throw new Error('Layout mode requires valid characterCodes');
      }
      layoutToSend = content.layout.characterCodes;
    }

    // Step 6: Cache successful content
    this.cachedContent = content;

    // Step 7: Send to Vestaboard
    await this.vestaboardClient.sendLayout(layoutToSend);

    // Step 8: Save successful major update to database (fire-and-forget)
    // Only save if no generation error occurred (successful path)
    if (this.contentRepository && context.updateType === 'major' && !generationError) {
      this.saveSuccessfulContent(context, registeredGenerator, content).catch(() => {
        // Silently catch database errors - don't block content delivery
      });
    }
  }

  /**
   * Save successful content generation to database (fire-and-forget)
   *
   * @param context - Generation context
   * @param registeredGenerator - Generator metadata
   * @param content - Generated content
   */
  private async saveSuccessfulContent(
    context: GenerationContext,
    registeredGenerator: { registration: { id: string; name: string; priority: number } },
    content: GeneratedContent
  ): Promise<void> {
    if (!this.contentRepository) return;

    await this.contentRepository.saveContent({
      text: content.text,
      type: context.updateType,
      generatedAt: context.timestamp,
      sentAt: new Date(),
      status: 'success',
      generatorId: registeredGenerator.registration.id,
      generatorName: registeredGenerator.registration.name,
      priority: registeredGenerator.registration.priority,
      aiProvider: (content.metadata?.aiProvider as string) || '',
      aiModel: (content.metadata?.aiModel as string) || undefined,
      modelTier: (content.metadata?.modelTier as string) || undefined,
      tokensUsed: (content.metadata?.tokensUsed as number) || undefined,
      failedOver: (content.metadata?.failedOver as boolean) || false,
      primaryProvider: (content.metadata?.primaryProvider as string) || undefined,
      primaryError: (content.metadata?.primaryError as string) || undefined,
      metadata: content.metadata ? content.metadata : undefined,
    });
  }

  /**
   * Save failed content generation to database (fire-and-forget)
   *
   * @param context - Generation context
   * @param registeredGenerator - Generator metadata
   * @param error - Error that caused generation failure
   */
  private async saveFailedContent(
    context: GenerationContext,
    registeredGenerator: { registration: { id: string; name: string; priority: number } },
    error: Error
  ): Promise<void> {
    if (!this.contentRepository) return;

    await this.contentRepository.saveContent({
      text: '', // Empty text for failed generations
      type: context.updateType,
      generatedAt: context.timestamp,
      sentAt: null,
      status: 'failed',
      generatorId: registeredGenerator.registration.id,
      generatorName: registeredGenerator.registration.name,
      priority: registeredGenerator.registration.priority,
      errorType: error.name,
      errorMessage: error.message,
      aiProvider: '', // No AI provider since generation failed
      metadata: undefined,
    });
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
