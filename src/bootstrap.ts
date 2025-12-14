/**
 * Bootstrap Module
 *
 * Wires all Epic 1-6 components together at application startup.
 * This module initializes and connects all dependencies required for
 * CLI commands and server operation.
 *
 * @module bootstrap
 */

import { loadConfig } from './config/env.js';
import { createAIProvider, AIProviderType, ModelTierSelector } from './api/ai/index.js';
import { ContentRegistry } from './content/registry/content-registry.js';
import { registerCoreContent, type CoreGenerators } from './content/registry/register-core.js';
import { registerNotifications } from './content/registry/register-notifications.js';
import { ContentSelector } from './content/registry/content-selector.js';
import { FrameDecorator } from './content/frame/frame-decorator.js';
import { ContentOrchestrator } from './content/orchestrator.js';
import { EventHandler } from './scheduler/event-handler.js';
import { CronScheduler } from './scheduler/cron.js';
import { HomeAssistantClient } from './api/data-sources/home-assistant.js';
import { createVestaboardClient } from './api/vestaboard/index.js';
import { StaticFallbackGenerator } from './content/generators/static-fallback-generator.js';
import { MotivationalGenerator } from './content/generators/ai/motivational-generator.js';
import { GlobalNewsGenerator } from './content/generators/ai/global-news-generator.js';
import { TechNewsGenerator } from './content/generators/ai/tech-news-generator.js';
import { LocalNewsGenerator } from './content/generators/ai/local-news-generator.js';
import { WeatherGenerator } from './content/generators/ai/weather-generator.js';
import { HaikuGenerator } from './content/generators/ai/haiku-generator.js';
import { SeasonalGenerator } from './content/generators/ai/seasonal-generator.js';
import { GreetingGenerator } from './content/generators/programmatic/greeting-generator.js';
import { ASCIIArtGenerator } from './content/generators/programmatic/ascii-art-generator.js';
import { NotificationGenerator } from './content/generators/notification-generator.js';
import { RSSClient } from './api/data-sources/rss-client.js';
import { PromptLoader } from './content/prompt-loader.js';
import { MinorUpdateGenerator } from './content/generators/minor-update.js';
import { ContentDataProvider } from './services/content-data-provider.js';
import { WeatherService } from './services/weather-service.js';
import { ColorBarService } from './content/frame/color-bar.js';
import { getKnexInstance, type Knex } from './storage/knex.js';
import { ContentModel, VoteModel, LogModel } from './storage/models/index.js';
import { ContentRepository, VoteRepository } from './storage/repositories/index.js';
import type { AIProvider } from './types/ai.js';

/**
 * Bootstrap result containing all initialized components
 */
export interface BootstrapResult {
  /** Content orchestrator for generating and sending updates */
  orchestrator: ContentOrchestrator;
  /** Event handler for Home Assistant events (null if HA not configured) */
  eventHandler: EventHandler | null;
  /** Cron scheduler for minute-by-minute updates */
  scheduler: CronScheduler;
  /** Content registry with all registered generators */
  registry: ContentRegistry;
  /** Home Assistant client (null if HA not configured) - call disconnect() to clean up */
  haClient: HomeAssistantClient | null;
  /** Knex database connection (null if not configured) - call closeKnexInstance() to clean up */
  knex: Knex | null;
  /** Content repository for storing content records (undefined if database not configured) */
  contentRepository: ContentRepository | undefined;
  /** Vote repository for storing votes (undefined if database not configured) */
  voteRepository: VoteRepository | undefined;
  /** Log model for storing logs (undefined if database not configured) */
  logModel: LogModel | undefined;
}

/**
 * Factory interface for creating notification generators
 */
interface NotificationGeneratorFactory {
  create(eventPattern: RegExp, displayName: string): NotificationGenerator;
}

/**
 * Simple notification generator factory implementation
 *
 * Creates Home Assistant notification generators dynamically based on
 * event patterns and display names.
 */
class HANotificationGeneratorFactory implements NotificationGeneratorFactory {
  /**
   * Create a notification generator for a specific event pattern
   *
   * @param eventPattern - Regular expression pattern for matching Home Assistant events
   * @param displayName - Human-readable name for the notification
   * @returns NotificationGenerator instance
   */
  create(eventPattern: RegExp, displayName: string): NotificationGenerator {
    // Create anonymous class extending NotificationGenerator
    return new (class extends NotificationGenerator {
      protected eventPattern = eventPattern;

      protected formatNotification(eventData: Record<string, unknown>): string {
        const entityId = (eventData.entity_id as string) || 'unknown';
        const newState = eventData.new_state as Record<string, unknown> | undefined;
        const state = (newState?.state as string) || 'changed';
        return `${displayName}: ${entityId} is ${state}`;
      }
    })();
  }
}

/**
 * Helper: Determine AI provider type from configuration
 */
function getAIProviderType(provider: 'openai' | 'anthropic'): AIProviderType {
  return provider === 'anthropic' ? AIProviderType.ANTHROPIC : AIProviderType.OPENAI;
}

/**
 * Helper: Get AI configuration for the configured provider
 */
function getAIConfig(config: ReturnType<typeof loadConfig>) {
  const aiConfig = config.ai.provider === 'anthropic' ? config.ai.anthropic : config.ai.openai;

  if (!aiConfig) {
    throw new Error(`AI provider configuration is required for provider: ${config.ai.provider}`);
  }

  return aiConfig;
}

/**
 * Helper: Create alternate AI provider for failover
 */
function createAlternateProvider(
  config: ReturnType<typeof loadConfig>,
  primaryProvider: AIProvider
): AIProvider {
  // If both providers are configured, use the alternate one for failover
  if (config.ai.provider === 'openai' && config.ai.anthropic) {
    return createAIProvider(
      AIProviderType.ANTHROPIC,
      config.ai.anthropic.apiKey,
      config.ai.anthropic.model
    );
  }

  if (config.ai.provider === 'anthropic' && config.ai.openai) {
    return createAIProvider(AIProviderType.OPENAI, config.ai.openai.apiKey, config.ai.openai.model);
  }

  // If only one provider configured, use it for both primary and alternate
  return primaryProvider;
}

/**
 * Helper: Create core content generators
 */
function createCoreGenerators(
  promptLoader: PromptLoader,
  modelTierSelector: ModelTierSelector,
  apiKeys: Record<string, string>,
  weatherService?: WeatherService
): CoreGenerators {
  const rssClient = new RSSClient();

  return {
    motivational: new MotivationalGenerator(promptLoader, modelTierSelector, apiKeys),
    globalNews: new GlobalNewsGenerator(promptLoader, modelTierSelector, apiKeys, rssClient),
    techNews: new TechNewsGenerator(promptLoader, modelTierSelector, apiKeys, rssClient),
    localNews: new LocalNewsGenerator(promptLoader, modelTierSelector, apiKeys, rssClient),
    weather: new WeatherGenerator(promptLoader, modelTierSelector, apiKeys, weatherService),
    greeting: new GreetingGenerator(),
    haiku: new HaikuGenerator(promptLoader, modelTierSelector, apiKeys),
    seasonal: new SeasonalGenerator(promptLoader, modelTierSelector, apiKeys),
    asciiArt: new ASCIIArtGenerator(['HELLO', 'WORLD', 'WELCOME']),
    staticFallback: new StaticFallbackGenerator('prompts/static'),
  };
}

/**
 * Helper: Create Home Assistant client if configured
 */
function createHAClientIfConfigured(
  config: ReturnType<typeof loadConfig>
): HomeAssistantClient | null {
  if (!config.dataSources.homeAssistant) {
    return null;
  }

  return new HomeAssistantClient({
    url: config.dataSources.homeAssistant.url,
    token: config.dataSources.homeAssistant.token,
    reconnection: {
      enabled: true,
      maxAttempts: config.dataSources.homeAssistant.maxReconnectAttempts ?? 10,
      initialDelayMs: config.dataSources.homeAssistant.reconnectDelayMs ?? 5000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
  });
}

/**
 * Bootstrap application by initializing all Epic 1-6 components
 *
 * This function:
 * 1. Loads configuration from environment
 * 2. Creates AI providers with factory pattern
 * 3. Initializes ContentRegistry and registers all generators
 * 4. Creates ContentSelector, FrameDecorator
 * 5. Creates ContentDataProvider for pre-fetching weather and colors (if HA configured)
 * 6. Creates ContentOrchestrator with dataProvider integration
 * 7. Optionally creates EventHandler if Home Assistant is configured
 * 8. Creates CronScheduler for periodic updates
 *
 * @returns Promise resolving to BootstrapResult with all initialized components
 * @throws Error if required configuration is missing or initialization fails
 *
 * @example
 * ```typescript
 * const { orchestrator, eventHandler, scheduler, registry } = await bootstrap();
 *
 * // Use orchestrator for CLI commands
 * await orchestrator.generateAndSend({ updateType: 'major', timestamp: new Date() });
 *
 * // Use eventHandler for Home Assistant integration (if configured)
 * if (eventHandler) {
 *   await eventHandler.initialize();
 * }
 *
 * // Use scheduler for periodic updates
 * scheduler.start();
 * ```
 */
export async function bootstrap(): Promise<BootstrapResult> {
  // Step 1: Load and validate configuration
  const config = loadConfig();

  if (!config.vestaboard) {
    throw new Error('Vestaboard configuration is required for operation');
  }

  // Step 2: Create AI providers (primary + alternate for failover)
  const aiProviderType = getAIProviderType(config.ai.provider);
  const aiConfig = getAIConfig(config);

  const primaryProvider = createAIProvider(aiProviderType, aiConfig.apiKey, aiConfig.model);
  const alternateProvider = createAlternateProvider(config, primaryProvider);

  // Step 3: Initialize AI infrastructure
  const modelTierSelector = new ModelTierSelector(aiProviderType, [aiProviderType]);
  const promptLoader = new PromptLoader('./prompts');

  // Step 4: Create Home Assistant client and WeatherService (if configured)
  // Created early so WeatherService can be injected into generators
  const haClient = createHAClientIfConfigured(config);

  // Connect to Home Assistant if client was created
  if (haClient) {
    try {
      await haClient.connect();
    } catch (error) {
      // Log warning but continue - graceful degradation without HA
      console.warn(
        'Failed to connect to Home Assistant:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // Only create WeatherService if HA client is connected
  const weatherService = haClient?.isConnected() ? new WeatherService(haClient) : undefined;

  // Step 4.5: Initialize Database (if configured)
  let knex: Knex | null = null;
  let contentRepository: ContentRepository | undefined;
  let voteRepository: VoteRepository | undefined;
  let logModel: LogModel | undefined;

  // In test environment, always use in-memory SQLite
  // In production, require DATABASE_URL to be configured
  if (process.env.NODE_ENV === 'test' || config.database.url) {
    try {
      knex = getKnexInstance();

      // Note: Migrations are not run here to avoid ES module import issues in test environments
      // Tests handle table creation manually; production should ensure tables exist via migrations

      // Create content model and repository
      const contentModel = new ContentModel(knex);
      contentRepository = new ContentRepository(contentModel);

      // Create vote model and repository
      const voteModel = new VoteModel(knex);
      voteRepository = new VoteRepository(voteModel);

      // Create log model (no repository wrapper needed - direct model access)
      logModel = new LogModel(knex);

      // Run 90-day retention cleanup on startup (fire-and-forget)
      contentRepository.cleanupOldRecords(90).catch(cleanupError => {
        console.warn(
          'Startup retention cleanup failed:',
          cleanupError instanceof Error ? cleanupError.message : cleanupError
        );
      });
    } catch (error) {
      // Log warning but continue - graceful degradation without database
      console.warn(
        'Failed to connect to database:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      knex = null;
      contentRepository = undefined;
      voteRepository = undefined;
      logModel = undefined;
    }
  }

  // Step 5: Create and populate ContentRegistry
  const registry = ContentRegistry.getInstance();
  const apiKeys = { [aiProviderType]: aiConfig.apiKey };

  const coreGenerators = createCoreGenerators(
    promptLoader,
    modelTierSelector,
    apiKeys,
    weatherService
  );
  registerCoreContent(registry, coreGenerators);

  const notificationFactory = new HANotificationGeneratorFactory();
  registerNotifications(registry, notificationFactory);

  // Step 6: Create core content infrastructure
  const selector = new ContentSelector(registry);
  const vestaboardClient = createVestaboardClient({
    apiKey: config.vestaboard.apiKey,
    apiUrl: config.vestaboard.apiUrl,
  });

  // Step 7: Create FrameDecorator (with optional HA client for weather)
  const frameDecorator = new FrameDecorator({
    homeAssistant: haClient || undefined,
    aiProvider: primaryProvider,
  });

  // Step 8: Create ContentDataProvider (if HA is configured)
  let dataProvider: ContentDataProvider | undefined;
  if (haClient && weatherService) {
    const colorBarService = ColorBarService.getInstance(primaryProvider);
    dataProvider = new ContentDataProvider(weatherService, colorBarService);
  }

  // Step 9: Create ContentOrchestrator
  const orchestrator = new ContentOrchestrator({
    selector,
    decorator: frameDecorator,
    vestaboardClient,
    fallbackGenerator: coreGenerators.staticFallback as StaticFallbackGenerator,
    preferredProvider: primaryProvider,
    alternateProvider,
    dataProvider,
    contentRepository,
  });

  // Step 10: Create EventHandler (only if Home Assistant configured)
  const eventHandler = haClient ? new EventHandler(haClient, orchestrator) : null;

  // Step 11: Create CronScheduler for periodic updates
  const minorUpdateGenerator = new MinorUpdateGenerator(orchestrator, frameDecorator);
  const scheduler = new CronScheduler(minorUpdateGenerator, vestaboardClient);

  // Return all initialized components
  return {
    orchestrator,
    eventHandler,
    scheduler,
    registry,
    haClient,
    knex,
    contentRepository,
    voteRepository,
    logModel,
  };
}
