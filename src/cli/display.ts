/**
 * CLI Display Utilities
 *
 * Centralized functions for rendering Vestaboard layouts in the terminal.
 * Used by frame, content:test, and other CLI commands for consistent output.
 */

import {
  codeToColorName,
  codeToChar,
  textToLayout,
} from '../api/vestaboard/character-converter.js';
import type { VestaboardLayout } from '../types/content.js';

/**
 * Terminal color escape codes
 */
export const terminalColors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  // Background colors for Vestaboard color preview
  bgRed: '\x1b[41m',
  bgOrange: '\x1b[48;5;208m',
  bgYellow: '\x1b[43m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgViolet: '\x1b[45m',
  bgWhite: '\x1b[47m',
} as const;

/**
 * Map Vestaboard color names to terminal background colors
 */
const colorToTerminalBg: Record<string, string> = {
  RED: terminalColors.bgRed,
  ORANGE: terminalColors.bgOrange,
  YELLOW: terminalColors.bgYellow,
  GREEN: terminalColors.bgGreen,
  BLUE: terminalColors.bgBlue,
  VIOLET: terminalColors.bgViolet,
  WHITE: terminalColors.bgWhite,
};

/**
 * Render a single character code for terminal display
 *
 * @param code - Vestaboard character code
 * @returns Terminal-rendered character (with color escapes for color blocks)
 */
function renderCharCode(code: number): string {
  // Check if this is a color code (63-69)
  const colorName = codeToColorName(code);
  if (colorName) {
    const bg = colorToTerminalBg[colorName] ?? '';
    return `${bg} ${terminalColors.reset}`;
  }

  // Regular character - convert code back to char
  return codeToChar(code);
}

/**
 * Normalize layout input to number[][] format
 *
 * Handles both raw character code arrays and VestaboardLayout objects.
 *
 * @param layout - Either number[][] or VestaboardLayout
 * @returns Normalized number[][] layout
 */
function normalizeLayout(layout: number[][] | VestaboardLayout): number[][] {
  // If it's already a number[][], return as-is
  if (Array.isArray(layout) && Array.isArray(layout[0]) && typeof layout[0][0] === 'number') {
    return layout as number[][];
  }

  // If it's a VestaboardLayout object
  const vestaLayout = layout as VestaboardLayout;

  // Prefer characterCodes if available
  if (vestaLayout.characterCodes) {
    return vestaLayout.characterCodes;
  }

  // Convert rows to character codes
  if (vestaLayout.rows) {
    return textToLayout(vestaLayout.rows.join('\n'));
  }

  // Fallback: empty 6x22 layout
  return Array(6)
    .fill(null)
    .map(() => Array(22).fill(0));
}

/**
 * Render a Vestaboard layout as ASCII art with color blocks
 *
 * Displays a bordered 6x22 grid with:
 * - Box-drawing characters for borders
 * - Terminal colors for Vestaboard color blocks
 * - Character codes converted back to displayable characters
 *
 * @param layout - 6x22 array of Vestaboard character codes, or VestaboardLayout object
 * @returns Multi-line string with ASCII preview
 *
 * @example
 * ```typescript
 * // Raw character codes
 * const layout = [[0, 1, 2, ...], ...]; // 6 rows of 22 codes
 * console.log(renderAsciiPreview(layout));
 *
 * // VestaboardLayout object
 * const vbLayout = { rows: ['HELLO', 'WORLD'], characterCodes: [[...]] };
 * console.log(renderAsciiPreview(vbLayout));
 *
 * // Output:
 * // ┌──────────────────────┐
 * // │ ABC...               │
 * // │ ...                  │
 * // └──────────────────────┘
 * ```
 */
export function renderAsciiPreview(layout: number[][] | VestaboardLayout): string {
  const normalizedLayout = normalizeLayout(layout);
  const lines: string[] = [];

  // Top border
  lines.push('┌' + '─'.repeat(22) + '┐');

  // Content rows
  for (const row of normalizedLayout) {
    let line = '│';
    for (const code of row) {
      line += renderCharCode(code);
    }
    line += '│';
    lines.push(line);
  }

  // Bottom border
  lines.push('└' + '─'.repeat(22) + '┘');

  return lines.join('\n');
}
