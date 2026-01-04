/**
 * Unit tests for PatternGenerator
 *
 * Tests the pattern generator that creates visual patterns for Vestaboard display
 * using the pattern library functions.
 */

import { PatternGenerator } from '@/content/generators/programmatic/pattern-generator.js';
import { GenerationContext } from '@/types/content-generator.js';
import * as patterns from '@/content/generators/programmatic/patterns/index.js';

describe('PatternGenerator', () => {
  let generator: PatternGenerator;
  let mockContext: GenerationContext;

  beforeEach(() => {
    generator = new PatternGenerator();
    mockContext = {
      updateType: 'major',
      timestamp: new Date('2025-01-15T12:00:00Z'),
    };
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

    it('should include patternType in metadata', async () => {
      const result = await generator.generate(mockContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.patternType).toBeDefined();
      expect(typeof result.metadata?.patternType).toBe('string');
    });

    it('should include generator name in metadata', async () => {
      const result = await generator.generate(mockContext);

      expect(result.metadata?.generator).toBe('pattern-generator');
    });

    it('should return valid 6x22 array', async () => {
      const result = await generator.generate(mockContext);

      expect(result.layout?.characterCodes).toBeDefined();
      expect(result.layout?.characterCodes?.length).toBe(6); // 6 rows

      result.layout?.characterCodes?.forEach(row => {
        expect(row.length).toBe(22); // 22 columns per row
      });
    });

    it('should use only approved color codes', async () => {
      const result = await generator.generate(mockContext);
      const approvedCodes = [0, 63, 64, 65, 66, 67, 68, 69]; // BLANK + VESTABOARD_COLORS

      result.layout?.characterCodes?.forEach(row => {
        row.forEach(code => {
          expect(approvedCodes).toContain(code);
        });
      });
    });

    describe('pattern selection', () => {
      it('should select horizontalGradient when random is 0', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('horizontalGradient');
      });

      it('should select verticalGradient when random is 0.1', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.1);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('verticalGradient');
      });

      it('should select diagonalGradient when random is 0.2', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.2);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('diagonalGradient');
      });

      it('should select checkerboard when random is 0.3', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.3);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('checkerboard');
      });

      it('should select horizontalStripes when random is 0.4', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.4);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('horizontalStripes');
      });

      it('should select verticalStripes when random is 0.5', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('verticalStripes');
      });

      it('should select diamond when random is 0.6', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.6);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('diamond');
      });

      it('should select border when random is 0.7', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.7);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('border');
      });

      it('should select wave when random is 0.8', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.8);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('wave');
      });

      it('should select radialGradient when random is 0.9', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.9);

        const result = await generator.generate(mockContext);

        expect(result.metadata?.patternType).toBe('radialGradient');
      });

      it('should randomly select different patterns on repeated calls', async () => {
        const patterns = new Set<string>();

        // Mock random to cycle through different values
        let callCount = 0;
        jest.spyOn(Math, 'random').mockImplementation(() => {
          const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
          return values[callCount++ % values.length];
        });

        for (let i = 0; i < 10; i++) {
          const result = await generator.generate(mockContext);
          patterns.add(result.metadata?.patternType as string);
        }

        expect(patterns.size).toBe(10); // All 10 patterns should be selected
      });
    });

    describe('pattern data validation', () => {
      it('should return actual pattern data from horizontalGradient', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        const expectedPattern = patterns.horizontalGradient();

        const result = await generator.generate(mockContext);

        expect(result.layout?.characterCodes).toEqual(expectedPattern);
      });

      it('should return actual pattern data from checkerboard', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.3);
        const expectedPattern = patterns.checkerboard();

        const result = await generator.generate(mockContext);

        expect(result.layout?.characterCodes).toEqual(expectedPattern);
      });

      it('should return actual pattern data from wave', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.8);
        const expectedPattern = patterns.wave();

        const result = await generator.generate(mockContext);

        expect(result.layout?.characterCodes).toEqual(expectedPattern);
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
