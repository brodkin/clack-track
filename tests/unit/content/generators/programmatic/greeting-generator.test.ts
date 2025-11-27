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

  beforeEach(() => {
    generator = new GreetingGenerator();
  });

  describe('validate', () => {
    it('should always return valid', () => {
      const result = generator.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('generate', () => {
    describe('morning greeting (5am-12pm)', () => {
      it('should return "Good morning!" at 5:00am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T05:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good morning!" at 9:30am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T09:30:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good morning!" at 11:59am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T11:59:00'),
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
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good afternoon!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good afternoon!" at 2:30pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T14:30:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good afternoon!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good afternoon!" at 4:59pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T16:59:00'),
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
          timestamp: new Date('2024-01-15T17:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good evening!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good evening!" at 7:00pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T19:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good evening!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good evening!" at 8:59pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T20:59:00'),
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
          timestamp: new Date('2024-01-15T21:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good night!" at 11:59pm', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T23:59:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good night!" at 2:00am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T02:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good night!');
        expect(result.outputMode).toBe('text');
      });

      it('should return "Good night!" at 4:59am', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T04:59:00'),
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
          timestamp: new Date('2024-01-15T09:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good morning!');
        expect(result.outputMode).toBe('text');
      });

      it('should work with event data present', async () => {
        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T14:00:00'),
          eventData: { event_type: 'test.event' },
        };

        const result = await generator.generate(context);

        expect(result.text).toBe('Good afternoon!');
        expect(result.outputMode).toBe('text');
      });
    });
  });
});
