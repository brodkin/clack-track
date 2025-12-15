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
    ColorBarService: {
      getInstance: jest.fn(),
      clearInstance: jest.fn(),
    },
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
    ColorBarService.clearInstance(); // Clear singleton for test isolation

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
      // 'A🚀B' becomes 'A B' which is 1 line, centered at row 2 (2 blank rows above)
      const contentRow = result.layout[2]; // Row 2 is center for 1-line content
      expect(contentRow[0]).toBe(1); // A
      expect(contentRow[1]).toBe(0); // space (replaced emoji)
      expect(contentRow[2]).toBe(2); // B
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

      // Mock ColorBarService.getInstance to return ColorResult
      (ColorBarService.getInstance as jest.Mock).mockReturnValue({
        getColors: jest.fn().mockResolvedValue({
          colors: mockColors,
          cacheHit: false,
        }),
      });

      const options: FrameOptions = {
        text: 'TEST',
        aiProvider: mockAIProvider,
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have called ColorBarService.getInstance
      expect(ColorBarService.getInstance).toHaveBeenCalledWith(mockAIProvider);

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
      // Mock ColorBarService.getInstance to throw error
      (ColorBarService.getInstance as jest.Mock).mockReturnValue({
        getColors: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      });

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

  describe('debug timing output', () => {
    it('should not include timing when debug is false', async () => {
      const result = await generateFrame({ text: 'TEST', debug: false });
      expect(result.timing).toBeUndefined();
      expect(result.totalMs).toBeUndefined();
    });

    it('should not include timing when debug is undefined', async () => {
      const result = await generateFrame({ text: 'TEST' });
      expect(result.timing).toBeUndefined();
      expect(result.totalMs).toBeUndefined();
    });

    it('should include timing when debug is true', async () => {
      const result = await generateFrame({ text: 'TEST', debug: true });
      expect(result.timing).toBeDefined();
      expect(result.totalMs).toBeDefined();
      expect(Array.isArray(result.timing)).toBe(true);
      expect(result.timing!.length).toBeGreaterThan(0);
    });

    it('should include ColorBarService timing with cacheHit status', async () => {
      const mockColors = [
        COLOR_CODES.RED,
        COLOR_CODES.ORANGE,
        COLOR_CODES.YELLOW,
        COLOR_CODES.GREEN,
        COLOR_CODES.BLUE,
        COLOR_CODES.VIOLET,
      ];

      // Mock ColorBarService to return ColorResult with cacheHit
      (ColorBarService.getInstance as jest.Mock).mockReturnValue({
        getColors: jest.fn().mockResolvedValue({
          colors: mockColors,
          cacheHit: true,
        }),
      });

      const result = await generateFrame({
        text: 'TEST',
        aiProvider: mockAIProvider,
        debug: true,
      });

      const colorTiming = result.timing?.find(t => t.operation.includes('ColorBar'));
      expect(colorTiming).toBeDefined();
      expect(colorTiming?.durationMs).toBeGreaterThanOrEqual(0);
      expect(colorTiming?.cacheHit).toBe(true);
    });

    it('should include WeatherService timing', async () => {
      const mockWeatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        condition: 'sunny',
        colorCode: COLOR_CODES.GREEN,
      };

      (WeatherService as jest.MockedClass<typeof WeatherService>).mockImplementation(
        () =>
          ({
            getWeather: jest.fn().mockResolvedValue(mockWeatherData),
          }) as unknown as InstanceType<typeof WeatherService>
      );

      const result = await generateFrame({
        text: 'TEST',
        homeAssistant: mockHAClient,
        debug: true,
      });

      const weatherTiming = result.timing?.find(t => t.operation.includes('Weather'));
      expect(weatherTiming).toBeDefined();
      expect(weatherTiming?.durationMs).toBeGreaterThanOrEqual(0);
      expect(weatherTiming?.cacheHit).toBeUndefined(); // Weather doesn't have cache
    });

    it('should include info bar formatting timing', async () => {
      const result = await generateFrame({ text: 'TEST', debug: true });
      const infoBarTiming = result.timing?.find(t => t.operation.includes('info bar'));
      expect(infoBarTiming).toBeDefined();
      expect(infoBarTiming?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include frame assembly timing', async () => {
      const result = await generateFrame({ text: 'TEST', debug: true });
      const assemblyTiming = result.timing?.find(t => t.operation.includes('assembled'));
      expect(assemblyTiming).toBeDefined();
      expect(assemblyTiming?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate correct total time', async () => {
      const result = await generateFrame({ text: 'TEST', debug: true });
      expect(result.totalMs).toBeGreaterThanOrEqual(0);

      // Total should be >= sum of individual operations
      const sum = result.timing!.reduce((acc, t) => acc + t.durationMs, 0);
      expect(result.totalMs).toBeGreaterThanOrEqual(sum);
    });

    it('should track timing for all operations when all features enabled', async () => {
      const mockWeatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        condition: 'sunny',
        colorCode: COLOR_CODES.GREEN,
      };

      const mockColors = [
        COLOR_CODES.RED,
        COLOR_CODES.ORANGE,
        COLOR_CODES.YELLOW,
        COLOR_CODES.GREEN,
        COLOR_CODES.BLUE,
        COLOR_CODES.VIOLET,
      ];

      (WeatherService as jest.MockedClass<typeof WeatherService>).mockImplementation(
        () =>
          ({
            getWeather: jest.fn().mockResolvedValue(mockWeatherData),
          }) as unknown as InstanceType<typeof WeatherService>
      );

      (ColorBarService.getInstance as jest.Mock).mockReturnValue({
        getColors: jest.fn().mockResolvedValue({
          colors: mockColors,
          cacheHit: false,
        }),
      });

      const result = await generateFrame({
        text: 'TEST',
        homeAssistant: mockHAClient,
        aiProvider: mockAIProvider,
        debug: true,
      });

      // Should have timing for all operations
      expect(result.timing!.length).toBe(4); // Weather, ColorBar, InfoBar, Assembly
      expect(result.timing!.find(t => t.operation.includes('Weather'))).toBeDefined();
      expect(result.timing!.find(t => t.operation.includes('ColorBar'))).toBeDefined();
      expect(result.timing!.find(t => t.operation.includes('info bar'))).toBeDefined();
      expect(result.timing!.find(t => t.operation.includes('assembled'))).toBeDefined();
    });
  });

  describe('vertical centering', () => {
    it('should vertically center 1-line content (2 blank rows above, 2 below)', async () => {
      const options: FrameOptions = {
        text: 'HELLO',
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Row 0: blank (padding)
      expect(result.layout[0].slice(0, 21).every(code => code === 0)).toBe(true);
      // Row 1: blank (padding)
      expect(result.layout[1].slice(0, 21).every(code => code === 0)).toBe(true);
      // Row 2: "HELLO                " (content centered)
      expect(result.layout[2][0]).toBe(8); // H
      expect(result.layout[2][1]).toBe(5); // E
      expect(result.layout[2][2]).toBe(12); // L
      expect(result.layout[2][3]).toBe(12); // L
      expect(result.layout[2][4]).toBe(15); // O
      // Row 3: blank (padding)
      expect(result.layout[3].slice(0, 21).every(code => code === 0)).toBe(true);
      // Row 4: blank (padding)
      expect(result.layout[4].slice(0, 21).every(code => code === 0)).toBe(true);
    });

    it('should vertically center 2-line content (1 blank row above, 2 below)', async () => {
      const options: FrameOptions = {
        text: 'FIRST LINE AND SECOND LINE HERE', // Wraps to 2 lines at 21 chars
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Row 0: blank (padding)
      expect(result.layout[0].slice(0, 21).every(code => code === 0)).toBe(true);
      // Row 1: First wrapped line
      expect(result.layout[1][0]).toBe(6); // F (FIRST)
      // Row 2: Second wrapped line
      expect(result.layout[2].slice(0, 21).some(code => code !== 0)).toBe(true);
      // Row 3: blank (padding)
      expect(result.layout[3].slice(0, 21).every(code => code === 0)).toBe(true);
      // Row 4: blank (padding)
      expect(result.layout[4].slice(0, 21).every(code => code === 0)).toBe(true);
    });

    it('should vertically center 3-line content (1 blank row above, 1 below)', async () => {
      const options: FrameOptions = {
        text: 'THIS IS LINE ONE AND HERE IS LINE TWO AND FINALLY LINE THREE', // Wraps to 3 lines
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Row 0: blank (padding)
      expect(result.layout[0].slice(0, 21).every(code => code === 0)).toBe(true);
      // Rows 1-3: Content lines
      expect(result.layout[1].slice(0, 21).some(code => code !== 0)).toBe(true);
      expect(result.layout[2].slice(0, 21).some(code => code !== 0)).toBe(true);
      expect(result.layout[3].slice(0, 21).some(code => code !== 0)).toBe(true);
      // Row 4: blank (padding)
      expect(result.layout[4].slice(0, 21).every(code => code === 0)).toBe(true);
    });

    it('should vertically center 4-line content (0 blank rows above, 1 below)', async () => {
      const options: FrameOptions = {
        text: 'HERE IS SOME TEXT THAT SHOULD WRAP TO EXACTLY FOUR LINES WHEN WE TEST IT', // Wraps to exactly 4 lines
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Rows 0-3: Content lines (no top padding)
      expect(result.layout[0].slice(0, 21).some(code => code !== 0)).toBe(true);
      expect(result.layout[1].slice(0, 21).some(code => code !== 0)).toBe(true);
      expect(result.layout[2].slice(0, 21).some(code => code !== 0)).toBe(true);
      expect(result.layout[3].slice(0, 21).some(code => code !== 0)).toBe(true);
      // Row 4: blank (padding)
      expect(result.layout[4].slice(0, 21).every(code => code === 0)).toBe(true);
    });

    it('should not add padding for 5-line content (uses all rows)', async () => {
      const options: FrameOptions = {
        text: 'THIS IS A VERY LONG TEXT THAT WILL DEFINITELY WRAP TO FIVE COMPLETE LINES WHEN DISPLAYED ON THE VESTABOARD WITH TWENTY ONE CHARACTERS PER LINE', // Wraps to 5+ lines
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // All 5 rows should contain content (no blank rows)
      for (let row = 0; row < 5; row++) {
        expect(result.layout[row].slice(0, 21).some(code => code !== 0)).toBe(true);
      }
    });

    it('should handle word-wrapped content that results in fewer than 5 lines', async () => {
      // This text wraps to 2 lines at 21 chars
      const options: FrameOptions = {
        text: 'BRIEF MESSAGE HERE FOR TESTING', // Wraps to 2 lines
        dateTime: new Date('2025-11-26T10:30:00'),
      };

      const result = await generateFrame(options);

      // Should have 1 blank row above (topPadding = floor((5-2)/2) = 1)
      expect(result.layout[0].slice(0, 21).every(code => code === 0)).toBe(true);
      // Rows 1-2 should have content
      expect(result.layout[1].slice(0, 21).some(code => code !== 0)).toBe(true);
      expect(result.layout[2].slice(0, 21).some(code => code !== 0)).toBe(true);
      // Rows 3-4 should be blank
      expect(result.layout[3].slice(0, 21).every(code => code === 0)).toBe(true);
      expect(result.layout[4].slice(0, 21).every(code => code === 0)).toBe(true);
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

      (ColorBarService.getInstance as jest.Mock).mockReturnValue({
        getColors: jest.fn().mockResolvedValue({
          colors: mockColors,
          cacheHit: false,
        }),
      });

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

      (ColorBarService.getInstance as jest.Mock).mockReturnValue({
        getColors: jest.fn().mockRejectedValue(new Error('AI error')),
      });

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
