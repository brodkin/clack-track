import { formatInfoBar } from '../../../../src/content/frame/info-bar.js';
import { charToCode } from '../../../../src/api/vestaboard/character-converter.js';
import type { InfoBarData } from '../../../../src/content/frame/info-bar.js';
import type { WeatherData } from '../../../../src/services/weather-service.js';
import * as timezoneUtils from '../../../../src/utils/timezone.js';
import { withTimezone, TEST_TIMEZONES } from '../../../__helpers__/timezone.js';

// Helper function to convert character codes back to string for testing
function codesToString(codes: number[]): string {
  // Reverse lookup map
  const codeToChar: Record<number, string> = {
    0: ' ',
    1: 'A',
    2: 'B',
    3: 'C',
    4: 'D',
    5: 'E',
    6: 'F',
    7: 'G',
    8: 'H',
    9: 'I',
    10: 'J',
    11: 'K',
    12: 'L',
    13: 'M',
    14: 'N',
    15: 'O',
    16: 'P',
    17: 'Q',
    18: 'R',
    19: 'S',
    20: 'T',
    21: 'U',
    22: 'V',
    23: 'W',
    24: 'X',
    25: 'Y',
    26: 'Z',
    27: '1',
    28: '2',
    29: '3',
    30: '4',
    31: '5',
    32: '6',
    33: '7',
    34: '8',
    35: '9',
    36: '0',
    44: '-',
    50: ':',
    // Color codes render as symbols in test output
    63: '[R]',
    64: '[O]',
    65: '[Y]',
    66: '[G]',
    67: '[B]',
    68: '[V]',
    69: '[W]',
  };
  return codes.map(code => codeToChar[code] || '?').join('');
}

describe('Info Bar Formatter', () => {
  describe('formatInfoBar', () => {
    it('should return array of exactly 21 character codes', () => {
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
      };

      const result = formatInfoBar(data);

      expect(result).toHaveLength(21);
      expect(result.every(code => typeof code === 'number')).toBe(true);
    });

    it('should include weather color and temperature when weather data provided', () => {
      const weatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        colorCode: 66, // GREEN
        description: 'Sunny',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);

      // Verify presence of weather data by checking character codes
      // Color code 66 (GREEN), 7=33, 2=28, F=6
      expect(result).toContain(66); // Actual GREEN color code
      expect(result).toContain(charToCode('7')); // Temperature digit
      expect(result).toContain(charToCode('2')); // Temperature digit
      expect(result).toContain(charToCode('F')); // Unit
    });

    it('should pad correctly without weather data', () => {
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
      };

      const result = formatInfoBar(data);

      expect(result).toHaveLength(21);
      // Last characters should be spaces (code 0)
      const lastChars = result.slice(-5);
      expect(lastChars.every(code => code === 0)).toBe(true);
    });

    it('should use current date/time when not provided', () => {
      const beforeTime = new Date();
      const result = formatInfoBar({});
      const afterTime = new Date();

      // Just verify it returns valid structure
      expect(result).toHaveLength(21);
      expect(result.every(code => typeof code === 'number')).toBe(true);

      // Time difference should be minimal (test executed quickly)
      expect(afterTime.getTime() - beforeTime.getTime()).toBeLessThan(1000);
    });

    it('should format complete info bar with known date and weather', () => {
      const weatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        colorCode: 66, // GREEN
        description: 'Sunny',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'), // Tuesday
        weatherData,
      };

      const result = formatInfoBar(data);

      // Verify exact output format
      expect(result).toHaveLength(21);

      // Verify day portion (TUE)
      const dayPortion = result.slice(0, 3);
      expect(dayPortion).toEqual([charToCode('T'), charToCode('U'), charToCode('E')]);
    });
  });

  describe('formatDay', () => {
    // Access via module for testing (will be available after implementation)
    it('should return 3-letter uppercase day abbreviation for Monday', () => {
      const data: InfoBarData = {
        dateTime: new Date('2024-11-25T10:00:00'), // Monday
      };
      const result = formatInfoBar(data);
      const dayPortion = codesToString(result.slice(0, 3));

      expect(dayPortion).toBe('MON');
    });

    it('should return 3-letter uppercase day abbreviation for Wednesday', () => {
      const data: InfoBarData = {
        dateTime: new Date('2024-11-27T10:00:00'), // Wednesday
      };
      const result = formatInfoBar(data);
      const dayPortion = codesToString(result.slice(0, 3));

      expect(dayPortion).toBe('WED');
    });
  });

  describe('formatDateMonth', () => {
    it('should format single-digit dates without leading zero', () => {
      const data: InfoBarData = {
        dateTime: new Date('2024-11-01T10:00:00'),
      };
      const result = formatInfoBar(data);
      // Extract date/month portion (after "DAY ")
      const portion = codesToString(result.slice(4, 9));

      expect(portion).toBe('1NOV '); // Note: includes trailing space
    });

    it('should format double-digit dates correctly', () => {
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:00:00'),
      };
      const result = formatInfoBar(data);
      // Extract date/month portion (after "DAY ")
      const portion = codesToString(result.slice(4, 10));

      expect(portion).toBe('26NOV ');
    });
  });

  describe('formatTime', () => {
    it('should return 24-hour format with leading zeros', () => {
      withTimezone(TEST_TIMEZONES.PACIFIC, () => {
        const data: InfoBarData = {
          dateTime: new Date('2024-11-26T17:05:00Z'), // UTC time → 09:05 Pacific
        };
        const result = formatInfoBar(data);
        // Extract time portion
        const timePortion = codesToString(result.slice(10, 15));

        expect(timePortion).toBe('09:05');
      });
    });

    it('should handle midnight as 00:00', () => {
      withTimezone(TEST_TIMEZONES.PACIFIC, () => {
        const data: InfoBarData = {
          dateTime: new Date('2024-11-26T08:00:00Z'), // UTC time → 00:00 Pacific
        };
        const result = formatInfoBar(data);
        // Extract time portion
        const timePortion = codesToString(result.slice(10, 15));

        expect(timePortion).toBe('00:00');
      });
    });

    it('should handle afternoon times correctly', () => {
      withTimezone(TEST_TIMEZONES.PACIFIC, () => {
        const data: InfoBarData = {
          dateTime: new Date('2024-11-26T22:45:00Z'), // UTC time → 14:45 Pacific
        };
        const result = formatInfoBar(data);
        // Extract time portion
        const timePortion = codesToString(result.slice(10, 15));

        expect(timePortion).toBe('14:45');
      });
    });
  });

  describe('color character mapping', () => {
    it('should output RED color code correctly', () => {
      const weatherData: WeatherData = {
        temperature: 95,
        temperatureUnit: '°F',
        colorCode: 63, // RED
        description: 'Hot',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);

      // Should contain actual color code 63 (RED)
      expect(result).toContain(63);
      const resultStr = codesToString(result);
      expect(resultStr).toContain('[R]95F');
    });

    it('should output ORANGE color code correctly', () => {
      const weatherData: WeatherData = {
        temperature: 85,
        temperatureUnit: '°F',
        colorCode: 64, // ORANGE
        description: 'Warm',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);

      // Should contain actual color code 64 (ORANGE)
      expect(result).toContain(64);
      const resultStr = codesToString(result);
      expect(resultStr).toContain('[O]85F');
    });

    it('should output YELLOW color code correctly', () => {
      const weatherData: WeatherData = {
        temperature: 75,
        temperatureUnit: '°F',
        colorCode: 65, // YELLOW
        description: 'Pleasant',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);

      // Should contain actual color code 65 (YELLOW)
      expect(result).toContain(65);
      const resultStr = codesToString(result);
      expect(resultStr).toContain('[Y]75F');
    });

    it('should output invalid color code as-is', () => {
      const weatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        colorCode: 99, // Invalid - not a valid Vestaboard color
        description: 'Sunny',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);

      // Invalid color code 99 is inserted as-is (shows as ? in string conversion)
      expect(result).toContain(99);
      const resultStr = codesToString(result);
      expect(resultStr).toContain('?72F');
    });
  });

  describe('temperature formatting', () => {
    it('should include F suffix for Fahrenheit', () => {
      const weatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        colorCode: 66,
        description: 'Sunny',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);
      const resultStr = codesToString(result);

      expect(resultStr).toContain('72F');
    });

    it('should include C suffix for Celsius', () => {
      const weatherData: WeatherData = {
        temperature: 22,
        temperatureUnit: '°C',
        colorCode: 66,
        description: 'Sunny',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);
      const resultStr = codesToString(result);

      expect(resultStr).toContain('22C');
    });

    it('should handle three-digit temperatures', () => {
      const weatherData: WeatherData = {
        temperature: 100,
        temperatureUnit: '°F',
        colorCode: 63, // RED
        description: 'Very hot',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);
      const resultStr = codesToString(result);

      expect(resultStr).toContain('100F');
      expect(result).toHaveLength(21);
    });

    it('should handle negative temperatures', () => {
      const weatherData: WeatherData = {
        temperature: -5,
        temperatureUnit: '°C',
        colorCode: 67, // BLUE
        description: 'Very cold',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);
      const resultStr = codesToString(result);

      expect(resultStr).toContain('-5C');
      expect(result).toHaveLength(21);
    });
  });

  describe('timezone awareness', () => {
    it('should use timezone utility functions for formatting', () => {
      const formatDayNameSpy = jest.spyOn(timezoneUtils, 'formatDayName');
      const formatDateMonthSpy = jest.spyOn(timezoneUtils, 'formatDateMonth');
      const formatTimeSpy = jest.spyOn(timezoneUtils, 'formatTime');

      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00Z'),
      };

      formatInfoBar(data);

      expect(formatDayNameSpy).toHaveBeenCalledWith(data.dateTime);
      expect(formatDateMonthSpy).toHaveBeenCalledWith(data.dateTime);
      expect(formatTimeSpy).toHaveBeenCalledWith(data.dateTime);

      formatDayNameSpy.mockRestore();
      formatDateMonthSpy.mockRestore();
      formatTimeSpy.mockRestore();
    });

    it('should respect timezone when formatting day names', () => {
      // Mock formatDayName to return a specific value
      const formatDayNameSpy = jest.spyOn(timezoneUtils, 'formatDayName').mockReturnValue('TUE');
      const formatDateMonthSpy = jest
        .spyOn(timezoneUtils, 'formatDateMonth')
        .mockReturnValue('26NOV');
      const formatTimeSpy = jest.spyOn(timezoneUtils, 'formatTime').mockReturnValue('10:30');

      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00Z'),
      };

      const result = formatInfoBar(data);
      const dayPortion = codesToString(result.slice(0, 3));

      expect(dayPortion).toBe('TUE');

      formatDayNameSpy.mockRestore();
      formatDateMonthSpy.mockRestore();
      formatTimeSpy.mockRestore();
    });

    it('should respect timezone when formatting dates', () => {
      const formatDayNameSpy = jest.spyOn(timezoneUtils, 'formatDayName').mockReturnValue('WED');
      const formatDateMonthSpy = jest
        .spyOn(timezoneUtils, 'formatDateMonth')
        .mockReturnValue('27NOV');
      const formatTimeSpy = jest.spyOn(timezoneUtils, 'formatTime').mockReturnValue('14:45');

      const data: InfoBarData = {
        dateTime: new Date('2024-11-27T06:45:00Z'), // Early UTC time
      };

      const result = formatInfoBar(data);
      const dateMonthPortion = codesToString(result.slice(4, 10));

      expect(dateMonthPortion).toBe('27NOV ');

      formatDayNameSpy.mockRestore();
      formatDateMonthSpy.mockRestore();
      formatTimeSpy.mockRestore();
    });

    it('should respect timezone when formatting time', () => {
      const formatDayNameSpy = jest.spyOn(timezoneUtils, 'formatDayName').mockReturnValue('WED');
      const formatDateMonthSpy = jest
        .spyOn(timezoneUtils, 'formatDateMonth')
        .mockReturnValue('27NOV');
      const formatTimeSpy = jest.spyOn(timezoneUtils, 'formatTime').mockReturnValue('23:45');

      const data: InfoBarData = {
        dateTime: new Date('2024-11-27T07:45:00Z'), // Morning UTC
      };

      const result = formatInfoBar(data);
      const timePortion = codesToString(result.slice(10, 15));

      expect(timePortion).toBe('23:45');

      formatDayNameSpy.mockRestore();
      formatDateMonthSpy.mockRestore();
      formatTimeSpy.mockRestore();
    });
  });
});
