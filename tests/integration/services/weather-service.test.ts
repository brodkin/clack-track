/**
 * Unit tests for WeatherService
 *
 * Tests the weather data fetching and color mapping logic.
 * All Home Assistant calls are mocked.
 */

import { HomeAssistantClient } from '@/api/data-sources/home-assistant';
import { WeatherService } from '@/services/weather-service';
import type { HassEntityState } from '@/types/home-assistant';

// Mock the home-assistant-js-websocket library
jest.mock('home-assistant-js-websocket', () => ({
  createConnection: jest.fn(),
  createLongLivedTokenAuth: jest.fn(),
  getStates: jest.fn(),
  callService: jest.fn(),
}));

/**
 * Create a mock HomeAssistantClient for testing
 */
function createMockHomeAssistantClient(
  mockState: HassEntityState | null = null,
  shouldThrow = false
): HomeAssistantClient {
  const client = {
    getState: jest.fn(async (entityId: string) => {
      if (shouldThrow) {
        throw new Error('Connection failed');
      }
      if (!mockState) {
        throw new Error(`Entity not found: ${entityId}`);
      }
      return mockState;
    }),
    isConnected: jest.fn(() => !shouldThrow),
  } as unknown as HomeAssistantClient;

  return client;
}

describe('WeatherService', () => {
  describe('getWeatherColor', () => {
    // Import the function for direct testing
    let getWeatherColor: (temp: number, condition: string, isCelsius: boolean) => number;

    beforeAll(async () => {
      const module = await import('@/services/weather-service');
      getWeatherColor = module.getWeatherColor;
    });

    describe('Fahrenheit temperatures', () => {
      test('returns RED (63) for hot temperatures (>85°F)', () => {
        expect(getWeatherColor(90, 'sunny', false)).toBe(63);
        expect(getWeatherColor(100, 'clear', false)).toBe(63);
        expect(getWeatherColor(86, 'partlycloudy', false)).toBe(63);
      });

      test('returns ORANGE (64) for warm temperatures (75-85°F)', () => {
        expect(getWeatherColor(80, 'sunny', false)).toBe(64);
        expect(getWeatherColor(75, 'clear', false)).toBe(64);
        expect(getWeatherColor(84, 'partlycloudy', false)).toBe(64);
      });

      test('returns BLUE (67) for cold temperatures (<60°F)', () => {
        expect(getWeatherColor(50, 'sunny', false)).toBe(67);
        expect(getWeatherColor(32, 'clear', false)).toBe(67);
        expect(getWeatherColor(59, 'partlycloudy', false)).toBe(67);
      });

      test('returns GREEN (66) for moderate temperatures (60-74°F)', () => {
        expect(getWeatherColor(65, 'sunny', false)).toBe(66);
        expect(getWeatherColor(70, 'clear', false)).toBe(66);
        expect(getWeatherColor(60, 'partlycloudy', false)).toBe(66);
      });
    });

    describe('Celsius temperatures', () => {
      test('returns RED (63) for hot temperatures (>29°C)', () => {
        expect(getWeatherColor(35, 'sunny', true)).toBe(63);
        expect(getWeatherColor(30, 'clear', true)).toBe(63);
        expect(getWeatherColor(40, 'partlycloudy', true)).toBe(63);
      });

      test('returns ORANGE (64) for warm temperatures (24-29°C)', () => {
        expect(getWeatherColor(25, 'sunny', true)).toBe(64);
        expect(getWeatherColor(28, 'clear', true)).toBe(64);
        expect(getWeatherColor(24, 'partlycloudy', true)).toBe(64);
      });

      test('returns BLUE (67) for cold temperatures (<16°C)', () => {
        expect(getWeatherColor(10, 'sunny', true)).toBe(67);
        expect(getWeatherColor(0, 'clear', true)).toBe(67);
        expect(getWeatherColor(15, 'partlycloudy', true)).toBe(67);
      });

      test('returns GREEN (66) for moderate temperatures (16-23°C)', () => {
        expect(getWeatherColor(20, 'sunny', true)).toBe(66);
        expect(getWeatherColor(18, 'clear', true)).toBe(66);
        expect(getWeatherColor(23, 'partlycloudy', true)).toBe(66);
      });
    });

    describe('condition priority (overrides temperature)', () => {
      test('returns YELLOW (65) for lightning conditions', () => {
        expect(getWeatherColor(75, 'lightning', false)).toBe(65);
        expect(getWeatherColor(25, 'lightning-rainy', true)).toBe(65);
      });

      test('returns BLUE (67) for rainy conditions', () => {
        expect(getWeatherColor(75, 'rainy', false)).toBe(67);
        expect(getWeatherColor(25, 'pouring', true)).toBe(67);
        expect(getWeatherColor(80, 'snowy', false)).toBe(67);
        expect(getWeatherColor(30, 'snowy-rainy', true)).toBe(67);
        expect(getWeatherColor(75, 'hail', false)).toBe(67);
      });

      test('returns WHITE (69) for fog conditions', () => {
        expect(getWeatherColor(75, 'fog', false)).toBe(69);
        expect(getWeatherColor(25, 'fog', true)).toBe(69);
      });

      test('handles case-insensitive and hyphenated conditions', () => {
        expect(getWeatherColor(75, 'LIGHTNING', false)).toBe(65);
        expect(getWeatherColor(75, 'Lightning-Rainy', false)).toBe(65);
        expect(getWeatherColor(75, 'clear-night', false)).toBe(64); // No special condition, falls through to temp
      });
    });
  });

  describe('parseWeatherEntity', () => {
    let service: WeatherService;
    let mockClient: HomeAssistantClient;

    beforeEach(() => {
      mockClient = createMockHomeAssistantClient();
      service = new WeatherService(mockClient);
    });

    test('parses full attributes (Apple Weather style)', () => {
      const state: HassEntityState = {
        entity_id: 'weather.apple',
        state: 'clear-night',
        attributes: {
          temperature: 54,
          apparent_temperature: 51,
          temperature_unit: '°F',
          humidity: 73,
        },
        last_changed: '2025-01-01T00:00:00Z',
        last_updated: '2025-01-01T00:00:00Z',
      };

      const result = service.parseWeatherEntity(state);

      expect(result.temperature).toBe(54);
      expect(result.temperatureUnit).toBe('°F');
      expect(result.condition).toBe('clear-night');
      expect(result.humidity).toBe(73);
      expect(result.apparentTemperature).toBe(51);
      expect(result.colorCode).toBe(67); // <60°F = BLUE
    });

    test('parses minimal attributes (Ecobee style - no apparent_temperature)', () => {
      const state: HassEntityState = {
        entity_id: 'weather.my_ecobee',
        state: 'sunny',
        attributes: {
          temperature: 54,
          temperature_unit: '°F',
          humidity: 76,
        },
        last_changed: '2025-01-01T00:00:00Z',
        last_updated: '2025-01-01T00:00:00Z',
      };

      const result = service.parseWeatherEntity(state);

      expect(result.temperature).toBe(54);
      expect(result.temperatureUnit).toBe('°F');
      expect(result.condition).toBe('sunny');
      expect(result.humidity).toBe(76);
      expect(result.apparentTemperature).toBeUndefined();
      expect(result.colorCode).toBe(67); // <60°F = BLUE
    });

    test('handles floating-point temperatures with rounding', () => {
      const state: HassEntityState = {
        entity_id: 'weather.test',
        state: 'sunny',
        attributes: {
          temperature: 72.7,
          temperature_unit: '°F',
        },
        last_changed: '2025-01-01T00:00:00Z',
        last_updated: '2025-01-01T00:00:00Z',
      };

      const result = service.parseWeatherEntity(state);

      expect(result.temperature).toBe(73); // Math.round(72.7)
      expect(result.colorCode).toBe(66); // 60-74°F = GREEN
    });

    test('handles Celsius temperatures', () => {
      const state: HassEntityState = {
        entity_id: 'weather.test',
        state: 'sunny',
        attributes: {
          temperature: 25,
          temperature_unit: '°C',
          humidity: 60,
        },
        last_changed: '2025-01-01T00:00:00Z',
        last_updated: '2025-01-01T00:00:00Z',
      };

      const result = service.parseWeatherEntity(state);

      expect(result.temperature).toBe(25);
      expect(result.temperatureUnit).toBe('°C');
      expect(result.colorCode).toBe(64); // 24-29°C = ORANGE
    });

    test('handles missing humidity gracefully', () => {
      const state: HassEntityState = {
        entity_id: 'weather.test',
        state: 'sunny',
        attributes: {
          temperature: 70,
          temperature_unit: '°F',
        },
        last_changed: '2025-01-01T00:00:00Z',
        last_updated: '2025-01-01T00:00:00Z',
      };

      const result = service.parseWeatherEntity(state);

      expect(result.temperature).toBe(70);
      expect(result.humidity).toBeUndefined();
    });
  });

  describe('getWeather', () => {
    test('returns null on Home Assistant connection error', async () => {
      const mockClient = createMockHomeAssistantClient(null, true);
      const service = new WeatherService(mockClient);

      const result = await service.getWeather();

      expect(result).toBeNull();
      expect(mockClient.getState).toHaveBeenCalledWith('weather.apple'); // Default entity
    });

    test('returns valid data on success with default entity', async () => {
      const mockState: HassEntityState = {
        entity_id: 'weather.apple',
        state: 'sunny',
        attributes: {
          temperature: 75,
          apparent_temperature: 73,
          temperature_unit: '°F',
          humidity: 65,
        },
        last_changed: '2025-01-01T00:00:00Z',
        last_updated: '2025-01-01T00:00:00Z',
      };

      const mockClient = createMockHomeAssistantClient(mockState);
      const service = new WeatherService(mockClient);

      const result = await service.getWeather();

      expect(result).not.toBeNull();
      expect(result?.temperature).toBe(75);
      expect(result?.temperatureUnit).toBe('°F');
      expect(result?.condition).toBe('sunny');
      expect(result?.humidity).toBe(65);
      expect(result?.apparentTemperature).toBe(73);
      expect(result?.colorCode).toBe(64); // 75-85°F = ORANGE
    });

    test('returns valid data with custom entity ID from config', async () => {
      const mockState: HassEntityState = {
        entity_id: 'weather.custom',
        state: 'rainy',
        attributes: {
          temperature: 60,
          temperature_unit: '°F',
        },
        last_changed: '2025-01-01T00:00:00Z',
        last_updated: '2025-01-01T00:00:00Z',
      };

      const mockClient = createMockHomeAssistantClient(mockState);
      const service = new WeatherService(mockClient, { entityId: 'weather.custom' });

      const result = await service.getWeather();

      expect(result).not.toBeNull();
      expect(result?.colorCode).toBe(67); // rainy = BLUE (condition priority)
      expect(mockClient.getState).toHaveBeenCalledWith('weather.custom');
    });

    test('respects WEATHER_ENTITY environment variable', async () => {
      const originalEnv = process.env.WEATHER_ENTITY;
      process.env.WEATHER_ENTITY = 'weather.env_test';

      const mockState: HassEntityState = {
        entity_id: 'weather.env_test',
        state: 'sunny',
        attributes: {
          temperature: 70,
          temperature_unit: '°F',
        },
        last_changed: '2025-01-01T00:00:00Z',
        last_updated: '2025-01-01T00:00:00Z',
      };

      const mockClient = createMockHomeAssistantClient(mockState);
      const service = new WeatherService(mockClient);

      const result = await service.getWeather();

      expect(result).not.toBeNull();
      expect(mockClient.getState).toHaveBeenCalledWith('weather.env_test');

      // Cleanup
      if (originalEnv !== undefined) {
        process.env.WEATHER_ENTITY = originalEnv;
      } else {
        delete process.env.WEATHER_ENTITY;
      }
    });

    test('returns null when entity not found', async () => {
      const mockClient = createMockHomeAssistantClient(null, false);
      const service = new WeatherService(mockClient);

      const result = await service.getWeather();

      expect(result).toBeNull();
    });
  });
});
