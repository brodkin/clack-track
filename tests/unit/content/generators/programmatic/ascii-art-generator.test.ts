/**
 * Unit tests for ASCIIArtGenerator
 *
 * Tests ASCII art pattern selection and Vestaboard color code support.
 *
 * @module tests/unit/content/generators/programmatic/ascii-art-generator
 */

import { ASCIIArtGenerator } from '@/content/generators/programmatic/ascii-art-generator';
import type { GenerationContext } from '@/types/content-generator';

describe('ASCIIArtGenerator', () => {
  describe('validate', () => {
    it('should return valid when patterns array has content', async () => {
      const generator = new ASCIIArtGenerator(['Pattern 1', 'Pattern 2']);
      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid when patterns array is empty', async () => {
      const generator = new ASCIIArtGenerator([]);
      const result = await generator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('No art patterns configured');
    });
  });

  describe('generate', () => {
    describe('single pattern', () => {
      it('should return the only pattern available', async () => {
        const pattern = 'Hello\nWorld';
        const generator = new ASCIIArtGenerator([pattern]);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe(pattern);
        expect(result.outputMode).toBe('text');
      });
    });

    describe('multiple patterns', () => {
      it('should select a pattern from available options', async () => {
        const patterns = ['Pattern A', 'Pattern B', 'Pattern C'];
        const generator = new ASCIIArtGenerator(patterns);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(patterns).toContain(result.text);
        expect(result.outputMode).toBe('text');
      });

      it('should select different patterns when Math.random returns different values', async () => {
        // This test verifies deterministic pattern selection through mocked Math.random
        const patterns = ['Art 1', 'Art 2', 'Art 3', 'Art 4', 'Art 5'];
        const generator = new ASCIIArtGenerator(patterns);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        // Mock Math.random to return predictable values that select different patterns
        // With 5 patterns: index 0 (0.0-0.2), 1 (0.2-0.4), 2 (0.4-0.6), 3 (0.6-0.8), 4 (0.8-1.0)
        const mockRandom = jest.spyOn(Math, 'random');
        mockRandom
          .mockReturnValueOnce(0.05) // Selects index 0: 'Art 1'
          .mockReturnValueOnce(0.25) // Selects index 1: 'Art 2'
          .mockReturnValueOnce(0.45) // Selects index 2: 'Art 3'
          .mockReturnValueOnce(0.65) // Selects index 3: 'Art 4'
          .mockReturnValueOnce(0.95); // Selects index 4: 'Art 5'

        // Generate 5 times with mocked values - should get all different patterns
        const results: string[] = [];
        for (let i = 0; i < 5; i++) {
          const result = await generator.generate(context);
          results.push(result.text);
          expect(patterns).toContain(result.text);
        }

        // All results should be unique (deterministically selected different patterns)
        const uniqueResults = new Set(results);
        expect(uniqueResults.size).toBe(5);
        expect(results).toEqual(['Art 1', 'Art 2', 'Art 3', 'Art 4', 'Art 5']);

        // Verify Math.random was called for each generation
        expect(mockRandom).toHaveBeenCalledTimes(5);

        mockRandom.mockRestore();
      });
    });

    describe('Vestaboard color codes', () => {
      it('should support color code 63 (red)', async () => {
        const pattern = '{63}ALERT{0}';
        const generator = new ASCIIArtGenerator([pattern]);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe(pattern);
        expect(result.text).toContain('{63}');
        expect(result.text).toContain('{0}');
      });

      it('should support color code 64 (orange)', async () => {
        const pattern = '{64}WARNING{0}';
        const generator = new ASCIIArtGenerator([pattern]);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe(pattern);
        expect(result.text).toContain('{64}');
      });

      it('should support multiple color codes in one pattern', async () => {
        const pattern = '{63}RED{0} {64}ORANGE{0} {65}YELLOW{0}';
        const generator = new ASCIIArtGenerator([pattern]);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe(pattern);
        expect(result.text).toContain('{63}');
        expect(result.text).toContain('{64}');
        expect(result.text).toContain('{65}');
      });

      it('should support all Vestaboard colors (63-69)', async () => {
        const pattern = '{63}R {64}O {65}Y {66}G {67}B {68}V {69}W{0}';
        const generator = new ASCIIArtGenerator([pattern]);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe(pattern);
        // Verify all color codes preserved
        for (let code = 63; code <= 69; code++) {
          expect(result.text).toContain(`{${code}}`);
        }
      });
    });

    describe('edge cases', () => {
      it('should work with minor update type', async () => {
        const pattern = 'Test Pattern';
        const generator = new ASCIIArtGenerator([pattern]);

        const context: GenerationContext = {
          updateType: 'minor',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe(pattern);
        expect(result.outputMode).toBe('text');
      });

      it('should work with event data present', async () => {
        const pattern = 'Event Art';
        const generator = new ASCIIArtGenerator([pattern]);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
          eventData: { event_type: 'test.event' },
        };

        const result = await generator.generate(context);

        expect(result.text).toBe(pattern);
        expect(result.outputMode).toBe('text');
      });

      it('should handle multi-line ASCII art', async () => {
        const pattern = `  *  *  *
 * * * *
*********
 WELCOME`;
        const generator = new ASCIIArtGenerator([pattern]);

        const context: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2024-01-15T12:00:00'),
        };

        const result = await generator.generate(context);

        expect(result.text).toBe(pattern);
        expect(result.text.split('\n').length).toBe(4);
      });
    });
  });
});
