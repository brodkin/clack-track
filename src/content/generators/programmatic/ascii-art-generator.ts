/**
 * ASCIIArtGenerator - ASCII art pattern generator
 *
 * Generates ASCII art from configured patterns with support for
 * Vestaboard color codes (63-69).
 *
 * Color codes:
 * - 63: Red
 * - 64: Orange
 * - 65: Yellow
 * - 66: Green
 * - 67: Blue
 * - 68: Violet
 * - 69: White
 * - 0: Reset to default
 *
 * @module content/generators/programmatic/ascii-art-generator
 */

import { ProgrammaticGenerator } from '../programmatic-generator.js';
import type {
  GenerationContext,
  GeneratedContent,
  GeneratorValidationResult,
} from '../../../types/content-generator.js';

/**
 * Generates ASCII art from configured patterns.
 *
 * Randomly selects from available art patterns on each generation.
 * Supports Vestaboard color codes for colored ASCII art.
 *
 * @extends ProgrammaticGenerator
 *
 * @example
 * ```typescript
 * const patterns = [
 *   'HELLO\nWORLD',
 *   '{63}ALERT{0}\nSYSTEM',
 *   '  *\n ***\n*****'
 * ];
 *
 * const generator = new ASCIIArtGenerator(patterns);
 *
 * const content = await generator.generate({
 *   updateType: 'major',
 *   timestamp: new Date()
 * });
 * // content.text: one of the patterns, randomly selected
 * ```
 */
export class ASCIIArtGenerator extends ProgrammaticGenerator {
  /**
   * Available ASCII art patterns for selection.
   */
  private readonly patterns: string[];

  /**
   * Create ASCIIArtGenerator with art patterns.
   *
   * @param {string[]} patterns - Array of ASCII art patterns
   *
   * @example
   * ```typescript
   * const generator = new ASCIIArtGenerator([
   *   'Simple text',
   *   '{63}Colored text{0}',
   *   'Multi-line\nASCII\nArt'
   * ]);
   * ```
   */
  constructor(patterns: string[]) {
    super();
    this.patterns = patterns;
  }

  /**
   * Validate that patterns array is not empty.
   *
   * @returns {Promise<GeneratorValidationResult>} Validation result
   *
   * @example
   * ```typescript
   * const validGen = new ASCIIArtGenerator(['Pattern 1']);
   * await validGen.validate(); // { valid: true }
   *
   * const invalidGen = new ASCIIArtGenerator([]);
   * await invalidGen.validate(); // { valid: false, errors: [...] }
   * ```
   */
  async validate(): Promise<GeneratorValidationResult> {
    if (this.patterns.length === 0) {
      return {
        valid: false,
        errors: ['No art patterns configured'],
      };
    }

    return { valid: true };
  }

  /**
   * Generate ASCII art by randomly selecting from patterns.
   *
   * @param {GenerationContext} _context - Generation context (unused, but required by interface)
   * @returns {Promise<GeneratedContent>} Generated ASCII art content
   *
   * @example
   * ```typescript
   * const generator = new ASCIIArtGenerator([
   *   'ART 1',
   *   '{64}ART 2{0}',
   *   'ART 3'
   * ]);
   *
   * const result = await generator.generate({
   *   updateType: 'major',
   *   timestamp: new Date()
   * });
   * // result.text: randomly selected pattern
   * // result.outputMode: 'text'
   * ```
   */
  async generate(_context: GenerationContext): Promise<GeneratedContent> {
    // Randomly select a pattern
    const randomIndex = Math.floor(Math.random() * this.patterns.length);
    const selectedPattern = this.patterns[randomIndex];

    return {
      text: selectedPattern,
      outputMode: 'text',
    };
  }
}
