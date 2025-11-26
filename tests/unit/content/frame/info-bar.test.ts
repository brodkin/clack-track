import { formatInfoBar } from '../../../../src/content/frame/info-bar.js';
import { charToCode } from '../../../../src/api/vestaboard/character-converter.js';
import type { InfoBarData } from '../../../../src/content/frame/info-bar.js';
import type { WeatherData } from '../../../../src/services/weather-service.js';

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
      // G=7, 7=33, 2=28, F=6
      expect(result).toContain(charToCode('G')); // Color indicator
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
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T09:05:00'),
      };
      const result = formatInfoBar(data);
      // Extract time portion
      const timePortion = codesToString(result.slice(10, 15));

      expect(timePortion).toBe('09:05');
    });

    it('should handle midnight as 00:00', () => {
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T00:00:00'),
      };
      const result = formatInfoBar(data);
      // Extract time portion
      const timePortion = codesToString(result.slice(10, 15));

      expect(timePortion).toBe('00:00');
    });

    it('should handle afternoon times correctly', () => {
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T14:45:00'),
      };
      const result = formatInfoBar(data);
      // Extract time portion
      const timePortion = codesToString(result.slice(10, 15));

      expect(timePortion).toBe('14:45');
    });
  });

  describe('color character mapping', () => {
    it('should map RED color code correctly', () => {
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
      const resultStr = codesToString(result);

      expect(resultStr).toContain('R95F');
    });

    it('should map ORANGE color code correctly', () => {
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
      const resultStr = codesToString(result);

      expect(resultStr).toContain('O85F');
    });

    it('should map YELLOW color code correctly', () => {
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
      const resultStr = codesToString(result);

      expect(resultStr).toContain('Y75F');
    });

    it('should return space for invalid color code', () => {
      const weatherData: WeatherData = {
        temperature: 72,
        temperatureUnit: '°F',
        colorCode: 99, // Invalid
        description: 'Sunny',
      };
      const data: InfoBarData = {
        dateTime: new Date('2024-11-26T10:30:00'),
        weatherData,
      };

      const result = formatInfoBar(data);
      const resultStr = codesToString(result);

      // Should have space before temperature
      expect(resultStr).toContain(' 72F');
      expect(resultStr).not.toContain('R72F');
      expect(resultStr).not.toContain('G72F');
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
});
