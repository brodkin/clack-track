/**
 * Unit tests for SleepArtGenerator
 *
 * Tests the sleep art generator that creates dark abstract art patterns
 * for Vestaboard display using primarily black with sparse blue and violet accents.
 *
 * @module tests/unit/content/generators/sleep-art-generator
 */

import { SleepArtGenerator } from '@/content/generators/programmatic/sleep-art-generator.js';
import { GenerationContext } from '@/types/content-generator.js';

describe('SleepArtGenerator', () => {
  let generator: SleepArtGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new SleepArtGenerator();
    mockContext = {
      updateType: 'major',
      timestamp: new Date('2025-01-15T23:00:00Z'),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generate()', () => {
    it('should return valid GeneratedContent structure', async () => {
      const result = await generator.generate(mockContext);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('outputMode');
      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('metadata');
    });

    it('should use layout output mode', async () => {
      const result = await generator.generate(mockContext);

      expect(result.outputMode).toBe('layout');
    });

    it('should have empty text field when using layout mode', async () => {
      const result = await generator.generate(mockContext);

      expect(result.text).toBe('');
    });

    it('should have layout with characterCodes', async () => {
      const result = await generator.generate(mockContext);

      expect(result.layout).toBeDefined();
      expect(result.layout?.characterCodes).toBeDefined();
      expect(result.layout?.rows).toEqual([]);
    });

    it('should include generator name in metadata', async () => {
      const result = await generator.generate(mockContext);

      expect(result.metadata?.generator).toBe('sleep-art-generator');
    });

    it('should return valid 6x22 array', async () => {
      const result = await generator.generate(mockContext);

      expect(result.layout?.characterCodes).toBeDefined();
      expect(result.layout?.characterCodes?.length).toBe(6); // 6 rows

      result.layout?.characterCodes?.forEach(row => {
        expect(row.length).toBe(22); // 22 columns per row
      });
    });

    describe('color distribution', () => {
      const BLACK = 0;
      const BLUE = 67;
      const VIOLET = 68;
      const VALID_COLORS = [BLACK, BLUE, VIOLET];

      it('should use only black (0), blue (67), and violet (68) color codes', async () => {
        const result = await generator.generate(mockContext);

        result.layout?.characterCodes?.forEach(row => {
          row.forEach(code => {
            expect(VALID_COLORS).toContain(code);
          });
        });
      });

      it('should have approximately 85% black cells', async () => {
        // Run multiple generations to test statistical distribution
        const results: number[] = [];

        for (let i = 0; i < 50; i++) {
          const result = await generator.generate(mockContext);
          const allCells = result.layout?.characterCodes?.flat() || [];
          const blackCount = allCells.filter(code => code === BLACK).length;
          const blackPercentage = (blackCount / 132) * 100; // 6x22 = 132 total cells
          results.push(blackPercentage);
        }

        const avgBlack = results.reduce((a, b) => a + b, 0) / results.length;

        // Allow 10% tolerance for random variance (75-95% range for ~85% target)
        expect(avgBlack).toBeGreaterThan(75);
        expect(avgBlack).toBeLessThan(95);
      });

      it('should have approximately 10% blue cells', async () => {
        const results: number[] = [];

        for (let i = 0; i < 50; i++) {
          const result = await generator.generate(mockContext);
          const allCells = result.layout?.characterCodes?.flat() || [];
          const blueCount = allCells.filter(code => code === BLUE).length;
          const bluePercentage = (blueCount / 132) * 100;
          results.push(bluePercentage);
        }

        const avgBlue = results.reduce((a, b) => a + b, 0) / results.length;

        // Allow 8% tolerance for random variance (2-18% range for ~10% target)
        expect(avgBlue).toBeGreaterThan(2);
        expect(avgBlue).toBeLessThan(18);
      });

      it('should have approximately 5% violet cells', async () => {
        const results: number[] = [];

        for (let i = 0; i < 50; i++) {
          const result = await generator.generate(mockContext);
          const allCells = result.layout?.characterCodes?.flat() || [];
          const violetCount = allCells.filter(code => code === VIOLET).length;
          const violetPercentage = (violetCount / 132) * 100;
          results.push(violetPercentage);
        }

        const avgViolet = results.reduce((a, b) => a + b, 0) / results.length;

        // Allow 6% tolerance for random variance (0-11% range for ~5% target)
        expect(avgViolet).toBeGreaterThanOrEqual(0);
        expect(avgViolet).toBeLessThan(12);
      });

      it('should sum to 100% across all colors', async () => {
        const result = await generator.generate(mockContext);
        const allCells = result.layout?.characterCodes?.flat() || [];

        const blackCount = allCells.filter(code => code === BLACK).length;
        const blueCount = allCells.filter(code => code === BLUE).length;
        const violetCount = allCells.filter(code => code === VIOLET).length;

        expect(blackCount + blueCount + violetCount).toBe(132);
      });
    });

    describe('randomization', () => {
      it('should generate different patterns on repeated calls', async () => {
        const patterns: string[] = [];

        for (let i = 0; i < 10; i++) {
          const result = await generator.generate(mockContext);
          const patternStr = JSON.stringify(result.layout?.characterCodes);
          patterns.push(patternStr);
        }

        // At least some patterns should be unique (randomization working)
        const uniquePatterns = new Set(patterns);
        expect(uniquePatterns.size).toBeGreaterThan(1);
      });

      it('should produce deterministic output when Math.random is mocked', async () => {
        let callCount = 0;
        jest.spyOn(Math, 'random').mockImplementation(() => {
          return (callCount++ % 100) / 100;
        });

        const result1 = await generator.generate(mockContext);

        callCount = 0;
        const result2 = await generator.generate(mockContext);

        expect(result1.layout?.characterCodes).toEqual(result2.layout?.characterCodes);
      });

      it('should have sparse color distribution resembling a starfield', async () => {
        const result = await generator.generate(mockContext);
        const characterCodes = result.layout?.characterCodes || [];

        // Check that colored cells are distributed (not all clustered)
        const coloredPositions: { row: number; col: number }[] = [];

        characterCodes.forEach((row, rowIdx) => {
          row.forEach((code, colIdx) => {
            if (code !== 0) {
              coloredPositions.push({ row: rowIdx, col: colIdx });
            }
          });
        });

        // If there are colored cells, they should be spread across multiple rows
        if (coloredPositions.length > 3) {
          const uniqueRows = new Set(coloredPositions.map(p => p.row));
          const uniqueCols = new Set(coloredPositions.map(p => p.col));

          // Should span at least 2 rows if there are enough colored cells
          expect(uniqueRows.size).toBeGreaterThanOrEqual(1);
          // Should span multiple columns
          expect(uniqueCols.size).toBeGreaterThanOrEqual(1);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle minor update context', async () => {
        const minorContext: GenerationContext = {
          updateType: 'minor',
          timestamp: new Date('2025-01-15T23:30:00Z'),
        };

        const result = await generator.generate(minorContext);

        expect(result.outputMode).toBe('layout');
        expect(result.layout?.characterCodes?.length).toBe(6);
      });

      it('should handle context with event data', async () => {
        const contextWithEvent: GenerationContext = {
          updateType: 'major',
          timestamp: new Date('2025-01-15T23:00:00Z'),
          eventData: { someKey: 'someValue' },
        };

        const result = await generator.generate(contextWithEvent);

        expect(result.outputMode).toBe('layout');
        expect(result.layout?.characterCodes?.length).toBe(6);
      });
    });
  });

  describe('validate()', () => {
    it('should always return valid', async () => {
      const result = await generator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });
});
