/**
 * Content Data Types
 *
 * Types for aggregated content data from multiple services.
 * Used by ContentDataProvider to collect weather, colors, and other
 * data sources for content generation.
 */

import type { WeatherData } from '../services/weather-service.js';

/**
 * Aggregated content data from multiple services
 *
 * Design Pattern: Graceful Degradation
 * - All data fields are optional (weather/colorBar)
 * - Services can fail independently without blocking others
 * - Warnings array captures non-fatal errors
 * - fetchedAt tracks when data was collected
 *
 * @example
 * ```typescript
 * const provider = new ContentDataProvider(weatherService, colorBarService);
 * const data = await provider.fetchData();
 *
 * if (data.weather) {
 *   console.log(`Temperature: ${data.weather.temperature}${data.weather.temperatureUnit}`);
 * }
 *
 * if (data.colorBar) {
 *   console.log(`Colors: ${data.colorBar.join(', ')}`);
 * }
 *
 * if (data.warnings.length > 0) {
 *   console.warn('Partial data:', data.warnings);
 * }
 * ```
 */
export interface ContentData {
  /**
   * Weather data from Home Assistant
   * Undefined if WeatherService fails or returns null
   */
  weather?: WeatherData;

  /**
   * Color bar data from AI service (array of 6 Vestaboard color codes 63-69)
   * Undefined if ColorBarService fails
   */
  colorBar?: number[];

  /**
   * Timestamp when data was fetched
   */
  fetchedAt: Date;

  /**
   * Non-fatal warnings for partial failures
   * Empty array if all services succeeded
   *
   * @example
   * [
   *   "Weather data fetch failed: Connection timeout",
   *   "Color bar generation failed: AI service unavailable"
   * ]
   */
  warnings: string[];
}
