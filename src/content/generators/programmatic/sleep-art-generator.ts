/**
 * Sleep Art Generator - Dark abstract art patterns for Vestaboard display
 *
 * Creates dreamy night sky patterns using primarily black with sparse
 * blue and violet accents, resembling a starfield or night sky.
 *
 * Color distribution:
 * - ~85% black (70) - Night sky background (explicit black for white boards)
 * - ~10% blue (67) - Star accents
 * - ~5% violet (68) - Rare cosmic highlights
 *
 * @module content/generators/programmatic/sleep-art-generator
 */

import { ProgrammaticGenerator } from '../programmatic-generator.js';
import type { GeneratedContent, GenerationContext } from '@/types/content-generator.js';

/** Vestaboard display constants */
const ROWS = 6;
const COLS = 22;

/** Color codes for sleep art */
const BLACK = 70; // Explicit black tile (code 70) for white Vestaboards
const BLUE = 67;
const VIOLET = 68;

/** Target color distribution percentages */
const BLACK_PERCENTAGE = 0.85;
const BLUE_PERCENTAGE = 0.1;
// Violet fills remaining ~5%

/**
 * Sleep Art Generator implementation.
 *
 * Generates dark abstract art patterns for Vestaboard display, creating
 * a dreamy night sky aesthetic with sparse colored accents against a
 * predominantly black background.
 *
 * @extends ProgrammaticGenerator
 *
 * @example
 * ```typescript
 * const generator = new SleepArtGenerator();
 * const context: GenerationContext = {
 *   updateType: 'major',
 *   timestamp: new Date()
 * };
 *
 * const content = await generator.generate(context);
 * // Returns layout with characterCodes array
 * // content.outputMode === 'layout'
 * // content.layout.characterCodes === 6x22 array of color codes
 * ```
 */
export class SleepArtGenerator extends ProgrammaticGenerator {
  /**
   * Generate sleep art pattern for Vestaboard display.
   *
   * Creates a 6x22 grid with randomized color distribution following
   * the night sky aesthetic: ~85% black, ~10% blue, ~5% violet.
   *
   * @param {GenerationContext} _context - Generation context (unused for this generator)
   * @returns {Promise<GeneratedContent>} Generated pattern with layout data
   *
   * @example
   * ```typescript
   * const generator = new SleepArtGenerator();
   * const content = await generator.generate({
   *   updateType: 'major',
   *   timestamp: new Date()
   * });
   *
   * console.log(content.outputMode); // 'layout'
   * console.log(content.layout?.characterCodes?.length); // 6 (rows)
   * console.log(content.layout?.characterCodes?.[0].length); // 22 (columns)
   * ```
   */
  async generate(_context: GenerationContext): Promise<GeneratedContent> {
    const characterCodes = this.generateStarfield();

    return {
      text: '',
      outputMode: 'layout',
      layout: {
        rows: [],
        characterCodes,
      },
      metadata: {
        generator: 'sleep-art-generator',
      },
    };
  }

  /**
   * Generate a starfield pattern with the target color distribution.
   *
   * Uses weighted random selection to achieve approximately:
   * - 85% black cells
   * - 10% blue cells
   * - 5% violet cells
   *
   * @returns {number[][]} 6x22 array of Vestaboard color codes
   */
  private generateStarfield(): number[][] {
    const characterCodes: number[][] = [];

    for (let row = 0; row < ROWS; row++) {
      const rowCodes: number[] = [];
      for (let col = 0; col < COLS; col++) {
        rowCodes.push(this.selectColor());
      }
      characterCodes.push(rowCodes);
    }

    return characterCodes;
  }

  /**
   * Select a color based on weighted random distribution.
   *
   * @returns {number} Color code (BLACK=0, BLUE=67, or VIOLET=68)
   */
  private selectColor(): number {
    const random = Math.random();

    if (random < BLACK_PERCENTAGE) {
      return BLACK;
    } else if (random < BLACK_PERCENTAGE + BLUE_PERCENTAGE) {
      return BLUE;
    } else {
      return VIOLET;
    }
  }
}
