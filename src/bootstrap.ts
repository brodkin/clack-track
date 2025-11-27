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
import { GreetingGenerator } from './content/generators/programmatic/greeting-generator.js';
import { ASCIIArtGenerator } from './content/generators/programmatic/ascii-art-generator.js';
import { NotificationGenerator } from './content/generators/notification-generator.js';
import { RSSClient } from './api/data-sources/rss-client.js';
import { PromptLoader } from './content/prompt-loader.js';
import { MinorUpdateGenerator } from './content/generators/minor-update.js';
import { ContentDataProvider } from './services/content-data-provider.js';
import { WeatherService } from './services/weather-service.js';
import { ColorBarService } from './content/frame/color-bar.js';
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
}

/**
 * Factory interface for creating notification generators
 */
interface NotificationGeneratorFactory {
  create(eventPattern: string, displayName: string): NotificationGenerator;
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
   * @param eventPattern - RegExp pattern as string (e.g., '/^door\\..*$/')
   * @param displayName - Human-readable name for the notification
   * @returns NotificationGenerator instance
   */
  create(eventPattern: string, displayName: string): NotificationGenerator {
    // Parse pattern string to RegExp (remove leading/trailing slashes)
    const pattern = new RegExp(eventPattern.slice(1, -1));

    // Create anonymous class extending NotificationGenerator
    return new (class extends NotificationGenerator {
      protected eventPattern = pattern;

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
  apiKeys: Record<string, string>
): CoreGenerators {
  const rssClient = new RSSClient();

  return {
    motivational: new MotivationalGenerator(promptLoader, modelTierSelector, apiKeys),
    globalNews: new GlobalNewsGenerator(promptLoader, modelTierSelector, apiKeys, rssClient),
    techNews: new TechNewsGenerator(promptLoader, modelTierSelector, apiKeys, rssClient),
    localNews: new LocalNewsGenerator(promptLoader, modelTierSelector, apiKeys, rssClient),
    weather: new WeatherGenerator(promptLoader, modelTierSelector, apiKeys),
    greeting: new GreetingGenerator(),
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

  // Step 4: Create and populate ContentRegistry
  const registry = ContentRegistry.getInstance();
  const apiKeys = { [aiProviderType]: aiConfig.apiKey };

  const coreGenerators = createCoreGenerators(promptLoader, modelTierSelector, apiKeys);
  registerCoreContent(registry, coreGenerators);

  const notificationFactory = new HANotificationGeneratorFactory();
  registerNotifications(registry, notificationFactory);

  // Step 5: Create core content infrastructure
  const selector = new ContentSelector(registry);
  const vestaboardClient = createVestaboardClient({
    apiKey: config.vestaboard.apiKey,
    apiUrl: config.vestaboard.apiUrl,
  });

  // Step 6: Create FrameDecorator (with optional HA client for weather)
  const haClient = createHAClientIfConfigured(config);
  const frameDecorator = new FrameDecorator({
    homeAssistant: haClient || undefined,
    aiProvider: primaryProvider,
  });

  // Step 7: Create ContentDataProvider (if HA is configured)
  let dataProvider: ContentDataProvider | undefined;
  if (haClient) {
    const weatherService = new WeatherService(haClient);
    const colorBarService = ColorBarService.getInstance(primaryProvider);
    dataProvider = new ContentDataProvider(weatherService, colorBarService);
  }

  // Step 8: Create ContentOrchestrator
  const orchestrator = new ContentOrchestrator({
    selector,
    decorator: frameDecorator,
    vestaboardClient,
    fallbackGenerator: coreGenerators.staticFallback as StaticFallbackGenerator,
    preferredProvider: primaryProvider,
    alternateProvider,
    dataProvider,
  });

  // Step 9: Create EventHandler (only if Home Assistant configured)
  const eventHandler = haClient ? new EventHandler(haClient, orchestrator) : null;

  // Step 10: Create CronScheduler for periodic updates
  const minorUpdateGenerator = new MinorUpdateGenerator(orchestrator, frameDecorator);
  const scheduler = new CronScheduler(minorUpdateGenerator, vestaboardClient);

  // Return all initialized components
  return {
    orchestrator,
    eventHandler,
    scheduler,
    registry,
  };
}
