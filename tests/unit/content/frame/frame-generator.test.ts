import { generateFrame, type FrameOptions } from '../../../../src/content/frame/frame-generator.js';
import { COLOR_CODES } from '../../../../src/api/vestaboard/character-converter.js';
import type { HomeAssistantClient } from '../../../../src/api/data-sources/home-assistant.js';
import type { AIProvider } from '../../../../src/types/ai.js';
import type { WeatherData } from '../../../../src/services/weather-service.js';

// Mock dependencies - use full relative paths from src
jest.mock('../../../../src/services/weather-service.js');
jest.mock('../../../../src/content/frame/color-bar.js', () => {
  const actual = jest.requireActual('../../../../src/content/frame/color-bar.js');
  return {
    ...actual,
    ColorBarService: jest.fn(),
  };
});

// Import mocked modules for type access
import { WeatherService } from '../../../../src/services/weather-service.js';
import { ColorBarService } from '../../../../src/content/frame/color-bar.js';

describe('generateFrame', () => {
  let mockHAClient: jest.Mocked<HomeAssistantClient>;
  let mockAIProvider: jest.Mocked<AIProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock HA client
    mockHAClient = {} as jest.Mocked<HomeAssistantClient>;

    // Mock AI provider
    mockAIProvider = {
      generate: jest.fn(),
      validateConnection: jest.fn(),
    } as unknown as jest.Mocked<AIProvider>;
  });

  describe('basic layout generation', () => {
    it('should return a 6×22 layout', async () => {
      const options: FrameOptions = {
        text: 'HELLO WORLD',
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      expect(result.layout).toHaveLength(6); // 6 rows
      result.layout.forEach(row => {
        expect(row).toHaveLength(22); // 22 columns each
      });
    });

    it('should place color bar in column 21 of all rows', async () => {
      const options: FrameOptions = {
        text: 'TEST',
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Column 21 should contain color codes (63-69)
      result.layout.forEach(row => {
        const colorCode = row[21];
        expect(colorCode).toBeGreaterThanOrEqual(63);
        expect(colorCode).toBeLessThanOrEqual(69);
      });
    });

    it('should place info bar in row 5', async () => {
      const options: FrameOptions = {
        text: 'TEST',
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Row 5 should contain the info bar
      // Info bar format: "WED 26NOV 10:30   " (21 chars)
      // We'll check that it's not all spaces (content exists)
      const infoRow = result.layout[5];
      const hasContent = infoRow.slice(0, 21).some(code => code !== 0);
      expect(hasContent).toBe(true);
    });
  });

  describe('content processing', () => {
    it('should wrap text at 21 characters per line', async () => {
      const longText = 'THIS IS A VERY LONG LINE THAT EXCEEDS TWENTY ONE CHARACTERS';
      const options: FrameOptions = {
        text: longText,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Check that no content line has more than 21 characters
      // (rows 0-4 are content, column 21 is color bar)
      for (let row = 0; row < 5; row++) {
        const contentCodes = result.layout[row].slice(0, 21);
        expect(contentCodes).toHaveLength(21);
      }

      expect(result.warnings).toEqual([]);
    });

    it('should limit content to 5 rows', async () => {
      const manyLines = Array(10).fill('LINE OF TEXT').join(' ');
      const options: FrameOptions = {
        text: manyLines,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have warning about truncation
      expect(result.warnings.some(w => /content truncated/i.test(w))).toBe(true);
    });

    it('should pad short lines to 21 characters', async () => {
      const options: FrameOptions = {
        text: 'SHORT',
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // All content rows should be exactly 21 chars + 1 color bar = 22
      for (let row = 0; row < 5; row++) {
        expect(result.layout[row]).toHaveLength(22);
      }
    });

    it('should warn about unsupported characters', async () => {
      const options: FrameOptions = {
        text: 'HELLO 🚀 WORLD',
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have warning about emoji
      expect(result.warnings.some(w => /unsupported characters/i.test(w))).toBe(true);
    });

    it('should replace unsupported characters with spaces', async () => {
      const options: FrameOptions = {
        text: 'A🚀B',
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Check that emoji was replaced with space
      // 'A🚀B' becomes 'A B' which is codes [1, 0, 2, ...]
      const firstRow = result.layout[0];
      expect(firstRow[0]).toBe(1); // A
      expect(firstRow[1]).toBe(0); // space (replaced emoji)
      expect(firstRow[2]).toBe(2); // B
    });
  });

  describe('weather integration', () => {
    it('should fetch weather when HA client is provided', async () => {
      const mockWeatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        condition: 'sunny',
        colorCode: COLOR_CODES.GREEN,
      };

      // Mock WeatherService.getWeather to return mock data
      (WeatherService as jest.MockedClass<typeof WeatherService>).mockImplementation(
        () =>
          ({
            getWeather: jest.fn().mockResolvedValue(mockWeatherData),
          }) as unknown as InstanceType<typeof WeatherService>
      );

      const options: FrameOptions = {
        text: 'TEST',
        homeAssistant: mockHAClient,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have called WeatherService
      expect(WeatherService).toHaveBeenCalledWith(mockHAClient);

      // Should not have weather warning
      expect(result.warnings.some(w => /weather unavailable/i.test(w))).toBe(false);
    });

    it('should handle missing HA client gracefully', async () => {
      const options: FrameOptions = {
        text: 'TEST',
        // No homeAssistant provided
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should complete successfully without weather
      expect(result.layout).toHaveLength(6);
      expect(result.warnings.some(w => /weather unavailable/i.test(w))).toBe(false);
    });

    it('should warn when weather fetch fails', async () => {
      // Mock WeatherService to throw error
      (WeatherService as jest.MockedClass<typeof WeatherService>).mockImplementation(
        () =>
          ({
            getWeather: jest.fn().mockRejectedValue(new Error('Connection timeout')),
          }) as unknown as InstanceType<typeof WeatherService>
      );

      const options: FrameOptions = {
        text: 'TEST',
        homeAssistant: mockHAClient,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have weather warning
      expect(result.warnings.some(w => /weather unavailable.*connection timeout/i.test(w))).toBe(
        true
      );

      // Should still complete successfully
      expect(result.layout).toHaveLength(6);
    });
  });

  describe('color bar integration', () => {
    it('should fetch seasonal colors when AI provider is provided', async () => {
      const mockColors = [
        COLOR_CODES.RED,
        COLOR_CODES.ORANGE,
        COLOR_CODES.YELLOW,
        COLOR_CODES.GREEN,
        COLOR_CODES.BLUE,
        COLOR_CODES.VIOLET,
      ];

      // Mock ColorBarService.getColors to return mock data
      (ColorBarService as jest.MockedClass<typeof ColorBarService>).mockImplementation(
        () =>
          ({
            getColors: jest.fn().mockResolvedValue(mockColors),
          }) as unknown as InstanceType<typeof ColorBarService>
      );

      const options: FrameOptions = {
        text: 'TEST',
        aiProvider: mockAIProvider,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have called ColorBarService
      expect(ColorBarService).toHaveBeenCalledWith(mockAIProvider);

      // Should use AI colors in column 21
      for (let row = 0; row < 6; row++) {
        expect(result.layout[row][21]).toBe(mockColors[row]);
      }

      // Should not have color warning
      expect(result.warnings.some(w => /color bar unavailable/i.test(w))).toBe(false);
    });

    it('should handle missing AI provider gracefully', async () => {
      const options: FrameOptions = {
        text: 'TEST',
        // No aiProvider provided
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should complete successfully with fallback colors
      expect(result.layout).toHaveLength(6);

      // Should use fallback colors - verify each row has a valid color code
      const expectedColors = [67, 66, 65, 64, 63, 68]; // FALLBACK_COLORS
      for (let row = 0; row < 6; row++) {
        expect(result.layout[row][21]).toBe(expectedColors[row]);
      }

      // Should not have color warning (fallback is silent)
      expect(result.warnings.some(w => /color bar unavailable/i.test(w))).toBe(false);
    });

    it('should warn when color fetch fails', async () => {
      // Mock ColorBarService to throw error
      (ColorBarService as jest.MockedClass<typeof ColorBarService>).mockImplementation(
        () =>
          ({
            getColors: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
          }) as unknown as InstanceType<typeof ColorBarService>
      );

      const options: FrameOptions = {
        text: 'TEST',
        aiProvider: mockAIProvider,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have color warning
      expect(result.warnings.some(w => /color bar unavailable.*rate limit/i.test(w))).toBe(true);

      // Should use fallback colors
      const expectedColors = [67, 66, 65, 64, 63, 68]; // FALLBACK_COLORS
      for (let row = 0; row < 6; row++) {
        expect(result.layout[row][21]).toBe(expectedColors[row]);
      }
    });
  });

  describe('full integration', () => {
    it('should generate complete frame with all features', async () => {
      const mockWeatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        condition: 'sunny',
        colorCode: COLOR_CODES.GREEN,
      };

      const mockColors = [
        COLOR_CODES.VIOLET,
        COLOR_CODES.BLUE,
        COLOR_CODES.GREEN,
        COLOR_CODES.YELLOW,
        COLOR_CODES.ORANGE,
        COLOR_CODES.RED,
      ];

      // Mock services
      (WeatherService as jest.MockedClass<typeof WeatherService>).mockImplementation(
        () =>
          ({
            getWeather: jest.fn().mockResolvedValue(mockWeatherData),
          }) as unknown as InstanceType<typeof WeatherService>
      );

      (ColorBarService as jest.MockedClass<typeof ColorBarService>).mockImplementation(
        () =>
          ({
            getColors: jest.fn().mockResolvedValue(mockColors),
          }) as unknown as InstanceType<typeof ColorBarService>
      );

      const options: FrameOptions = {
        text: 'MOTIVATIONAL QUOTE OF THE DAY',
        homeAssistant: mockHAClient,
        aiProvider: mockAIProvider,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Validate structure
      expect(result.layout).toHaveLength(6);
      result.layout.forEach(row => {
        expect(row).toHaveLength(22);
      });

      // Validate color bar
      for (let row = 0; row < 6; row++) {
        expect(result.layout[row][21]).toBe(mockColors[row]);
      }

      // Should have no warnings
      expect(result.warnings).toEqual([]);
    });

    it('should handle all features gracefully when unavailable', async () => {
      // No HA client, no AI provider
      const options: FrameOptions = {
        text: 'SIMPLE TEXT',
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should still generate valid frame
      expect(result.layout).toHaveLength(6);
      result.layout.forEach(row => {
        expect(row).toHaveLength(22);
      });

      // Should use fallback colors
      const expectedColors = [67, 66, 65, 64, 63, 68]; // FALLBACK_COLORS
      for (let row = 0; row < 6; row++) {
        expect(result.layout[row][21]).toBe(expectedColors[row]);
      }

      // Should have no warnings (features not requested)
      expect(result.warnings).toEqual([]);
    });

    it('should accumulate multiple warnings', async () => {
      // Mock services to fail
      (WeatherService as jest.MockedClass<typeof WeatherService>).mockImplementation(
        () =>
          ({
            getWeather: jest.fn().mockRejectedValue(new Error('Weather error')),
          }) as unknown as InstanceType<typeof WeatherService>
      );

      (ColorBarService as jest.MockedClass<typeof ColorBarService>).mockImplementation(
        () =>
          ({
            getColors: jest.fn().mockRejectedValue(new Error('AI error')),
          }) as unknown as InstanceType<typeof ColorBarService>
      );

      const options: FrameOptions = {
        text:
          'HELLO 🚀 WORLD WITH MANY LINES THAT EXCEED THE LIMIT AND WILL BE TRUNCATED ' +
          'LINE TWO LINE THREE LINE FOUR LINE FIVE LINE SIX LINE SEVEN',
        homeAssistant: mockHAClient,
        aiProvider: mockAIProvider,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have multiple warnings
      expect(result.warnings.length).toBeGreaterThan(1);
      expect(result.warnings.some(w => /unsupported characters/i.test(w))).toBe(true);
      expect(result.warnings.some(w => /weather unavailable/i.test(w))).toBe(true);
      expect(result.warnings.some(w => /color bar unavailable/i.test(w))).toBe(true);

      // Should still generate valid frame
      expect(result.layout).toHaveLength(6);
    });
  });
});
