/**
 * Content Data Provider Service
 *
 * Aggregates data from multiple services (weather, colors, etc.) for content generation.
 * Uses Promise.allSettled for graceful degradation - continues with partial data if
 * individual services fail.
 *
 * Design Patterns:
 * - Dependency Injection: Services injected via constructor
 * - Graceful Degradation: Continues with partial data on failures
 * - Single Responsibility: Focused on data aggregation only
 * - Parallel Execution: Fetches all data sources simultaneously
 */

import type { WeatherService } from './weather-service.js';
import type { ColorBarService } from '../content/frame/color-bar.js';
import type { ContentData } from '../types/content-data.js';

/**
 * ContentDataProvider
 *
 * Fetches and aggregates data from multiple services for content generation.
 * All fetches happen in parallel using Promise.allSettled for optimal performance
 * and graceful degradation.
 *
 * @example
 * ```typescript
 * const weatherService = new WeatherService(haClient);
 * const colorBarService = ColorBarService.getInstance(aiProvider);
 * const provider = new ContentDataProvider(weatherService, colorBarService);
 *
 * const data = await provider.fetchData();
 * console.log(`Fetched at: ${data.fetchedAt}`);
 * console.log(`Weather available: ${!!data.weather}`);
 * console.log(`Colors available: ${!!data.colorBar}`);
 * console.log(`Warnings: ${data.warnings.length}`);
 * ```
 */
export class ContentDataProvider {
  /**
   * Create a ContentDataProvider instance
   *
   * @param weatherService - Service for fetching weather data from Home Assistant
   * @param colorBarService - Service for generating AI-powered seasonal colors
   */
  constructor(
    private readonly weatherService: WeatherService,
    private readonly colorBarService: ColorBarService
  ) {}

  /**
   * Fetch all content data in parallel with graceful degradation
   *
   * Uses Promise.allSettled to ensure all service calls complete independently.
   * Failed services result in warnings but don't block successful services.
   *
   * @returns ContentData with whatever data was successfully fetched
   *
   * @example
   * ```typescript
   * // All services succeed
   * const data = await provider.fetchData();
   * // data.weather: WeatherData
   * // data.colorBar: number[]
   * // data.warnings: []
   *
   * // Weather fails, colors succeed
   * const data = await provider.fetchData();
   * // data.weather: undefined
   * // data.colorBar: number[]
   * // data.warnings: ["Weather data fetch failed: ..."]
   * ```
   */
  async fetchData(): Promise<ContentData> {
    const fetchedAt = new Date();
    const warnings: string[] = [];

    // Fetch both services in parallel
    const [weatherResult, colorResult] = await Promise.allSettled([
      this.weatherService.getWeather(),
      this.colorBarService.getColors(),
    ]);

    // Process weather result
    let weather: ContentData['weather'];
    if (weatherResult.status === 'fulfilled') {
      if (weatherResult.value === null) {
        // WeatherService returns null on graceful failures
        warnings.push('Weather data not available');
      } else {
        weather = weatherResult.value;
      }
    } else {
      // Promise rejected - capture error
      warnings.push(`Weather data fetch failed: ${weatherResult.reason}`);
    }

    // Process color result
    let colorBar: ContentData['colorBar'];
    if (colorResult.status === 'fulfilled') {
      colorBar = colorResult.value.colors;
    } else {
      // Promise rejected - capture error
      warnings.push(`Color bar generation failed: ${colorResult.reason}`);
    }

    return {
      weather,
      colorBar,
      fetchedAt,
      warnings,
    };
  }
}
