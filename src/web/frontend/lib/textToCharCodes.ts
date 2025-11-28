/**
 * Text to Character Codes Conversion Utility
 *
 * Converts text strings to Vestaboard character code grid (6x22)
 */

/**
 * Character to Vestaboard code mapping
 * Reverse of CHAR_MAP in VestaboardPreview
 */
const TEXT_TO_CODE: Record<string, number> = {
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
  '♥': 64,
  '★': 65,
  '♪': 66,
};

const ROWS = 6;
const COLS = 22;

/**
 * Convert a single character to its Vestaboard code
 */
function charToCode(char: string): number {
  const upper = char.toUpperCase();
  return TEXT_TO_CODE[upper] ?? 0;
}

/**
 * Convert a line of text to an array of character codes
 */
function lineToRow(line: string): number[] {
  const row: number[] = [];
  for (let i = 0; i < COLS; i++) {
    row.push(i < line.length ? charToCode(line[i]) : 0);
  }
  return row;
}

/**
 * Convert text content to a 6x22 grid of Vestaboard character codes
 *
 * @param text - Text content, can include newlines
 * @returns 6x22 grid of character codes
 */
export function textToCharacterCodes(text: string): number[][] {
  // Split text by newlines
  const lines = text.split('\n');

  // Create 6 rows, padding with empty rows if needed
  const grid: number[][] = [];
  for (let i = 0; i < ROWS; i++) {
    const line = lines[i] || '';
    grid.push(lineToRow(line));
  }

  return grid;
}

/**
 * Create an empty 6x22 grid (all spaces)
 */
export function emptyGrid(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}
