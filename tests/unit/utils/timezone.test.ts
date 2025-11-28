import {
  getTimezone,
  getCurrentDateTime,
  formatDayName,
  formatDateMonth,
  formatTime,
  getHourInTimezone,
} from '@/utils/timezone';

describe('timezone utilities', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    // Restore original environment
    process.env = ORIGINAL_ENV;
  });

  describe('getTimezone', () => {
    it('should return TZ environment variable when set', () => {
      process.env.TZ = 'America/New_York';
      expect(getTimezone()).toBe('America/New_York');
    });

    it('should return default America/Los_Angeles when TZ not set', () => {
      delete process.env.TZ;
      expect(getTimezone()).toBe('America/Los_Angeles');
    });

    it('should return default when TZ is empty string', () => {
      process.env.TZ = '';
      expect(getTimezone()).toBe('America/Los_Angeles');
    });

    it('should handle UTC timezone', () => {
      process.env.TZ = 'UTC';
      expect(getTimezone()).toBe('UTC');
    });
  });

  describe('getCurrentDateTime', () => {
    it('should return current date/time', () => {
      const before = new Date();
      const current = getCurrentDateTime();
      const after = new Date();

      expect(current.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(current.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should respect timezone parameter', () => {
      const date = getCurrentDateTime('America/Los_Angeles');
      expect(date).toBeInstanceOf(Date);
    });

    it('should use default timezone when not specified', () => {
      delete process.env.TZ;
      const date = getCurrentDateTime();
      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('formatDayName', () => {
    it('should format day name in uppercase for America/Los_Angeles', () => {
      // Wednesday, January 1, 2025 00:00:00 UTC
      const date = new Date('2025-01-01T00:00:00Z');
      const result = formatDayName(date, 'America/Los_Angeles');
      // UTC midnight is 4pm Dec 31 in LA (PST)
      expect(result).toBe('TUESDAY');
    });

    it('should format day name in uppercase for America/New_York', () => {
      // Wednesday, January 1, 2025 00:00:00 UTC
      const date = new Date('2025-01-01T00:00:00Z');
      const result = formatDayName(date, 'America/New_York');
      // UTC midnight is 7pm Dec 31 in NY (EST)
      expect(result).toBe('TUESDAY');
    });

    it('should format day name for UTC timezone', () => {
      const date = new Date('2025-01-01T12:00:00Z');
      const result = formatDayName(date, 'UTC');
      expect(result).toBe('WEDNESDAY');
    });

    it('should format day name for Europe/London', () => {
      // Noon UTC = noon in London (GMT in winter)
      const date = new Date('2025-01-15T12:00:00Z');
      const result = formatDayName(date, 'Europe/London');
      expect(result).toBe('WEDNESDAY');
    });

    it('should use default timezone when not specified', () => {
      delete process.env.TZ;
      const date = new Date('2025-01-01T12:00:00Z');
      const result = formatDayName(date);
      expect(result).toMatch(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/);
    });

    it('should handle DST spring forward transition', () => {
      // March 9, 2025 - DST begins in US (2am becomes 3am)
      // 10am UTC = 2am PST → 3am PDT (spring forward hour)
      const date = new Date('2025-03-09T10:00:00Z');
      const result = formatDayName(date, 'America/Los_Angeles');
      expect(result).toBe('SUNDAY');
    });

    it('should handle DST fall back transition', () => {
      // November 2, 2025 - DST ends in US (2am becomes 1am)
      // 8am UTC = 1am PDT → 1am PST (repeated hour)
      const date = new Date('2025-11-02T08:00:00Z');
      const result = formatDayName(date, 'America/Los_Angeles');
      expect(result).toBe('SUNDAY');
    });
  });

  describe('formatDateMonth', () => {
    it('should format date as "MMM DD" for America/Los_Angeles', () => {
      const date = new Date('2025-11-27T08:00:00Z');
      const result = formatDateMonth(date, 'America/Los_Angeles');
      // 8am UTC = midnight PST (Nov 27)
      expect(result).toBe('NOV 27');
    });

    it('should format date as "MMM DD" for America/New_York', () => {
      const date = new Date('2025-11-27T05:00:00Z');
      const result = formatDateMonth(date, 'America/New_York');
      // 5am UTC = midnight EST (Nov 27)
      expect(result).toBe('NOV 27');
    });

    it('should format date for UTC timezone', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const result = formatDateMonth(date, 'UTC');
      expect(result).toBe('JAN 15');
    });

    it('should format date for Europe/London', () => {
      const date = new Date('2025-12-25T00:00:00Z');
      const result = formatDateMonth(date, 'Europe/London');
      expect(result).toBe('DEC 25');
    });

    it('should use default timezone when not specified', () => {
      delete process.env.TZ;
      const date = new Date('2025-06-15T12:00:00Z');
      const result = formatDateMonth(date);
      expect(result).toMatch(/^[A-Z]{3} \d{1,2}$/);
    });

    it('should handle single-digit dates without leading zero', () => {
      const date = new Date('2025-01-05T12:00:00Z');
      const result = formatDateMonth(date, 'UTC');
      expect(result).toBe('JAN 5');
    });

    it('should handle leap year dates', () => {
      const date = new Date('2024-02-29T12:00:00Z');
      const result = formatDateMonth(date, 'UTC');
      expect(result).toBe('FEB 29');
    });

    it('should handle midnight boundary', () => {
      // Test that a date just before midnight in one timezone
      // shows correct date in another timezone
      const date = new Date('2025-01-01T07:59:59Z');
      const resultLA = formatDateMonth(date, 'America/Los_Angeles');
      const resultUTC = formatDateMonth(date, 'UTC');
      expect(resultLA).toBe('DEC 31'); // Still Dec 31 in LA
      expect(resultUTC).toBe('JAN 1'); // Already Jan 1 in UTC
    });
  });

  describe('formatTime', () => {
    it('should format time as "HH:MM" in 24-hour format for America/Los_Angeles', () => {
      const date = new Date('2025-11-27T20:30:00Z');
      const result = formatTime(date, 'America/Los_Angeles');
      // 20:30 UTC = 12:30 PST
      expect(result).toBe('12:30');
    });

    it('should format time as "HH:MM" in 24-hour format for America/New_York', () => {
      const date = new Date('2025-11-27T17:45:00Z');
      const result = formatTime(date, 'America/New_York');
      // 17:45 UTC = 12:45 EST
      expect(result).toBe('12:45');
    });

    it('should format time for UTC timezone', () => {
      const date = new Date('2025-01-15T14:22:00Z');
      const result = formatTime(date, 'UTC');
      expect(result).toBe('14:22');
    });

    it('should format time for Europe/London', () => {
      const date = new Date('2025-12-25T09:15:00Z');
      const result = formatTime(date, 'Europe/London');
      expect(result).toBe('09:15');
    });

    it('should use default timezone when not specified', () => {
      delete process.env.TZ;
      const date = new Date('2025-06-15T12:00:00Z');
      const result = formatTime(date);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should handle midnight (00:00)', () => {
      const date = new Date('2025-01-01T08:00:00Z');
      const result = formatTime(date, 'America/Los_Angeles');
      expect(result).toBe('00:00');
    });

    it('should handle noon (12:00)', () => {
      const date = new Date('2025-01-01T20:00:00Z');
      const result = formatTime(date, 'America/Los_Angeles');
      expect(result).toBe('12:00');
    });

    it('should handle late evening (23:59)', () => {
      const date = new Date('2025-01-02T07:59:00Z');
      const result = formatTime(date, 'America/Los_Angeles');
      expect(result).toBe('23:59');
    });

    it('should pad single-digit hours with leading zero', () => {
      const date = new Date('2025-01-01T17:30:00Z');
      const result = formatTime(date, 'America/Los_Angeles');
      expect(result).toBe('09:30');
    });
  });

  describe('getHourInTimezone', () => {
    it('should return hour (0-23) for America/Los_Angeles', () => {
      const date = new Date('2025-11-27T20:30:00Z');
      const result = getHourInTimezone(date, 'America/Los_Angeles');
      // 20:30 UTC = 12:30 PST
      expect(result).toBe(12);
    });

    it('should return hour (0-23) for America/New_York', () => {
      const date = new Date('2025-11-27T02:00:00Z');
      const result = getHourInTimezone(date, 'America/New_York');
      // 2am UTC = 9pm EST previous day
      expect(result).toBe(21);
    });

    it('should return hour for UTC timezone', () => {
      const date = new Date('2025-01-15T14:22:00Z');
      const result = getHourInTimezone(date, 'UTC');
      expect(result).toBe(14);
    });

    it('should return hour for Europe/London', () => {
      const date = new Date('2025-12-25T09:15:00Z');
      const result = getHourInTimezone(date, 'Europe/London');
      expect(result).toBe(9);
    });

    it('should use default timezone when not specified', () => {
      delete process.env.TZ;
      const date = new Date('2025-06-15T12:00:00Z');
      const result = getHourInTimezone(date);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });

    it('should handle midnight hour (0)', () => {
      const date = new Date('2025-01-01T08:00:00Z');
      const result = getHourInTimezone(date, 'America/Los_Angeles');
      expect(result).toBe(0);
    });

    it('should handle noon hour (12)', () => {
      const date = new Date('2025-01-01T20:00:00Z');
      const result = getHourInTimezone(date, 'America/Los_Angeles');
      expect(result).toBe(12);
    });

    it('should handle late evening hour (23)', () => {
      const date = new Date('2025-01-02T07:59:00Z');
      const result = getHourInTimezone(date, 'America/Los_Angeles');
      expect(result).toBe(23);
    });

    it('should handle DST spring forward (missing hour)', () => {
      // March 9, 2025 at 2am PST → 3am PDT (2am doesn't exist)
      // 10am UTC should map to 3am PDT
      const date = new Date('2025-03-09T10:00:00Z');
      const result = getHourInTimezone(date, 'America/Los_Angeles');
      expect(result).toBe(3);
    });

    it('should handle DST fall back (repeated hour)', () => {
      // November 2, 2025 at 2am PDT → 1am PST (1am happens twice)
      // 8am UTC = 1am PST (second occurrence)
      const date = new Date('2025-11-02T08:00:00Z');
      const result = getHourInTimezone(date, 'America/Los_Angeles');
      expect(result).toBe(1);
    });
  });
});
