/**
 * Pattern Library - Mathematical pattern generators for Vestaboard displays
 *
 * Generates 6x22 arrays of Vestaboard character codes representing various visual patterns.
 * All patterns use only approved color codes (0, 63-69).
 */

// Color constants
export const VESTABOARD_COLORS = [63, 64, 65, 66, 67, 68, 69] as const; // Red, Orange, Yellow, Green, Blue, Violet, White
export const BLANK = 0; // Black/empty
export const ROWS = 6;
export const COLS = 22;

/**
 * Creates an empty 6x22 grid filled with BLANK
 */
function createEmptyGrid(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(BLANK));
}

/**
 * Maps a normalized value (0-1) to a color index in VESTABOARD_COLORS
 */
function normalizedToColorIndex(normalized: number): number {
  const index = Math.floor(normalized * (VESTABOARD_COLORS.length - 1));
  return Math.max(0, Math.min(VESTABOARD_COLORS.length - 1, index));
}

/**
 * Gets a color from VESTABOARD_COLORS by normalized value (0-1)
 */
function getColorByNormalized(normalized: number): number {
  return VESTABOARD_COLORS[normalizedToColorIndex(normalized)];
}

/**
 * Horizontal Gradient - Smooth color transition from left to right
 */
export function horizontalGradient(): number[][] {
  const grid = createEmptyGrid();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const normalized = col / (COLS - 1);
      grid[row][col] = getColorByNormalized(normalized);
    }
  }

  return grid;
}

/**
 * Vertical Gradient - Color transition from top to bottom
 */
export function verticalGradient(): number[][] {
  const grid = createEmptyGrid();

  for (let row = 0; row < ROWS; row++) {
    const normalized = row / (ROWS - 1);
    const color = getColorByNormalized(normalized);

    for (let col = 0; col < COLS; col++) {
      grid[row][col] = color;
    }
  }

  return grid;
}

/**
 * Diagonal Gradient - Color transition from top-left to bottom-right
 */
export function diagonalGradient(): number[][] {
  const grid = createEmptyGrid();
  const maxDistance = Math.sqrt(ROWS * ROWS + COLS * COLS);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const distance = Math.sqrt(row * row + col * col);
      const normalized = distance / maxDistance;
      grid[row][col] = getColorByNormalized(normalized);
    }
  }

  return grid;
}

/**
 * Checkerboard - Alternating colors in chess pattern
 */
export function checkerboard(): number[][] {
  const grid = createEmptyGrid();
  const color1 = VESTABOARD_COLORS[0]; // Red
  const color2 = VESTABOARD_COLORS[6]; // White

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const isEven = (row + col) % 2 === 0;
      grid[row][col] = isEven ? color1 : color2;
    }
  }

  return grid;
}

/**
 * Horizontal Stripes - Each row is a different color
 */
export function horizontalStripes(): number[][] {
  const grid = createEmptyGrid();

  for (let row = 0; row < ROWS; row++) {
    const colorIndex = row % VESTABOARD_COLORS.length;
    const color = VESTABOARD_COLORS[colorIndex];

    for (let col = 0; col < COLS; col++) {
      grid[row][col] = color;
    }
  }

  return grid;
}

/**
 * Vertical Stripes - Each column is a different color
 */
export function verticalStripes(): number[][] {
  const grid = createEmptyGrid();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const colorIndex = col % VESTABOARD_COLORS.length;
      grid[row][col] = VESTABOARD_COLORS[colorIndex];
    }
  }

  return grid;
}

/**
 * Diamond - Centered diamond shape with background
 */
export function diamond(): number[][] {
  const grid = createEmptyGrid();
  const centerRow = ROWS / 2;
  const centerCol = COLS / 2;
  const diamondColor = VESTABOARD_COLORS[3]; // Green
  const backgroundColor = VESTABOARD_COLORS[0]; // Red

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Manhattan distance from center
      const dist = Math.abs(row - centerRow) / centerRow + Math.abs(col - centerCol) / centerCol;

      // Inside diamond if distance <= 1
      grid[row][col] = dist <= 1 ? diamondColor : backgroundColor;
    }
  }

  return grid;
}

/**
 * Border - Colored border around blank center
 */
export function border(): number[][] {
  const grid = createEmptyGrid();
  const borderColor = VESTABOARD_COLORS[4]; // Blue

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Is this cell on the border?
      const isBorder = row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1;
      grid[row][col] = isBorder ? borderColor : BLANK;
    }
  }

  return grid;
}

/**
 * Wave - Sinusoidal color distribution
 */
export function wave(): number[][] {
  const grid = createEmptyGrid();
  const frequency = 2; // Number of wave cycles across width

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Sine wave based on column position
      const angle = (col / COLS) * frequency * 2 * Math.PI;
      const sineValue = Math.sin(angle + (row / ROWS) * Math.PI);

      // Map sine value (-1 to 1) to (0 to 1)
      const normalized = (sineValue + 1) / 2;
      grid[row][col] = getColorByNormalized(normalized);
    }
  }

  return grid;
}

/**
 * Radial Gradient - Colors emanating from center
 */
export function radialGradient(): number[][] {
  const grid = createEmptyGrid();
  const centerRow = ROWS / 2;
  const centerCol = COLS / 2;

  // Maximum distance from center to corner
  const maxDistance = Math.sqrt(centerRow * centerRow + centerCol * centerCol);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Euclidean distance from center
      const distance = Math.sqrt((row - centerRow) ** 2 + (col - centerCol) ** 2);

      const normalized = distance / maxDistance;
      grid[row][col] = getColorByNormalized(normalized);
    }
  }

  return grid;
}
