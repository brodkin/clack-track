/**
 * Color codes for Vestaboard display
 * Each code represents a specific color that can be displayed on the split-flap board
 */
export const COLOR_CODES = {
  RED: 63,
  ORANGE: 64,
  YELLOW: 65,
  GREEN: 66,
  BLUE: 67,
  VIOLET: 68,
  WHITE: 69,
  BLACK: 70, // Explicit black tile (for white Vestaboards)
} as const;

/**
 * Type representing a valid Vestaboard color code
 */
export type ColorCode = (typeof COLOR_CODES)[keyof typeof COLOR_CODES];

/**
 * Emoji to color code mapping
 * Maps color emojis to their corresponding Vestaboard color codes
 * Includes Unicode variant selectors for maximum compatibility
 */
export const COLOR_EMOJI_MAP: Record<string, number> = {
  // Red (63)
  '🟥': 63,
  '🔴': 63,
  '❤️': 63, // with variation selector U+FE0F
  '❤': 63, // without variation selector
  '🔺': 63,
  '🔻': 63,
  // Orange (64)
  '🟧': 64,
  '🟠': 64,
  '🧡': 64,
  // Yellow (65)
  '🟨': 65,
  '🟡': 65,
  '💛': 65,
  // Green (66)
  '🟩': 66,
  '🟢': 66,
  '💚': 66,
  // Blue (67)
  '🟦': 67,
  '🔵': 67,
  '💙': 67,
  // Violet (68)
  '🟪': 68,
  '🟣': 68,
  '💜': 68,
  // White (69)
  '⬜': 69,
  '◻️': 69, // with variation selector U+FE0F
  '◻': 69, // without variation selector
  '◽': 69,
  '▫️': 69, // with variation selector U+FE0F
  '▫': 69, // without variation selector
  '⚪': 69,
  '🤍': 69,
  // Black → Blank (0)
  '⬛': 0,
  '◼️': 0, // with variation selector U+FE0F
  '◼': 0, // without variation selector
  '◾': 0,
  '▪️': 0, // with variation selector U+FE0F
  '▪': 0, // without variation selector
  '⚫': 0,
  '🖤': 0,
};

const CHARACTER_MAP: Record<string, number> = {
  ' ': 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9,
  J: 10,
  K: 11,
  L: 12,
  M: 13,
  N: 14,
  O: 15,
  P: 16,
  Q: 17,
  R: 18,
  S: 19,
  T: 20,
  U: 21,
  V: 22,
  W: 23,
  X: 24,
  Y: 25,
  Z: 26,
  '1': 27,
  '2': 28,
  '3': 29,
  '4': 30,
  '5': 31,
  '6': 32,
  '7': 33,
  '8': 34,
  '9': 35,
  '0': 36,
  '!': 37,
  '@': 38,
  '#': 39,
  $: 40,
  '(': 41,
  ')': 42,
  '-': 44,
  '+': 46,
  '&': 47,
  '=': 48,
  ';': 49,
  ':': 50,
  "'": 52,
  '"': 53,
  '%': 54,
  ',': 55,
  '.': 56,
  '/': 59,
  '?': 60,
  '°': 62,
  RED: 63,
  ORANGE: 64,
  YELLOW: 65,
  GREEN: 66,
  BLUE: 67,
  VIOLET: 68,
  WHITE: 69,
};

// Reverse map for code to character conversion
const CODE_TO_CHAR_MAP: Record<number, string> = Object.entries(CHARACTER_MAP).reduce(
  (acc, [char, code]) => {
    acc[code] = char;
    return acc;
  },
  {} as Record<number, string>
);

/**
 * Converts a single character to its Vestaboard character code
 * Checks COLOR_EMOJI_MAP first for emoji support, then CHARACTER_MAP
 * @param char - Character or emoji to convert
 * @returns Character code (0 for unsupported characters)
 */
export function charToCode(char: string): number {
  // Check emoji map first (emojis are multi-character Unicode sequences)
  if (COLOR_EMOJI_MAP[char] !== undefined) {
    return COLOR_EMOJI_MAP[char];
  }

  // Fall back to standard character mapping
  const upperChar = char.toUpperCase();
  return CHARACTER_MAP[upperChar] ?? 0;
}

/**
 * Converts a character code to its character representation
 * @param code - Character code
 * @returns Character (space for unknown codes)
 */
export function codeToChar(code: number): string {
  return CODE_TO_CHAR_MAP[code] ?? ' ';
}

/**
 * Convert a numeric color code to its color name
 *
 * @param code - The numeric color code (63-69)
 * @returns The color name (e.g., 'RED', 'BLUE') or null if invalid
 *
 * @example
 * codeToColorName(63) // 'RED'
 * codeToColorName(67) // 'BLUE'
 * codeToColorName(99) // null
 */
export function codeToColorName(code: number): string | null {
  const reverseMap: Record<number, string> = {
    63: 'RED',
    64: 'ORANGE',
    65: 'YELLOW',
    66: 'GREEN',
    67: 'BLUE',
    68: 'VIOLET',
    69: 'WHITE',
  };
  return reverseMap[code] ?? null;
}

/**
 * Wraps text at word boundaries to fit within the specified width
 * Properly handles multi-character emojis using grapheme cluster counting
 * @param text - Text to wrap
 * @param maxWidth - Maximum width of each line
 * @returns Array of wrapped lines
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (!text || text.trim() === '') {
    return [''];
  }

  const allLines: string[] = [];

  // First, split by explicit newlines to respect line breaks
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      // Empty line - preserve it as empty
      allLines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (!word) continue; // Skip empty strings from multiple spaces

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      // Use Array.from to count grapheme clusters (handles emojis correctly)
      const testLineLength = Array.from(testLine).length;

      if (testLineLength <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          allLines.push(currentLine);
        }
        // If single word is longer than maxWidth, truncate it
        const wordLength = Array.from(word).length;
        currentLine = wordLength > maxWidth ? Array.from(word).slice(0, maxWidth).join('') : word;
      }
    }

    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  return allLines.length > 0 ? allLines : [''];
}

/**
 * Centers text within a given width
 * Properly handles multi-character emojis using grapheme cluster counting
 * @param text - Text to center
 * @param width - Total width
 * @returns Centered text with padding
 */
function centerText(text: string, width: number): string {
  // Use Array.from to count grapheme clusters (handles emojis correctly)
  const textLength = Array.from(text).length;

  if (textLength >= width) {
    return Array.from(text).slice(0, width).join('');
  }

  const padding = width - textLength;
  const leftPadding = Math.floor(padding / 2);
  const rightPadding = padding - leftPadding;

  return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
}

/**
 * Converts text to a 6x22 Vestaboard layout
 * - Converts to uppercase (preserves emojis)
 * - Auto-wraps long lines at word boundaries
 * - Centers text horizontally and vertically
 * - Replaces unsupported characters with blanks
 *
 * @param text - Text to convert (can include \n for line breaks)
 * @returns 6x22 array of character codes
 */
export function textToLayout(text: string): number[][] {
  const ROWS = 6;
  const COLS = 22;

  // Initialize empty layout
  const layout: number[][] = Array(ROWS)
    .fill(null)
    .map(() => Array(COLS).fill(0));

  if (!text) {
    return layout;
  }

  // Split by newlines BEFORE converting to uppercase to preserve emojis
  const explicitLines = text.split('\n');

  // Wrap each line to fit within column width
  const allLines: string[] = [];
  for (const line of explicitLines) {
    const wrappedLines = wrapText(line, COLS);
    allLines.push(...wrappedLines);
  }

  // Truncate to max rows
  const linesToUse = allLines.slice(0, ROWS);

  // Center vertically
  const verticalPadding = Math.floor((ROWS - linesToUse.length) / 2);

  // Convert each line to character codes
  linesToUse.forEach((line, lineIndex) => {
    const rowIndex = verticalPadding + lineIndex;
    if (rowIndex >= ROWS) return;

    // Center horizontally
    const centeredLine = centerText(line, COLS);

    // Convert to character codes
    // Use Array.from or [...string] to properly handle multi-character emojis
    const chars = Array.from(centeredLine);
    for (let col = 0; col < COLS; col++) {
      layout[rowIndex][col] = charToCode(chars[col] || ' ');
    }
  });

  return layout;
}

/**
 * Converts a Vestaboard layout back to text
 * - Preserves line breaks
 * - Trims trailing spaces from each line
 *
 * @param layout - 6x22 array of character codes
 * @returns Text representation
 */
export function layoutToText(layout: number[][]): string {
  const lines: string[] = [];

  for (const row of layout) {
    const line = row.map(code => codeToChar(code)).join('');
    const trimmedLine = line.trimEnd();
    lines.push(trimmedLine);
  }

  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}
