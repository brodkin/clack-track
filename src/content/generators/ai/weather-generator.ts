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
 * Uses Template Method hooks:
 * - getTemplateVariables(): Injects weather data into prompt
 * - getCustomMetadata(): Tracks whether weather was successfully injected
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
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import { WeatherService, type WeatherData } from '../../../services/weather-service.js';
import type { GenerationContext } from '../../../types/content-generator.js';
import { ModelTier as ModelTierEnum } from '../../../types/content-generator.js';

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
   * Tracks whether weather data was successfully injected
   */
  private weatherInjected: boolean = false;

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
   * Hook: Fetches weather data and returns as template variable.
   *
   * Fetches current weather from WeatherService and formats it
   * for prompt injection via {{weather}} template variable.
   *
   * @param _context - Generation context (unused, but required by hook signature)
   * @returns Template variables with weather string
   */
  protected async getTemplateVariables(
    _context: GenerationContext
  ): Promise<Record<string, string>> {
    // Reset weather injection status
    this.weatherInjected = false;
    let weatherFormatted = 'Weather data unavailable';

    try {
      if (this.weatherService) {
        const weather = await this.weatherService.getWeather();
        if (weather) {
          weatherFormatted = this.formatWeatherForPrompt(weather);
          this.weatherInjected = true;
        }
      }
    } catch (error) {
      console.error('Failed to fetch weather for prompt:', error);
    }

    return { weather: weatherFormatted };
  }

  /**
   * Hook: Returns weather injection status in metadata.
   *
   * @returns Metadata indicating if weather was successfully injected
   */
  protected getCustomMetadata(): Record<string, unknown> {
    return {
      weatherInjected: this.weatherInjected,
    };
  }
}
