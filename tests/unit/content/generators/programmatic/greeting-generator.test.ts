/**
 * Unit tests for GreetingGenerator
 *
 * Tests time-based greeting generation logic.
 *
 * @module tests/unit/content/generators/programmatic/greeting-generator
 */

import { GreetingGenerator } from '@/content/generators/programmatic/greeting-generator';
import type { GenerationContext } from '@/types/content-generator';

describe('GreetingGenerator', () => {
  let generator: GreetingGenerator;
  let originalTz: string | undefined;

  beforeEach(() => {
    generator = new GreetingGenerator();
    // Save original TZ for restoration
    originalTz = process.env.TZ;
    // Set to UTC for predictable testing
    process.env.TZ = 'UTC';
  });

  afterEach(() => {
    // Restore original TZ
    if (originalTz !== undefined) {
      process.env.TZ = originalTz;
    } else {
      delete process.env.TZ;
    }
  });

  describe('validate', () => {
    it('should always return valid', async () => {
      const result = await generator.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate', () => {
    describe('morning greeting (5am-12pm)', () => {
      it('should return "Good morning!" at 5:00am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T05:00:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good morning!" at 9:30am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T09:30:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good morning!" at 11:59am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T11:59:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
        expect(result.outputMode).toBe('text');
      });
    });

    describe('afternoon greeting (12pm-5pm)', () => {
      it('should return "Good afternoon!" at 12:00pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good afternoon!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good afternoon!" at 2:30pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T14:30:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good afternoon!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good afternoon!" at 4:59pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T16:59:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good afternoon!');
        expect(result.outputMode).toBe('text');
      });
    });

    describe('evening greeting (5pm-9pm)', () => {
      it('should return "Good evening!" at 5:00pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T17:00:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good evening!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good evening!" at 7:00pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T19:00:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good evening!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good evening!" at 8:59pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T20:59:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good evening!');
        expect(result.outputMode).toBe('text');
      });
    });

    describe('night greeting (9pm-5am)', () => {
      it('should return "Good night!" at 9:00pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T21:00:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good night!" at 11:59pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T23:59:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good night!" at 2:00am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T02:00:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good night!" at 4:59am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T04:59:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
        expect(result.outputMode).toBe('text');
      });
    });

    describe('edge cases', () => {
      it('should work with minor update type', async () => {
        const context: GenerationContext = {
          updateType: 'minor',
          timestamp: new Date('2024-01-15T09:00:00Z'), // UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
        expect(result.outputMode).toBe('text');
      });

      it('should work with event data present', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T14:00:00Z'), // UTC
          eventData: { event_type: 'test.event' },
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good afternoon!');
        expect(result.outputMode).toBe('text');
      });
    });

    describe('timezone-aware greeting selection', () => {
      beforeEach(() => {
        // Reset environment before each test
        delete process.env.TZ;
      });

      it('should use configured timezone for greeting selection', async () => {
        // Set timezone to UTC
        process.env.TZ = 'UTC';

        // 3am UTC = 8pm PST (previous day) = "Good night!"
        // But with UTC timezone, 3am should be "Good night!" (21:00-5:00 range)
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T03:00:00Z'), // 3am UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
      });

      it('should handle Pacific timezone correctly', async () => {
        // Set timezone to America/Los_Angeles
        process.env.TZ = 'America/Los_Angeles';

        // 10am UTC = 2am PST = "Good night!"
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T10:00:00Z'), // 10am UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
      });

      it('should handle Tokyo timezone correctly', async () => {
        // Set timezone to Asia/Tokyo
        process.env.TZ = 'Asia/Tokyo';

        // 1am UTC = 10am JST = "Good morning!"
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T01:00:00Z'), // 1am UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
      });

      it('should handle noon boundary correctly across timezones', async () => {
        // Test that noon (12:00) correctly transitions to afternoon
        process.env.TZ = 'America/New_York';

        // 5pm UTC = 12pm EST = "Good afternoon!"
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T17:00:00Z'), // 5pm UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good afternoon!');
      });

      it('should handle midnight boundary correctly', async () => {
        // Test that midnight (00:00) is treated as night
        process.env.TZ = 'UTC';

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T00:00:00Z'), // midnight UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
      });

      it('should handle 5am threshold correctly', async () => {
        // 5am should be morning (boundary)
        process.env.TZ = 'UTC';

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T05:00:00Z'), // 5am UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
      });

      it('should handle 4:59am as night (just before threshold)', async () => {
        process.env.TZ = 'UTC';

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T04:59:00Z'), // 4:59am UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
      });

      it('should handle 5pm threshold correctly', async () => {
        // 5pm (17:00) should be evening (boundary)
        process.env.TZ = 'UTC';

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T17:00:00Z'), // 5pm UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good evening!');
      });

      it('should handle 9pm threshold correctly', async () => {
        // 9pm (21:00) should be night (boundary)
        process.env.TZ = 'UTC';

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T21:00:00Z'), // 9pm UTC
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
      });
    });
  });
});
