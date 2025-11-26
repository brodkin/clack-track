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
 * @param char - Character to convert
 * @returns Character code (0 for unsupported characters)
 */
export function charToCode(char: string): number {
  const upperChar = char.toUpperCase();
  return CHARACTER_MAP[upperChar] ?? 0;
}

/**
 * Converts a character code to its character representation
 * @param code - Character code
 * @returns Character (space for unknown codes)
 */
function codeToChar(code: number): string {
  return CODE_TO_CHAR_MAP[code] ?? ' ';
}

/**
 * Wraps text at word boundaries to fit within the specified width
 * @param text - Text to wrap
 * @param maxWidth - Maximum width of each line
 * @returns Array of wrapped lines
 */
function wrapText(text: string, maxWidth: number): string[] {
  if (!text || text.trim() === '') {
    return [''];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue; // Skip empty strings from multiple spaces

    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If single word is longer than maxWidth, truncate it
      currentLine = word.length > maxWidth ? word.substring(0, maxWidth) : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Centers text within a given width
 * @param text - Text to center
 * @param width - Total width
 * @returns Centered text with padding
 */
function centerText(text: string, width: number): string {
  if (text.length >= width) {
    return text.substring(0, width);
  }

  const padding = width - text.length;
  const leftPadding = Math.floor(padding / 2);
  const rightPadding = padding - leftPadding;

  return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
}

/**
 * Converts text to a 6x22 Vestaboard layout
 * - Converts to uppercase
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

  // Convert to uppercase and split by newlines
  const upperText = text.toUpperCase();
  const explicitLines = upperText.split('\n');

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
    for (let col = 0; col < COLS; col++) {
      layout[rowIndex][col] = charToCode(centeredLine[col] || ' ');
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
