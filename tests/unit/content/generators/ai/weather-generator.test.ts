/**
 * Tests for WeatherGenerator
 *
 * Generator-specific behavior:
 * - Weather data fetching from WeatherService
 * - Weather data injection into user prompt via getTemplateVariables()
 * - Weather data formatting with all available fields
 * - Graceful fallback when weather unavailable (no service, null, error)
 * - Optional field handling (humidity, apparentTemperature)
 * - weatherInjected metadata tracking via getCustomMetadata()
 */

import { WeatherGenerator } from '@/content/generators/ai/weather-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { WeatherService } from '@/services/weather-service';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { WeatherData } from '@/services/weather-service';
import { createMockAIProvider } from '@tests/__helpers__/mockAIProvider';

// Mock createAIProvider function to avoid real API calls
jest.mock('@/api/ai/index.js', () => ({
  createAIProvider: jest.fn(),
  AIProviderType: {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
  },
}));

// Mock personality generation for consistent tests
jest.mock('@/content/personality/index.js', () => ({
  generatePersonalityDimensions: jest.fn(() => ({
    mood: 'cheerful',
    energyLevel: 'high',
    humorStyle: 'witty',
    obsession: 'coffee',
  })),
}));

import { createAIProvider } from '@/api/ai/index.js';

describe('WeatherGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockWeatherService: jest.Mocked<WeatherService>;

  const mockWeatherData: WeatherData = {
    temperature: 72,
    temperatureUnit: '°F',
    condition: 'sunny',
    humidity: 45,
    apparentTemperature: 74,
    colorCode: 64,
  };

  const mockContext: GenerationContext = {
    updateType: 'major',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
    } as unknown as jest.Mocked<PromptLoader>;

    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    mockWeatherService = {
      getWeather: jest.fn().mockResolvedValue(mockWeatherData),
    } as unknown as jest.Mocked<WeatherService>;

    (createAIProvider as jest.Mock).mockReturnValue(
      createMockAIProvider({
        response: {
          text: 'Generated weather content',
          model: 'gpt-4.1-nano',
          tokensUsed: 100,
        },
      })
    );
  });

  describe('weather data fetching', () => {
    it('should fetch weather data from WeatherService when provided', async () => {
      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      await generator.generate(mockContext);

      expect(mockWeatherService.getWeather).toHaveBeenCalled();
    });

    it('should inject weather data into user prompt via getTemplateVariables() hook', async () => {
      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'weather-focus.txt',
        expect.objectContaining({
          weather: expect.stringContaining('CURRENT WEATHER:'),
        })
      );
    });

    it('should format weather data with all available fields', async () => {
      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const weatherVar = userPromptCall[2] as Record<string, unknown>;
      const weatherText = weatherVar.weather as string;

      expect(weatherText).toContain('CURRENT WEATHER:');
      expect(weatherText).toContain('Condition: sunny');
      expect(weatherText).toContain('Temperature: 72°F');
      expect(weatherText).toContain('Humidity: 45%');
      expect(weatherText).toContain('Feels like: 74°F');
    });
  });

  describe('fallback behavior', () => {
    it('should use fallback text when WeatherService not provided', async () => {
      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'weather-focus.txt',
        expect.objectContaining({
          weather: 'Weather data unavailable',
        })
      );
    });

    it('should use fallback text when WeatherService returns null', async () => {
      mockWeatherService.getWeather.mockResolvedValue(null);

      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'weather-focus.txt',
        expect.objectContaining({
          weather: 'Weather data unavailable',
        })
      );
    });

    it('should use fallback text when WeatherService throws error', async () => {
      mockWeatherService.getWeather.mockRejectedValue(new Error('Connection failed'));

      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await generator.generate(mockContext);

      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'weather-focus.txt',
        expect.objectContaining({
          weather: 'Weather data unavailable',
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch weather for prompt:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('optional field handling', () => {
    it('should format weather without optional fields when not present', async () => {
      const minimalWeatherData: WeatherData = {
        temperature: 68,
        temperatureUnit: '°C',
        condition: 'cloudy',
        colorCode: 66,
      };
      mockWeatherService.getWeather.mockResolvedValue(minimalWeatherData);

      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      await generator.generate(mockContext);

      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      const userPromptCall = calls[1];
      const weatherVar = userPromptCall[2] as Record<string, unknown>;
      const weatherText = weatherVar.weather as string;

      expect(weatherText).toContain('Condition: cloudy');
      expect(weatherText).toContain('Temperature: 68°C');
      expect(weatherText).not.toContain('Humidity');
      expect(weatherText).not.toContain('Feels like');
    });
  });

  describe('weatherInjected metadata', () => {
    it('should include weatherInjected true when weather was successfully injected', async () => {
      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      const result = await generator.generate(mockContext);

      expect(result.metadata?.weatherInjected).toBe(true);
    });

    it('should set weatherInjected to false when weather unavailable', async () => {
      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.generate(mockContext);

      expect(result.metadata?.weatherInjected).toBe(false);
    });
  });
});
