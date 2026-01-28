/**
 * ContentDataProvider Test Suite
 *
 * TDD Phase: RED - Writing failing tests before implementation
 *
 * Test Coverage:
 * - Successful fetch of both weather and color data
 * - Weather service failure with graceful degradation
 * - Color service failure with graceful degradation
 * - Both services failing with graceful degradation
 * - Warning accumulation for partial failures
 * - Timestamp tracking
 */

import { ContentDataProvider } from '../../../src/services/content-data-provider.js';
import type { WeatherService } from '../../../src/services/weather-service.js';
import type { ColorBarService } from '../../../src/content/frame/color-bar.js';
import type { WeatherData } from '../../../src/services/weather-service.js';
import type { ColorResult } from '../../../src/content/frame/color-bar.js';

describe('ContentDataProvider', () => {
  let mockWeatherService: jest.Mocked<WeatherService>;
  let mockColorBarService: jest.Mocked<ColorBarService>;
  let provider: ContentDataProvider;

  beforeEach(() => {
    jest.useFakeTimers();

    // Mock WeatherService
    mockWeatherService = {
      getWeather: jest.fn(),
    } as unknown as jest.Mocked<WeatherService>;

    // Mock ColorBarService
    mockColorBarService = {
      getColors: jest.fn(),
    } as unknown as jest.Mocked<ColorBarService>;

    provider = new ContentDataProvider(mockWeatherService, mockColorBarService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('fetchData()', () => {
    describe('successful data fetching', () => {
      it('should fetch both weather and color data successfully', async () => {
        // Arrange
        const mockWeather: WeatherData = {
          temperature: 72,
          temperatureUnit: '°F',
          condition: 'sunny',
          humidity: 65,
          colorCode: 66,
        };

        const mockColorResult: ColorResult = {
          colors: [67, 66, 65, 64, 63, 68],
          cacheHit: true,
        };

        mockWeatherService.getWeather.mockResolvedValue(mockWeather);
        mockColorBarService.getColors.mockResolvedValue(mockColorResult);

        // Act
        const result = await provider.fetchData();

        // Assert
        expect(result.weather).toEqual(mockWeather);
        expect(result.colorBar).toEqual(mockColorResult.colors);
        expect(result.warnings).toEqual([]);
        expect(result.fetchedAt).toBeInstanceOf(Date);
      });

      it('should have fetchedAt timestamp close to current time', async () => {
        // Arrange
        const beforeFetch = new Date();
        mockWeatherService.getWeather.mockResolvedValue(null);
        mockColorBarService.getColors.mockResolvedValue({
          colors: [67, 66, 65, 64, 63, 68],
          cacheHit: false,
        });

        // Act
        const result = await provider.fetchData();
        const afterFetch = new Date();

        // Assert
        expect(result.fetchedAt.getTime()).toBeGreaterThanOrEqual(beforeFetch.getTime());
        expect(result.fetchedAt.getTime()).toBeLessThanOrEqual(afterFetch.getTime());
      });
    });

    describe('graceful degradation - weather failures', () => {
      it('should continue with color data when weather service fails', async () => {
        // Arrange
        const mockColorResult: ColorResult = {
          colors: [67, 66, 65, 64, 63, 68],
          cacheHit: true,
        };

        mockWeatherService.getWeather.mockRejectedValue(new Error('Weather API unavailable'));
        mockColorBarService.getColors.mockResolvedValue(mockColorResult);

        // Act
        const result = await provider.fetchData();

        // Assert
        expect(result.weather).toBeUndefined();
        expect(result.colorBar).toEqual(mockColorResult.colors);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('Weather');
        expect(result.fetchedAt).toBeInstanceOf(Date);
      });

      it('should handle weather service returning null', async () => {
        // Arrange
        const mockColorResult: ColorResult = {
          colors: [67, 66, 65, 64, 63, 68],
          cacheHit: false,
        };

        mockWeatherService.getWeather.mockResolvedValue(null);
        mockColorBarService.getColors.mockResolvedValue(mockColorResult);

        // Act
        const result = await provider.fetchData();

        // Assert
        expect(result.weather).toBeUndefined();
        expect(result.colorBar).toEqual(mockColorResult.colors);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('Weather data not available');
      });
    });

    describe('graceful degradation - color failures', () => {
      it('should continue with weather data when color service fails', async () => {
        // Arrange
        const mockWeather: WeatherData = {
          temperature: 72,
          temperatureUnit: '°F',
          condition: 'sunny',
          colorCode: 66,
        };

        mockWeatherService.getWeather.mockResolvedValue(mockWeather);
        mockColorBarService.getColors.mockRejectedValue(new Error('AI service unavailable'));

        // Act
        const result = await provider.fetchData();

        // Assert
        expect(result.weather).toEqual(mockWeather);
        expect(result.colorBar).toBeUndefined();
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('Color bar');
        expect(result.fetchedAt).toBeInstanceOf(Date);
      });
    });

    describe('graceful degradation - both services fail', () => {
      it('should return empty data with warnings when both services fail', async () => {
        // Arrange
        mockWeatherService.getWeather.mockRejectedValue(new Error('Weather API down'));
        mockColorBarService.getColors.mockRejectedValue(new Error('AI API down'));

        // Act
        const result = await provider.fetchData();

        // Assert
        expect(result.weather).toBeUndefined();
        expect(result.colorBar).toBeUndefined();
        expect(result.warnings).toHaveLength(2);
        expect(result.warnings[0]).toContain('Weather');
        expect(result.warnings[1]).toContain('Color bar');
        expect(result.fetchedAt).toBeInstanceOf(Date);
      });
    });

    describe('parallel execution', () => {
      it('should fetch both services in parallel using Promise.allSettled', async () => {
        // Arrange
        const mockWeather: WeatherData = {
          temperature: 68,
          temperatureUnit: '°F',
          condition: 'cloudy',
          colorCode: 67,
        };

        const mockColorResult: ColorResult = {
          colors: [67, 66, 65, 64, 63, 68],
          cacheHit: false,
        };

        let weatherResolved = false;
        let colorResolved = false;
        let bothResolvedSimultaneously = false;

        mockWeatherService.getWeather.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          weatherResolved = true;
          if (colorResolved) {
            bothResolvedSimultaneously = true;
          }
          return mockWeather;
        });

        mockColorBarService.getColors.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          colorResolved = true;
          if (weatherResolved) {
            bothResolvedSimultaneously = true;
          }
          return mockColorResult;
        });

        // Act
        const fetchPromise = provider.fetchData();
        await jest.advanceTimersByTimeAsync(10);
        const result = await fetchPromise;

        // Assert
        expect(weatherResolved).toBe(true);
        expect(colorResolved).toBe(true);
        expect(bothResolvedSimultaneously).toBe(true);
        expect(result.weather).toEqual(mockWeather);
        expect(result.colorBar).toEqual(mockColorResult.colors);
      });
    });
  });
});
