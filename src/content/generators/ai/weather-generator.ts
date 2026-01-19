/**
 * Weather Generator
 *
 * Concrete implementation of AIPromptGenerator for generating
 * weather-focused content using AI with real-time weather data injection.
 *
 * Features:
 * - Uses prompts/system/major-update-base.txt for system context
 * - Uses prompts/user/weather-focus.txt for weather content guidance
 * - Fetches real weather data via WeatherService and injects into prompt
 * - Optimized with LIGHT model tier for efficiency (weather info is straightforward)
 * - Inherits retry logic and provider failover from base class
 *
 * @example
 * ```typescript
 * const generator = new WeatherGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...', anthropic: 'sk-ant-...' },
 *   weatherService
 * );
 *
 * const content = await generator.generate({
 *   timestamp: new Date().toISOString(),
 *   timezone: 'America/New_York'
 * });
 *
 * console.log(content.text); // "SUNNY 72°F\nPERFECT DAY AHEAD..."
 * ```
 */

import { AIPromptGenerator, type AIProviderAPIKeys } from '../ai-prompt-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector, type ModelSelection } from '../../../api/ai/model-tier-selector.js';
import { createAIProvider, AIProviderType } from '../../../api/ai/index.js';
import { generatePersonalityDimensions } from '../../personality/index.js';
import { WeatherService, type WeatherData } from '../../../services/weather-service.js';
import type { GenerationContext, GeneratedContent } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';
import type { AIProvider } from '../../../types/ai.js';

/**
 * Generates weather-focused content
 *
 * Extends AIPromptGenerator with weather-specific prompts,
 * efficient LIGHT model tier selection, and real-time weather
 * data injection via WeatherService.
 */
export class WeatherGenerator extends AIPromptGenerator {
  private readonly weatherService: WeatherService | null;

  /**
   * Creates a new WeatherGenerator instance
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Record of provider names to API keys (e.g., {'openai': 'sk-...', 'anthropic': 'sk-ant-...'})
   * @param weatherService - Optional WeatherService for fetching real weather data
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {},
    weatherService?: WeatherService
  ) {
    // Use LIGHT tier for weather content (straightforward info, fast and cheap)
    super(promptLoader, modelTierSelector, ModelTierEnum.LIGHT, apiKeys);
    this.weatherService = weatherService ?? null;
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
   * Uses the weather-focus prompt which specifies the content type,
   * structure, and tone for weather-focused content.
   *
   * @returns Filename of the user prompt
   */
  protected getUserPromptFile(): string {
    return 'weather-focus.txt';
  }

  /**
   * Formats weather data into a string for prompt injection
   *
   * @param weather - Weather data from WeatherService
   * @returns Formatted weather string for prompt
   */
  private formatWeatherForPrompt(weather: WeatherData): string {
    const lines = [
      'CURRENT WEATHER:',
      `Condition: ${weather.condition}`,
      `Temperature: ${weather.temperature}${weather.temperatureUnit}`,
    ];

    if (weather.humidity !== undefined) {
      lines.push(`Humidity: ${weather.humidity}%`);
    }

    if (weather.apparentTemperature !== undefined) {
      lines.push(`Feels like: ${weather.apparentTemperature}${weather.temperatureUnit}`);
    }

    return lines.join('\n');
  }

  /**
   * Generates weather-focused content with real weather data injection
   *
   * Workflow:
   * 1. Fetch current weather from WeatherService (graceful fallback if unavailable)
   * 2. Format weather data for prompt template
   * 3. Load prompts with weather data injected via {{weather}} template variable
   * 4. Generate content using AI provider with failover support
   *
   * @param context - Context information for content generation
   * @returns Generated content with text and metadata
   * @throws Error if all AI providers fail
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Fetch weather data (graceful fallback)
    let weatherFormatted = 'Weather data unavailable';
    try {
      if (this.weatherService) {
        const weather = await this.weatherService.getWeather();
        if (weather) {
          weatherFormatted = this.formatWeatherForPrompt(weather);
        }
      }
    } catch (error) {
      console.error('Failed to fetch weather for prompt:', error);
    }

    // Step 2: Load system prompt with personality
    const personality = context.personality ?? generatePersonalityDimensions();
    const systemPrompt = await this.promptLoader.loadPromptWithVariables(
      'system',
      this.getSystemPromptFile(),
      {
        mood: personality.mood,
        energyLevel: personality.energyLevel,
        humorStyle: personality.humorStyle,
        obsession: personality.obsession,
        persona: 'Houseboy',
      }
    );

    // Step 3: Load user prompt with weather data injected
    const userPrompt = await this.promptLoader.loadPromptWithVariables(
      'user',
      this.getUserPromptFile(),
      { weather: weatherFormatted }
    );

    // If promptsOnly mode, return just the prompts without AI call
    // This is used by ToolBasedGenerator to get prompts for its own AI call with tools
    if (context.promptsOnly) {
      return {
        text: '',
        outputMode: 'text',
        metadata: {
          tier: this.modelTier,
          personality,
          systemPrompt,
          userPrompt,
          weatherInjected: weatherFormatted !== 'Weather data unavailable',
        },
      };
    }

    // Step 4: Select model and generate
    const selection: ModelSelection = this.modelTierSelector.select(this.modelTier);
    let lastError: Error | null = null;

    // Try preferred provider
    try {
      const provider = this.createProvider(selection);
      const response = await provider.generate({ systemPrompt, userPrompt });

      return {
        text: response.text,
        outputMode: 'text',
        metadata: {
          model: response.model,
          tier: this.modelTier,
          provider: selection.provider,
          tokensUsed: response.tokensUsed,
          personality,
          weatherInjected: weatherFormatted !== 'Weather data unavailable',
        },
      };
    } catch (error) {
      lastError = error as Error;
    }

    // Try alternate provider
    const alternate = this.modelTierSelector.getAlternate(selection);
    if (alternate) {
      try {
        const alternateProvider = this.createProvider(alternate);
        const response = await alternateProvider.generate({ systemPrompt, userPrompt });

        return {
          text: response.text,
          outputMode: 'text',
          metadata: {
            model: response.model,
            tier: this.modelTier,
            provider: alternate.provider,
            tokensUsed: response.tokensUsed,
            failedOver: true,
            primaryError: lastError?.message,
            personality,
            weatherInjected: weatherFormatted !== 'Weather data unavailable',
          },
        };
      } catch (alternateError) {
        lastError = alternateError as Error;
      }
    }

    throw new Error(`All AI providers failed for tier ${this.modelTier}: ${lastError?.message}`);
  }

  /**
   * Creates an AI provider instance for the given selection
   */
  protected createProvider(selection: ModelSelection): AIProvider {
    const apiKey = this['apiKeys'][selection.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${selection.provider}`);
    }
    return createAIProvider(selection.provider as AIProviderType, apiKey, selection.model);
  }
}
