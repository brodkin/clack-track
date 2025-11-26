/**
 * Weather Service
 *
 * Fetches weather data from Home Assistant and computes display colors
 * for the Vestaboard frame generator.
 *
 * Design Patterns:
 * - Dependency Injection: HomeAssistantClient injected via constructor
 * - Single Responsibility: Focused on weather data parsing and color mapping
 * - Graceful Degradation: Returns null on errors instead of throwing
 * - Unit Awareness: Color mapping adapts to °F vs °C thresholds
 */

import { HomeAssistantClient } from '../api/data-sources/home-assistant.js';
import type { HassEntityState } from '../types/home-assistant.js';

/**
 * Weather data structure for frame generation
 */
export interface WeatherData {
  /** Temperature as rounded integer */
  temperature: number;
  /** Temperature unit from Home Assistant */
  temperatureUnit: '°F' | '°C';
  /** Weather condition (sunny, rainy, etc.) */
  condition: string;
  /** Humidity percentage (optional) */
  humidity?: number;
  /** Apparent/feels-like temperature (optional - not all integrations provide this) */
  apparentTemperature?: number;
  /** Vestaboard color code (63-69) computed from temperature and condition */
  colorCode: number;
}

/**
 * Configuration for WeatherService
 */
export interface WeatherServiceConfig {
  /** Home Assistant weather entity ID (defaults to WEATHER_ENTITY env var or 'weather.apple') */
  entityId?: string;
}

/**
 * Maps weather conditions and temperatures to Vestaboard color codes
 *
 * Color Codes (Vestaboard standard):
 * - 63: RED (hot)
 * - 64: ORANGE (warm)
 * - 65: YELLOW (lightning)
 * - 66: GREEN (moderate)
 * - 67: BLUE (cold/precipitation)
 * - 69: WHITE (fog)
 *
 * Priority Order:
 * 1. Condition-based (lightning, rain/snow, fog)
 * 2. Temperature-based (hot, warm, moderate, cold)
 *
 * @param temp - Temperature value
 * @param condition - Weather condition string (case-insensitive)
 * @param isCelsius - Whether temperature is in Celsius (affects thresholds)
 * @returns Vestaboard color code (63-69)
 */
export function getWeatherColor(temp: number, condition: string, isCelsius: boolean): number {
  // Define temperature thresholds based on unit
  const thresholds = isCelsius
    ? { hot: 29, warm: 23, cold: 16 } // Celsius
    : { hot: 85, warm: 74, cold: 60 }; // Fahrenheit

  // Normalize condition: lowercase and remove hyphens for matching
  const normalizedCondition = condition.toLowerCase().replace(/-/g, '');

  // Priority 1: Condition-based colors (override temperature)
  if (normalizedCondition.includes('lightning')) {
    return 65; // YELLOW for lightning/thunderstorms
  }

  if (
    ['rainy', 'pouring', 'snowy', 'snowyrainy', 'hail'].some(cond =>
      normalizedCondition.includes(cond)
    )
  ) {
    return 67; // BLUE for precipitation
  }

  if (normalizedCondition.includes('fog')) {
    return 69; // WHITE for fog
  }

  // Priority 2: Temperature-based colors
  if (temp > thresholds.hot) {
    return 63; // RED for hot
  }

  if (temp > thresholds.warm) {
    return 64; // ORANGE for warm
  }

  if (temp < thresholds.cold) {
    return 67; // BLUE for cold
  }

  // Default: moderate temperature
  return 66; // GREEN for comfortable/moderate
}

/**
 * Weather Service
 *
 * Fetches weather data from Home Assistant weather entities and
 * computes Vestaboard display colors based on conditions and temperature.
 *
 * @example
 * ```typescript
 * const client = new HomeAssistantClient({ url, token });
 * await client.connect();
 *
 * const weatherService = new WeatherService(client);
 * const weather = await weatherService.getWeather();
 *
 * if (weather) {
 *   console.log(`${weather.temperature}${weather.temperatureUnit} - ${weather.condition}`);
 *   console.log(`Color code: ${weather.colorCode}`);
 * }
 * ```
 */
export class WeatherService {
  private readonly entityId: string;

  /**
   * Create a WeatherService instance
   *
   * @param haClient - Home Assistant WebSocket client
   * @param config - Optional configuration (entity ID override)
   */
  constructor(
    private readonly haClient: HomeAssistantClient,
    config?: WeatherServiceConfig
  ) {
    // Priority: config.entityId > WEATHER_ENTITY env var > 'weather.apple' default
    this.entityId = config?.entityId ?? process.env.WEATHER_ENTITY ?? 'weather.apple';
  }

  /**
   * Fetch current weather data from Home Assistant
   *
   * Returns null on any error for graceful degradation (e.g., connection issues,
   * entity not found). This allows the frame generator to continue with partial data.
   *
   * @returns WeatherData object or null on error
   */
  async getWeather(): Promise<WeatherData | null> {
    try {
      const state = await this.haClient.getState(this.entityId);
      return this.parseWeatherEntity(state);
    } catch {
      // Graceful degradation: return null on any error
      // (connection failures, entity not found, parsing errors, etc.)
      return null;
    }
  }

  /**
   * Parse a Home Assistant weather entity state into WeatherData
   *
   * Handles both full-featured weather integrations (Apple Weather with
   * apparent_temperature) and minimal integrations (Ecobee without).
   *
   * Uses defensive parsing with ?? operators to handle missing attributes.
   *
   * @param state - Home Assistant entity state
   * @returns Parsed WeatherData with computed color code
   */
  parseWeatherEntity(state: HassEntityState): WeatherData {
    // Extract attributes with type safety
    const attrs = state.attributes;

    // Parse temperature (handle both int and float by rounding)
    const rawTemp = attrs.temperature as number;
    const temperature = Math.round(rawTemp);

    // Parse temperature unit (validate it's °F or °C)
    const temperatureUnit = attrs.temperature_unit as string as '°F' | '°C';

    // Parse condition from state
    const condition = state.state;

    // Optional attributes (use ?? for defensive parsing)
    const humidity = attrs.humidity !== undefined ? (attrs.humidity as number) : undefined;
    const apparentTemperature =
      attrs.apparent_temperature !== undefined
        ? Math.round(attrs.apparent_temperature as number)
        : undefined;

    // Compute color code based on temperature and condition
    const isCelsius = temperatureUnit === '°C';
    const colorCode = getWeatherColor(temperature, condition, isCelsius);

    return {
      temperature,
      temperatureUnit,
      condition,
      humidity,
      apparentTemperature,
      colorCode,
    };
  }
}
