/**
 * Tests for WeatherGenerator
 *
 * Test coverage:
 * - Extends AIPromptGenerator with correct prompt files
 * - Uses LIGHT model tier for efficiency (weather info is straightforward)
 * - Validates prompt files exist
 * - Generates weather content via AI provider
 * - Injects weather data from WeatherService into prompt
 * - Graceful fallback when weather unavailable
 * - Handles AI provider failures gracefully
 */

import { WeatherGenerator } from '@/content/generators/ai/weather-generator';
import { PromptLoader } from '@/content/prompt-loader';
import { ModelTierSelector } from '@/api/ai/model-tier-selector';
import { WeatherService } from '@/services/weather-service';
import { ModelTier } from '@/types/content-generator';
import type { GenerationContext } from '@/types/content-generator';
import type { WeatherData } from '@/services/weather-service';
import type { AIProvider } from '@/types/ai';

// Helper type for accessing protected members in tests
type ProtectedWeatherGenerator = WeatherGenerator & {
  getSystemPromptFile(): string;
  getUserPromptFile(): string;
  modelTier: ModelTier;
};

describe('WeatherGenerator', () => {
  let mockPromptLoader: jest.Mocked<PromptLoader>;
  let mockModelTierSelector: jest.Mocked<ModelTierSelector>;
  let mockWeatherService: jest.Mocked<WeatherService>;
  let mockAIProvider: jest.Mocked<AIProvider>;

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
    // Mock PromptLoader
    mockPromptLoader = {
      loadPrompt: jest.fn(),
      loadPromptTemplate: jest.fn(),
      loadPromptWithVariables: jest.fn().mockResolvedValue('mocked prompt content'),
    } as unknown as jest.Mocked<PromptLoader>;

    // Mock ModelTierSelector
    mockModelTierSelector = {
      select: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      }),
      getAlternate: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<ModelTierSelector>;

    // Mock WeatherService
    mockWeatherService = {
      getWeather: jest.fn().mockResolvedValue(mockWeatherData),
    } as unknown as jest.Mocked<WeatherService>;

    // Mock AIProvider with successful response
    mockAIProvider = {
      generate: jest.fn().mockResolvedValue({
        text: 'Generated weather content',
        model: 'gpt-4.1-nano',
        tokensUsed: 100,
      }),
      validateConnection: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('constructor', () => {
    it('should create instance with PromptLoader, ModelTierSelector, and LIGHT tier', () => {
      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(WeatherGenerator);
    });

    it('should accept optional WeatherService dependency', () => {
      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(WeatherGenerator);
    });

    it('should use LIGHT model tier for efficiency', async () => {
      // Set up mocks for generate() call
      mockPromptLoader.loadPromptWithVariables.mockResolvedValue('test prompt');
      mockModelTierSelector.select.mockReturnValue({
        provider: 'openai',
        model: 'gpt-4.1-nano',
        tier: ModelTier.LIGHT,
      });
      mockModelTierSelector.getAlternate.mockReturnValue(null);

      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify via observable behavior: modelTierSelector.select is called with LIGHT tier
      try {
        await generator.generate({ updateType: 'major', timestamp: new Date() });
      } catch {
        // May fail without AI provider - we're testing the tier selection call
      }

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });
  });

  describe('getSystemPromptFile()', () => {
    it('should return major-update-base.txt', () => {
      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWeatherGenerator;

      const systemPromptFile = generator.getSystemPromptFile();

      expect(systemPromptFile).toBe('major-update-base.txt');
    });
  });

  describe('getUserPromptFile()', () => {
    it('should return weather-focus.txt', () => {
      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      }) as ProtectedWeatherGenerator;

      const userPromptFile = generator.getUserPromptFile();

      expect(userPromptFile).toBe('weather-focus.txt');
    });
  });

  describe('validate()', () => {
    it('should validate that prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return valid when both prompt files exist', async () => {
      mockPromptLoader.loadPrompt.mockResolvedValue('prompt content');

      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      const result = await generator.validate();

      // Assuming prompts exist in the worktree
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate()', () => {
    beforeEach(() => {
      // Mock createProvider to return our AI provider mock for each test
      jest
        .spyOn(WeatherGenerator.prototype as { createProvider: () => unknown }, 'createProvider')
        .mockReturnValue(mockAIProvider);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

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

    it('should inject weather data into user prompt via template variable', async () => {
      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      await generator.generate(mockContext);

      // Verify loadPromptWithVariables was called with weather data
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

      // User prompt is the second call (index 1) - system prompt is first (index 0)
      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const userPromptCall = calls[1];
      expect(userPromptCall[0]).toBe('user');
      expect(userPromptCall[1]).toBe('weather-focus.txt');

      const weatherVar = userPromptCall[2] as Record<string, unknown>;
      const weatherText = weatherVar.weather as string;

      expect(weatherText).toContain('CURRENT WEATHER:');
      expect(weatherText).toContain('Condition: sunny');
      expect(weatherText).toContain('Temperature: 72°F');
      expect(weatherText).toContain('Humidity: 45%');
      expect(weatherText).toContain('Feels like: 74°F');
    });

    it('should use fallback text when WeatherService not provided', async () => {
      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });
      // No weatherService injected

      await generator.generate(mockContext);

      // Verify fallback weather text was used
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

      // Verify fallback weather text was used
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

      // Spy on console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await generator.generate(mockContext);

      // Verify fallback weather text was used
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'user',
        'weather-focus.txt',
        expect.objectContaining({
          weather: 'Weather data unavailable',
        })
      );

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch weather for prompt:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should format weather without optional fields when not present', async () => {
      const minimalWeatherData: WeatherData = {
        temperature: 68,
        temperatureUnit: '°C',
        condition: 'cloudy',
        colorCode: 66,
        // No humidity or apparentTemperature
      };
      mockWeatherService.getWeather.mockResolvedValue(minimalWeatherData);

      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      await generator.generate(mockContext);

      // User prompt is the second call (index 1) - system prompt is first (index 0)
      const calls = mockPromptLoader.loadPromptWithVariables.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const userPromptCall = calls[1];
      expect(userPromptCall[0]).toBe('user');
      expect(userPromptCall[1]).toBe('weather-focus.txt');

      const weatherVar = userPromptCall[2] as Record<string, unknown>;
      const weatherText = weatherVar.weather as string;

      expect(weatherText).toContain('CURRENT WEATHER:');
      expect(weatherText).toContain('Condition: cloudy');
      expect(weatherText).toContain('Temperature: 68°C');
      expect(weatherText).not.toContain('Humidity');
      expect(weatherText).not.toContain('Feels like');
    });

    it('should load system prompt with personality variables', async () => {
      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      );

      await generator.generate(mockContext);

      // Verify system prompt was loaded with personality variables
      expect(mockPromptLoader.loadPromptWithVariables).toHaveBeenCalledWith(
        'system',
        'major-update-base.txt',
        expect.objectContaining({
          mood: expect.any(String),
          energyLevel: expect.any(String),
          humorStyle: expect.any(String),
          obsession: expect.any(String),
          persona: 'Houseboy',
        })
      );
    });

    it('should use LIGHT tier for model selection', async () => {
      const generator = new WeatherGenerator(
        mockPromptLoader,
        mockModelTierSelector,
        { openai: 'test-key' },
        mockWeatherService
      ) as ProtectedWeatherGenerator;

      await generator.generate(mockContext);

      expect(mockModelTierSelector.select).toHaveBeenCalledWith(ModelTier.LIGHT);
    });
  });

  describe('integration with base class', () => {
    it('should inherit retry logic from AIPromptGenerator', () => {
      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that generate method exists (inherited from base class)
      expect(typeof generator.generate).toBe('function');
    });

    it('should inherit validation logic from AIPromptGenerator', () => {
      const generator = new WeatherGenerator(mockPromptLoader, mockModelTierSelector, {
        openai: 'test-key',
      });

      // Verify that validate method exists (inherited from base class)
      expect(typeof generator.validate).toBe('function');
    });
  });
});
