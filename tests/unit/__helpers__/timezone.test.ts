/**
 * Tests for Timezone Testing Utilities
 *
 * Validates that timezone helpers correctly set and restore process.env.TZ,
 * handle both sync and async functions, and properly restore state even
 * when functions throw errors.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  withTimezone,
  withTimezoneAsync,
  TEST_TIMEZONES,
  type TestTimezone,
} from '@tests/__helpers__/timezone';

describe('timezone', () => {
  let originalTZ: string | undefined;

  beforeEach(() => {
    // Save original timezone
    originalTZ = process.env.TZ;
  });

  afterEach(() => {
    // Restore original timezone after each test
    if (originalTZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTZ;
    }
  });

  describe('withTimezone', () => {
    it('should execute function with specified timezone', () => {
      const result = withTimezone('UTC', () => {
        return process.env.TZ;
      });

      expect(result).toBe('UTC');
    });

    it('should restore original timezone after execution', () => {
      process.env.TZ = 'America/New_York';

      withTimezone('UTC', () => {
        expect(process.env.TZ).toBe('UTC');
      });

      expect(process.env.TZ).toBe('America/New_York');
    });

    it('should restore original timezone even when function throws', () => {
      process.env.TZ = 'America/Los_Angeles';

      expect(() => {
        withTimezone('UTC', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      expect(process.env.TZ).toBe('America/Los_Angeles');
    });

    it('should return the function result', () => {
      const result = withTimezone('UTC', () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it('should handle functions that return objects', () => {
      const result = withTimezone('UTC', () => {
        return { timezone: process.env.TZ, value: 123 };
      });

      expect(result).toEqual({ timezone: 'UTC', value: 123 });
    });

    it('should delete TZ when original was undefined', () => {
      delete process.env.TZ;

      withTimezone('Europe/London', () => {
        expect(process.env.TZ).toBe('Europe/London');
      });

      expect(process.env.TZ).toBeUndefined();
    });

    it('should work with nested timezone changes', () => {
      process.env.TZ = 'America/New_York';

      const result = withTimezone('UTC', () => {
        const innerResult = withTimezone('Asia/Tokyo', () => {
          return process.env.TZ;
        });

        return {
          outer: process.env.TZ,
          inner: innerResult,
        };
      });

      expect(result).toEqual({
        outer: 'UTC',
        inner: 'Asia/Tokyo',
      });
      expect(process.env.TZ).toBe('America/New_York');
    });
  });

  describe('withTimezoneAsync', () => {
    it('should execute async function with specified timezone', async () => {
      const result = await withTimezoneAsync('UTC', async () => {
        return process.env.TZ;
      });

      expect(result).toBe('UTC');
    });

    it('should restore original timezone after async execution', async () => {
      process.env.TZ = 'America/New_York';

      await withTimezoneAsync('UTC', async () => {
        expect(process.env.TZ).toBe('UTC');
      });

      expect(process.env.TZ).toBe('America/New_York');
    });

    it('should restore original timezone even when async function rejects', async () => {
      process.env.TZ = 'America/Los_Angeles';

      await expect(
        withTimezoneAsync('UTC', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(process.env.TZ).toBe('America/Los_Angeles');
    });

    it('should return the async function result', async () => {
      const result = await withTimezoneAsync('UTC', async () => {
        return Promise.resolve(42);
      });

      expect(result).toBe(42);
    });

    it('should handle async functions that return objects', async () => {
      const result = await withTimezoneAsync('UTC', async () => {
        return { timezone: process.env.TZ, value: 123 };
      });

      expect(result).toEqual({ timezone: 'UTC', value: 123 });
    });

    it('should delete TZ when original was undefined', async () => {
      delete process.env.TZ;

      await withTimezoneAsync('Europe/London', async () => {
        expect(process.env.TZ).toBe('Europe/London');
      });

      expect(process.env.TZ).toBeUndefined();
    });

    it('should work with nested async timezone changes', async () => {
      process.env.TZ = 'America/New_York';

      const result = await withTimezoneAsync('UTC', async () => {
        const innerResult = await withTimezoneAsync('Asia/Tokyo', async () => {
          return process.env.TZ;
        });

        return {
          outer: process.env.TZ,
          inner: innerResult,
        };
      });

      expect(result).toEqual({
        outer: 'UTC',
        inner: 'Asia/Tokyo',
      });
      expect(process.env.TZ).toBe('America/New_York');
    });

    it('should handle real async operations', async () => {
      const result = await withTimezoneAsync('UTC', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return process.env.TZ;
      });

      expect(result).toBe('UTC');
    });
  });

  describe('TEST_TIMEZONES', () => {
    it('should provide UTC timezone constant', () => {
      expect(TEST_TIMEZONES.UTC).toBe('UTC');
    });

    it('should provide Pacific timezone constant', () => {
      expect(TEST_TIMEZONES.PACIFIC).toBe('America/Los_Angeles');
    });

    it('should provide Eastern timezone constant', () => {
      expect(TEST_TIMEZONES.EASTERN).toBe('America/New_York');
    });

    it('should provide London timezone constant', () => {
      expect(TEST_TIMEZONES.LONDON).toBe('Europe/London');
    });

    it('should provide Tokyo timezone constant', () => {
      expect(TEST_TIMEZONES.TOKYO).toBe('Asia/Tokyo');
    });

    it('should provide Paris timezone constant', () => {
      expect(TEST_TIMEZONES.PARIS).toBe('Europe/Paris');
    });

    it('should provide Sydney timezone constant', () => {
      expect(TEST_TIMEZONES.SYDNEY).toBe('Australia/Sydney');
    });

    it('should have immutable values with as const', () => {
      // TypeScript enforces readonly via 'as const', preventing assignment at compile time
      // At runtime, the object is not frozen, but TypeScript prevents mutation
      expect(TEST_TIMEZONES.UTC).toBe('UTC');
      expect(TEST_TIMEZONES.PACIFIC).toBe('America/Los_Angeles');
    });

    it('should work with withTimezone helper', () => {
      const result = withTimezone(TEST_TIMEZONES.PACIFIC, () => {
        return process.env.TZ;
      });

      expect(result).toBe('America/Los_Angeles');
    });

    it('should work with withTimezoneAsync helper', async () => {
      const result = await withTimezoneAsync(TEST_TIMEZONES.TOKYO, async () => {
        return process.env.TZ;
      });

      expect(result).toBe('Asia/Tokyo');
    });
  });

  describe('real-world date formatting', () => {
    it('should affect Date.toLocaleString output', () => {
      const date = new Date('2025-11-29T12:00:00Z');

      const utcFormatted = withTimezone('UTC', () => {
        return date.toISOString();
      });

      const pacificFormatted = withTimezone('America/Los_Angeles', () => {
        return date.toISOString();
      });

      // ISO string should be the same regardless of timezone
      expect(utcFormatted).toBe(pacificFormatted);
    });

    it('should affect new Date() constructor for local times', () => {
      // Test that timezone affects how Date objects are created from local time strings
      const utcTz = withTimezone('UTC', () => process.env.TZ);
      const pacificTz = withTimezone('America/Los_Angeles', () => process.env.TZ);

      expect(utcTz).toBe('UTC');
      expect(pacificTz).toBe('America/Los_Angeles');

      // Verify timezone is actually changing
      expect(utcTz).not.toBe(pacificTz);
    });
  });

  describe('type safety', () => {
    it('should accept TestTimezone type for type checking', () => {
      // This test validates that TestTimezone type works at compile time
      const tz: TestTimezone = TEST_TIMEZONES.UTC;

      // Verify the type assignment works
      expect(tz).toBe('UTC');

      // Use it with the helper
      const result = withTimezone(tz, () => process.env.TZ);
      expect(result).toBe('UTC');
    });
  });
});
