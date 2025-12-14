import {
  VESTABOARD_COLORS,
  BLANK,
  ROWS,
  COLS,
  horizontalGradient,
  verticalGradient,
  diagonalGradient,
  checkerboard,
  horizontalStripes,
  verticalStripes,
  diamond,
  border,
  wave,
  radialGradient,
} from '@/content/generators/programmatic/patterns/pattern-library.js';

describe('Pattern Library Constants', () => {
  test('VESTABOARD_COLORS contains correct color codes', () => {
    expect(VESTABOARD_COLORS).toEqual([63, 64, 65, 66, 67, 68, 69]);
  });

  test('BLANK is 0', () => {
    expect(BLANK).toBe(0);
  });

  test('ROWS is 6', () => {
    expect(ROWS).toBe(6);
  });

  test('COLS is 22', () => {
    expect(COLS).toBe(22);
  });
});

describe('Pattern Validation Helpers', () => {
  const isValidDimensions = (pattern: number[][]): boolean => {
    return pattern.length === ROWS && pattern.every(row => row.length === COLS);
  };

  const isValidColorCodes = (pattern: number[][]): boolean => {
    const validCodes = new Set([BLANK, ...VESTABOARD_COLORS]);
    return pattern.every(row => row.every(code => validCodes.has(code)));
  };

  describe('horizontalGradient', () => {
    test('returns 6x22 array', () => {
      const pattern = horizontalGradient();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = horizontalGradient();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('shows color progression from left to right', () => {
      const pattern = horizontalGradient();
      // First column should all be same color
      const firstColColor = pattern[0][0];
      expect(pattern.every(row => row[0] === firstColColor)).toBe(true);

      // Last column should all be same color
      const lastColColor = pattern[0][COLS - 1];
      expect(pattern.every(row => row[COLS - 1] === lastColColor)).toBe(true);

      // Colors should differ from start to end
      expect(firstColColor).not.toBe(lastColColor);
    });

    test('gradient is smooth (no sudden jumps)', () => {
      const pattern = horizontalGradient();
      const rowColors = pattern[0]; // Check first row

      // Each adjacent pair should differ by at most 1 color index
      for (let i = 0; i < rowColors.length - 1; i++) {
        const currentIdx = VESTABOARD_COLORS.indexOf(
          rowColors[i] as (typeof VESTABOARD_COLORS)[number]
        );
        const nextIdx = VESTABOARD_COLORS.indexOf(
          rowColors[i + 1] as (typeof VESTABOARD_COLORS)[number]
        );
        const diff = Math.abs(currentIdx - nextIdx);
        expect(diff).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('verticalGradient', () => {
    test('returns 6x22 array', () => {
      const pattern = verticalGradient();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = verticalGradient();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('shows color progression from top to bottom', () => {
      const pattern = verticalGradient();
      // First row should all be same color
      const firstRowColor = pattern[0][0];
      expect(pattern[0].every(col => col === firstRowColor)).toBe(true);

      // Last row should all be same color
      const lastRowColor = pattern[ROWS - 1][0];
      expect(pattern[ROWS - 1].every(col => col === lastRowColor)).toBe(true);

      // Colors should differ from start to end
      expect(firstRowColor).not.toBe(lastRowColor);
    });
  });

  describe('diagonalGradient', () => {
    test('returns 6x22 array', () => {
      const pattern = diagonalGradient();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = diagonalGradient();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('shows diagonal progression', () => {
      const pattern = diagonalGradient();
      // Top-left corner
      const topLeft = pattern[0][0];
      // Bottom-right corner
      const bottomRight = pattern[ROWS - 1][COLS - 1];

      expect(topLeft).not.toBe(bottomRight);
    });
  });

  describe('checkerboard', () => {
    test('returns 6x22 array', () => {
      const pattern = checkerboard();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = checkerboard();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('alternates colors in chess pattern', () => {
      const pattern = checkerboard();
      const color1 = pattern[0][0];
      const color2 = pattern[0][1];

      // Adjacent cells should differ
      expect(color1).not.toBe(color2);

      // Verify alternating pattern in first row
      for (let col = 0; col < COLS; col++) {
        const expectedColor = col % 2 === 0 ? color1 : color2;
        expect(pattern[0][col]).toBe(expectedColor);
      }

      // Verify alternating pattern in first column
      for (let row = 0; row < ROWS; row++) {
        const expectedColor = row % 2 === 0 ? color1 : color2;
        expect(pattern[row][0]).toBe(expectedColor);
      }
    });
  });

  describe('horizontalStripes', () => {
    test('returns 6x22 array', () => {
      const pattern = horizontalStripes();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = horizontalStripes();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('each row is a single color', () => {
      const pattern = horizontalStripes();

      for (let row = 0; row < ROWS; row++) {
        const rowColor = pattern[row][0];
        expect(pattern[row].every(col => col === rowColor)).toBe(true);
      }
    });

    test('rows have different colors', () => {
      const pattern = horizontalStripes();
      const rowColors = pattern.map(row => row[0]);
      const uniqueColors = new Set(rowColors);

      // Should have at least 2 different colors across rows
      expect(uniqueColors.size).toBeGreaterThan(1);
    });
  });

  describe('verticalStripes', () => {
    test('returns 6x22 array', () => {
      const pattern = verticalStripes();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = verticalStripes();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('each column is a single color', () => {
      const pattern = verticalStripes();

      for (let col = 0; col < COLS; col++) {
        const colColor = pattern[0][col];
        for (let row = 0; row < ROWS; row++) {
          expect(pattern[row][col]).toBe(colColor);
        }
      }
    });

    test('columns have different colors', () => {
      const pattern = verticalStripes();
      const colColors = pattern[0]; // First row shows all column colors
      const uniqueColors = new Set(colColors);

      // Should have at least 2 different colors across columns
      expect(uniqueColors.size).toBeGreaterThan(1);
    });
  });

  describe('diamond', () => {
    test('returns 6x22 array', () => {
      const pattern = diamond();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = diamond();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('has centered diamond shape', () => {
      const pattern = diamond();
      const centerRow = Math.floor(ROWS / 2);
      const centerCol = Math.floor(COLS / 2);

      // Center should be one color
      const centerColor = pattern[centerRow][centerCol];

      // Corners should be different (background)
      const cornerColor = pattern[0][0];
      expect(centerColor).not.toBe(cornerColor);
    });
  });

  describe('border', () => {
    test('returns 6x22 array', () => {
      const pattern = border();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = border();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('has colored border around blank center', () => {
      const pattern = border();

      // Check corners are colored (border)
      const borderColor = pattern[0][0];
      expect(borderColor).not.toBe(BLANK);
      expect(pattern[0][COLS - 1]).toBe(borderColor);
      expect(pattern[ROWS - 1][0]).toBe(borderColor);
      expect(pattern[ROWS - 1][COLS - 1]).toBe(borderColor);

      // Check center is blank (if large enough)
      if (ROWS > 2 && COLS > 2) {
        const centerRow = Math.floor(ROWS / 2);
        const centerCol = Math.floor(COLS / 2);
        expect(pattern[centerRow][centerCol]).toBe(BLANK);
      }
    });
  });

  describe('wave', () => {
    test('returns 6x22 array', () => {
      const pattern = wave();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = wave();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('shows sinusoidal variation', () => {
      const pattern = wave();

      // Collect all unique colors
      const uniqueColors = new Set<number>();
      pattern.forEach(row => row.forEach(col => uniqueColors.add(col)));

      // Should use multiple colors for wave effect
      expect(uniqueColors.size).toBeGreaterThan(1);
    });
  });

  describe('radialGradient', () => {
    test('returns 6x22 array', () => {
      const pattern = radialGradient();
      expect(isValidDimensions(pattern)).toBe(true);
    });

    test('all values are valid color codes', () => {
      const pattern = radialGradient();
      expect(isValidColorCodes(pattern)).toBe(true);
    });

    test('colors emanate from center', () => {
      const pattern = radialGradient();
      const centerRow = Math.floor(ROWS / 2);
      const centerCol = Math.floor(COLS / 2);

      // Center color
      const centerColor = pattern[centerRow][centerCol];

      // Corner should be different (farther from center)
      const cornerColor = pattern[0][0];
      expect(centerColor).not.toBe(cornerColor);
    });

    test('symmetric colors at equal distances from center', () => {
      const pattern = radialGradient();
      const centerCol = COLS / 2;

      // Points equidistant from center should have same color
      // Test horizontal symmetry
      for (let row = 0; row < ROWS; row++) {
        const leftCol = Math.floor(centerCol - 2);
        const rightCol = Math.floor(centerCol + 2);
        if (leftCol >= 0 && rightCol < COLS) {
          // Due to rounding, may not be exactly equal, but should be close
          const leftColor = pattern[row][leftCol];
          const rightColor = pattern[row][rightCol];
          const leftIdx = VESTABOARD_COLORS.indexOf(
            leftColor as (typeof VESTABOARD_COLORS)[number]
          );
          const rightIdx = VESTABOARD_COLORS.indexOf(
            rightColor as (typeof VESTABOARD_COLORS)[number]
          );
          expect(Math.abs(leftIdx - rightIdx)).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
