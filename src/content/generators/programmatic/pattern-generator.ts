/**
 * Pattern Generator - Programmatic visual patterns for Vestaboard display
 *
 * Creates colorful visual patterns using the pattern library functions.
 * Randomly selects from 10 different pattern types for variety.
 *
 * @module content/generators/programmatic/pattern-generator
 */

import { ProgrammaticGenerator } from '../programmatic-generator.js';
import type { GeneratedContent, GenerationContext } from '@/types/content-generator.js';
import * as patterns from './patterns/index.js';

/**
 * Pattern Generator implementation.
 *
 * Generates visual patterns for Vestaboard display using mathematical
 * pattern functions from the pattern library. Each generation randomly
 * selects one of 10 available patterns to display.
 *
 * @extends ProgrammaticGenerator
 *
 * @example
 * ```typescript
 * const generator = new PatternGenerator();
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
export class PatternGenerator extends ProgrammaticGenerator {
  /**
   * Array of available pattern functions from the pattern library.
   * Used for random selection during generation.
   */
  private readonly patternFunctions = [
    patterns.horizontalGradient,
    patterns.verticalGradient,
    patterns.diagonalGradient,
    patterns.checkerboard,
    patterns.horizontalStripes,
    patterns.verticalStripes,
    patterns.diamond,
    patterns.border,
    patterns.wave,
    patterns.radialGradient,
  ];

  /**
   * Generate visual pattern content for Vestaboard display.
   *
   * Randomly selects one of 10 pattern functions and returns the generated
   * pattern data in layout mode with characterCodes array.
   *
   * @param {GenerationContext} context - Generation context (unused for patterns)
   * @returns {Promise<GeneratedContent>} Generated pattern with layout data
   *
   * @example
   * ```typescript
   * const generator = new PatternGenerator();
   * const content = await generator.generate({
   *   updateType: 'major',
   *   timestamp: new Date()
   * });
   *
   * console.log(content.outputMode); // 'layout'
   * console.log(content.layout?.characterCodes?.length); // 6 (rows)
   * console.log(content.layout?.characterCodes?.[0].length); // 22 (columns)
   * console.log(content.metadata?.patternType); // e.g., 'horizontalGradient'
   * ```
   */
  async generate(_context: GenerationContext): Promise<GeneratedContent> {
    // Randomly select a pattern function
    const randomIndex = Math.floor(Math.random() * this.patternFunctions.length);
    const selectedPattern = this.patternFunctions[randomIndex];

    // Generate the pattern data
    const patternData = selectedPattern();

    return {
      text: '',
      outputMode: 'layout',
      layout: {
        rows: [],
        characterCodes: patternData,
      },
      metadata: {
        patternType: selectedPattern.name,
        generator: 'pattern-generator',
      },
    };
  }
}
