/**
 * ContentOrchestrator - Main pipeline coordinator
 *
 * Coordinates selection, generation, retry, P3 failover, frame decoration,
 * and content caching for Vestaboard updates.
 *
 * Pipeline Flow:
 * 0. Check circuit breakers (MASTER, provider availability)
 * 1. Use ContentSelector to select appropriate generator
 * 2. Call generateWithRetry with preferred/alternate providers
 * 3. On retry failure → fall back to StaticFallbackGenerator (P3)
 * 4. If outputMode === 'text' → apply FrameDecorator
 * 5. Cache successful content for minor updates
 * 6. Send to VestaboardClient
 *
 * @module content/orchestrator
 */

import { generateWithRetry, type GeneratorFactory } from './orchestrator-retry.js';
import { ToolBasedGenerator } from './generators/tool-based-generator.js';
import { validateGeneratorOutput } from '../utils/validators.js';
import type { ContentSelector } from './registry/content-selector.js';
import type { ContentRegistry } from './registry/content-registry.js';
import type { FrameDecorator } from './frame/frame-decorator.js';
import type { StaticFallbackGenerator } from './generators/static-fallback-generator.js';
import type { VestaboardClient } from '../api/vestaboard/types.js';
import type { AIProvider } from '../types/ai.js';
import type {
  GenerationContext,
  GeneratedContent,
  ContentGenerator,
} from '../types/content-generator.js';
import type { ContentDataProvider } from '../services/content-data-provider.js';
import type { ContentRepository } from '../storage/repositories/content-repo.js';
import type { CircuitBreakerService } from '../services/circuit-breaker-service.js';
import type { OrchestratorResult } from '../types/content.js';

/**
 * Configuration options for ContentOrchestrator
 */
export interface ContentOrchestratorConfig {
  /** Content generator selector */
  selector: ContentSelector;
  /** Content registry for direct generator lookup (optional, required for --generator flag) */
  registry?: ContentRegistry;
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
  /** Optional circuit breaker service for system control */
  circuitBreaker?: CircuitBreakerService;
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
  private readonly registry?: ContentRegistry;
  private readonly decorator: FrameDecorator;
  private readonly vestaboardClient: VestaboardClient;
  private readonly fallbackGenerator: StaticFallbackGenerator;
  private readonly preferredProvider: AIProvider;
  private readonly alternateProvider: AIProvider;
  private readonly dataProvider?: ContentDataProvider;
  private readonly contentRepository?: ContentRepository;
  private readonly circuitBreaker?: CircuitBreakerService;
  private cachedContent: GeneratedContent | null = null;

  /**
   * Create a new ContentOrchestrator instance
   *
   * @param config - Orchestrator configuration with all dependencies
   */
  constructor(config: ContentOrchestratorConfig) {
    this.selector = config.selector;
    this.registry = config.registry;
    this.decorator = config.decorator;
    this.vestaboardClient = config.vestaboardClient;
    this.fallbackGenerator = config.fallbackGenerator;
    this.preferredProvider = config.preferredProvider;
    this.alternateProvider = config.alternateProvider;
    this.dataProvider = config.dataProvider;
    this.contentRepository = config.contentRepository;
    this.circuitBreaker = config.circuitBreaker;
  }

  /**
   * Generate and send content through the full pipeline
   *
   * Pipeline steps:
   * 0. Check circuit breakers (MASTER, provider availability)
   * 1. Pre-fetch data (weather, colors) via ContentDataProvider (major updates only)
   * 2. Select generator based on context
   * 3. Generate with retry logic (preferred → alternate provider)
   * 4. On failure → P3 fallback (StaticFallbackGenerator)
   * 5. Decorate with frame if outputMode === 'text', passing pre-fetched data
   * 6. Cache successful content
   * 7. Send to Vestaboard
   *
   * @param context - Generation context with update type and metadata
   * @returns Result object with success status and optional content/blocking info
   * @throws Error if no generator available or Vestaboard send fails
   *
   * @example
   * ```typescript
   * const result = await orchestrator.generateAndSend({
   *   updateType: 'major',
   *   timestamp: new Date(),
   *   eventData: { event_type: 'door.opened' }
   * });
   *
   * if (result.blocked) {
   *   console.log('Blocked:', result.blockReason);
   * }
   * ```
   */
  async generateAndSend(context: GenerationContext): Promise<OrchestratorResult> {
    // Step 0: Check Master circuit first
    if (this.circuitBreaker && (await this.circuitBreaker.isCircuitOpen('MASTER'))) {
      console.log('Master circuit is OFF - blocking content generation');
      return {
        success: false,
        blocked: true,
        blockReason: 'master_circuit_off',
        circuitState: { master: false },
      };
    }

    // Step 0.5: Check SLEEP_MODE circuit (after MASTER)
    if (this.circuitBreaker && (await this.circuitBreaker.isCircuitOpen('SLEEP_MODE'))) {
      console.log('SLEEP_MODE circuit is active - blocking content generation');
      return {
        success: false,
        blocked: true,
        blockReason: 'sleep_mode_active',
        circuitState: { master: true, sleepMode: false },
      };
    }

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
    // If generatorId is provided, use it directly; otherwise use selector
    let registeredGenerator;
    if (context.generatorId) {
      if (!this.registry) {
        throw new Error('ContentRegistry required when using generatorId');
      }
      registeredGenerator = this.registry.getById(context.generatorId);
      if (!registeredGenerator) {
        throw new Error(`Generator "${context.generatorId}" not found`);
      }
    } else {
      registeredGenerator = this.selector.select(context);
      if (!registeredGenerator) {
        throw new Error('No content generator available for context');
      }
    }

    let content: GeneratedContent | undefined;
    let generationError: Error | null = null;
    let skipProviderGeneration = false;

    // Step 2.5: Check provider circuit availability before AI generation
    if (this.circuitBreaker) {
      const providerName = this.preferredProvider.getName?.() || 'unknown';
      const providerCircuitId = `PROVIDER_${providerName.toUpperCase()}`;
      if (!(await this.circuitBreaker.isProviderAvailable(providerCircuitId))) {
        console.log(`Provider circuit ${providerCircuitId} is OPEN - using fallback`);
        skipProviderGeneration = true;
      }
    }

    if (!skipProviderGeneration) {
      try {
        // Step 3: Generate with retry logic using factory pattern
        // Create a factory that returns the selected generator instance
        const { toolBasedOptions } = registeredGenerator.registration;
        const baseGenerator = registeredGenerator.generator;

        // Check if this is an AI generator (has isAIGenerator marker)
        // AI generators get wrapped with ToolBasedGenerator for validation
        // Programmatic generators run directly without AI validation
        const isAIGenerator = baseGenerator.isAIGenerator === true;

        const generatorFactory: GeneratorFactory = (provider: AIProvider): ContentGenerator => {
          if (isAIGenerator) {
            // Wrap AI generators with ToolBasedGenerator for iterative validation
            return ToolBasedGenerator.wrap(baseGenerator, {
              aiProvider: provider,
              maxAttempts: toolBasedOptions?.maxAttempts ?? 3,
              exhaustionStrategy: toolBasedOptions?.exhaustionStrategy ?? 'throw',
            });
          }
          // Programmatic generators run directly
          return baseGenerator;
        };

        content = await generateWithRetry(
          generatorFactory,
          context,
          this.preferredProvider,
          this.alternateProvider,
          {}, // retryConfig defaults
          this.circuitBreaker
        );

        // Step 3.5: Validate generator output
        validateGeneratorOutput(content);
      } catch (error) {
        // Capture the original error for persistence
        generationError = error instanceof Error ? error : new Error('Unknown error');

        // Step 4: P3 fallback on retry failure or validation error
        console.warn(
          `Generator "${registeredGenerator.registration.name}" (${registeredGenerator.registration.id}) failed, using P3 fallback:`,
          error instanceof Error ? error.message : 'Unknown error'
        );

        // Save failed generation to database (fire-and-forget)
        if (this.contentRepository && context.updateType === 'major') {
          this.saveFailedContent(context, registeredGenerator, generationError, content).catch(
            () => {
              // Silently catch database errors - don't block content delivery
            }
          );
        }

        content = await this.fallbackGenerator.generate(context);
      }
    } else {
      // Provider circuit is open, use fallback directly
      content = await this.fallbackGenerator.generate(context);
    }

    // Step 5: Apply frame decoration if outputMode === 'text'
    let layoutToSend: number[][];

    if (content.outputMode === 'text') {
      // Extract formatOptions from registration (if available)
      // Defensive check for optional registration property
      const formatOptions = registeredGenerator?.registration?.formatOptions;

      const frameResult = await this.decorator.decorate(
        content.text,
        context.timestamp,
        context.data,
        formatOptions
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

    return {
      success: true,
      content,
    };
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
      aiProvider: (content.metadata?.provider as string) || '',
      aiModel: (content.metadata?.model as string) || undefined,
      modelTier: (content.metadata?.tier as string) || undefined,
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
   * @param content - Generated content (optional, available for validation failures)
   */
  private async saveFailedContent(
    context: GenerationContext,
    registeredGenerator: { registration: { id: string; name: string; priority: number } },
    error: Error,
    content?: GeneratedContent
  ): Promise<void> {
    if (!this.contentRepository) return;

    await this.contentRepository.saveContent({
      text: content?.text || '', // Use generated text if available, otherwise empty
      type: context.updateType,
      generatedAt: context.timestamp,
      sentAt: null,
      status: 'failed',
      generatorId: registeredGenerator.registration.id,
      generatorName: registeredGenerator.registration.name,
      priority: registeredGenerator.registration.priority,
      errorType: error.name,
      errorMessage: error.message,
      aiProvider: (content?.metadata?.provider as string) || '', // Extract from content metadata if available
      aiModel: (content?.metadata?.model as string) || undefined,
      modelTier: (content?.metadata?.tier as string) || undefined,
      tokensUsed: (content?.metadata?.tokensUsed as number) || undefined,
      failedOver: (content?.metadata?.failedOver as boolean) || false,
      primaryProvider: (content?.metadata?.primaryProvider as string) || undefined,
      primaryError: (content?.metadata?.primaryError as string) || undefined,
      metadata: content?.metadata || undefined,
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
