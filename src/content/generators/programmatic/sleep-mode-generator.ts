/**
 * Sleep Mode Generator - Composite generator for bedtime display
 *
 * Combines SleepArtGenerator (dark starfield pattern) with SleepGreetingGenerator
 * (AI-powered bedtime greeting) to create a full-screen sleep mode display.
 *
 * Features:
 * - Generates dark art pattern first as background
 * - Overlays AI-generated greeting text in center rows (rows 2-4)
 * - Text displays in Vestaboard's amber color, visible on dark background
 * - Preserves art pattern in non-text areas
 * - Full screen mode (no frame decoration)
 * - outputMode=layout with final combined characterCodes
 *
 * @module content/generators/programmatic/sleep-mode-generator
 */

import { ProgrammaticGenerator } from '../programmatic-generator.js';
import { SleepArtGenerator } from './sleep-art-generator.js';
import { SleepGreetingGenerator } from '../ai/sleep-greeting-generator.js';
import { PromptLoader } from '../../prompt-loader.js';
import { ModelTierSelector } from '../../../api/ai/model-tier-selector.js';
import type { AIProviderAPIKeys } from '../ai-prompt-generator.js';
import type {
  GeneratedContent,
  GenerationContext,
  GeneratorValidationResult,
} from '@/types/content-generator.js';

/** Vestaboard display constants */
const ROWS = 6;
const COLS = 22;

/** Black color code for solid black tiles on white Vestaboards */
const BLACK = 70;

/**
 * Character code mapping for uppercase letters A-Z and common characters.
 * Only includes characters supported by Vestaboard.
 */
const CHAR_TO_CODE: Record<string, number> = {
  ' ': 70, // Black tile for spaces (not used in overlay - spaces preserve art)
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
};

/**
 * Sleep Mode Generator implementation.
 *
 * A composite generator that combines the dark starfield art pattern from
 * SleepArtGenerator with AI-generated bedtime greeting text from
 * SleepGreetingGenerator. The resulting display shows soothing text
 * overlaid on a dreamy night sky background.
 *
 * @extends ProgrammaticGenerator
 *
 * @example
 * ```typescript
 * const generator = new SleepModeGenerator(
 *   promptLoader,
 *   modelTierSelector,
 *   { openai: 'sk-...' }
 * );
 *
 * const context: GenerationContext = {
 *   updateType: 'major',
 *   timestamp: new Date()
 * };
 *
 * const content = await generator.generate(context);
 * // Returns layout with combined art + text characterCodes
 * // content.outputMode === 'layout'
 * // content.layout.characterCodes === 6x22 array with art background and white text
 * ```
 */
export class SleepModeGenerator extends ProgrammaticGenerator {
  private readonly artGenerator: SleepArtGenerator;
  private readonly greetingGenerator: SleepGreetingGenerator;

  /**
   * Creates a new SleepModeGenerator instance.
   *
   * @param promptLoader - Loader for system and user prompt files
   * @param modelTierSelector - Selector for tier-based model selection with fallback
   * @param apiKeys - Optional record of provider names to API keys
   */
  constructor(
    promptLoader: PromptLoader,
    modelTierSelector: ModelTierSelector,
    apiKeys: AIProviderAPIKeys = {}
  ) {
    super();
    this.artGenerator = new SleepArtGenerator();
    this.greetingGenerator = new SleepGreetingGenerator(promptLoader, modelTierSelector, apiKeys);
  }

  /**
   * Generate combined sleep mode content.
   *
   * Workflow:
   * 1. Generate dark art pattern from SleepArtGenerator
   * 2. Generate bedtime greeting text from SleepGreetingGenerator
   * 3. Convert greeting text to white character codes
   * 4. Overlay text centered on art pattern (rows 2-4)
   * 5. Return combined layout with aggregated metadata
   *
   * @param context - Generation context with timestamp and optional event data
   * @returns Generated content with combined art + text layout
   */
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Step 1: Generate art pattern (background)
    const artContent = await this.artGenerator.generate(context);

    // Step 2: Generate greeting text
    const greetingContent = await this.greetingGenerator.generate(context);

    // Step 3: Start with art pattern as base
    const characterCodes = this.deepCopyLayout(
      artContent.layout?.characterCodes || this.createEmptyLayout()
    );

    // Step 4: Overlay greeting text on art
    if (greetingContent.text) {
      this.overlayText(characterCodes, greetingContent.text);
    }

    // Step 5: Build aggregated metadata
    const metadata = {
      generator: 'sleep-mode-generator',
      artGenerator: artContent.metadata,
      greetingGenerator: greetingContent.metadata,
      selectedTheme: greetingContent.metadata?.selectedTheme,
    };

    return {
      text: '',
      outputMode: 'layout',
      layout: {
        rows: [],
        characterCodes,
      },
      metadata,
    };
  }

  /**
   * Validate the generator and its dependencies.
   *
   * Delegates validation to both underlying generators and aggregates
   * any errors.
   *
   * @returns Validation result with aggregated errors
   */
  async validate(): Promise<GeneratorValidationResult> {
    const artResult = await this.artGenerator.validate();
    const greetingResult = await this.greetingGenerator.validate();

    const errors: string[] = [];

    if (!artResult.valid && artResult.errors) {
      errors.push(...artResult.errors);
    }

    if (!greetingResult.valid && greetingResult.errors) {
      errors.push(...greetingResult.errors);
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * Creates a deep copy of a character codes layout.
   *
   * @param layout - Original 6x22 layout to copy
   * @returns Deep copy of the layout
   */
  private deepCopyLayout(layout: number[][]): number[][] {
    return layout.map(row => [...row]);
  }

  /**
   * Creates an empty 6x22 layout filled with black (0).
   *
   * @returns Empty character codes layout
   */
  private createEmptyLayout(): number[][] {
    return Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(BLACK));
  }

  /**
   * Overlays text onto the character codes layout.
   *
   * Text is:
   * - Converted to uppercase
   * - Split by newlines into rows
   * - Centered vertically (starting at appropriate row)
   * - Centered horizontally on each row
   * - Converted to white character codes for visibility
   *
   * Spaces in text preserve the underlying art pattern (transparent).
   *
   * @param layout - Character codes layout to modify in place
   * @param text - Text to overlay (may contain newlines)
   */
  private overlayText(layout: number[][], text: string): void {
    // Convert to uppercase and split into lines
    const upperText = text.toUpperCase();
    const lines = upperText.split('\n').filter(line => line.length > 0);

    if (lines.length === 0) {
      return;
    }

    // Calculate vertical centering
    const verticalPadding = Math.floor((ROWS - lines.length) / 2);

    // Overlay each line
    lines.forEach((line, lineIndex) => {
      const rowIndex = verticalPadding + lineIndex;
      if (rowIndex >= ROWS) {
        return; // Skip lines that would overflow
      }

      this.overlayLine(layout[rowIndex], line);
    });
  }

  /**
   * Overlays a single line of text onto a row.
   *
   * @param row - Row array to modify in place
   * @param line - Text line to overlay (already uppercase)
   */
  private overlayLine(row: number[], line: string): void {
    // Calculate horizontal centering
    const leftPadding = Math.floor((COLS - line.length) / 2);

    // Overlay each character
    for (let i = 0; i < line.length && leftPadding + i < COLS; i++) {
      const char = line[i];
      const colIndex = leftPadding + i;

      if (colIndex < 0) {
        continue;
      }

      // Spaces are transparent (preserve art)
      if (char === ' ') {
        continue;
      }

      // Convert character to white code
      row[colIndex] = this.charToWhiteCode(char);
    }
  }

  /**
   * Converts a character to its Vestaboard character code.
   *
   * Vestaboard displays letters in amber on the dark art background.
   * Returns the actual character code (1-26 for A-Z, etc.) so text is visible.
   *
   * Note: Vestaboard doesn't support colored text - codes 63-69 are solid
   * color tiles, not colored letters. Letters always display in amber.
   *
   * @param char - Single character to convert
   * @returns Character code for valid characters, BLACK (0) for unsupported
   */
  private charToWhiteCode(char: string): number {
    // Check if character is supported
    const code = CHAR_TO_CODE[char];
    if (code === undefined) {
      return BLACK; // Unsupported characters become blank
    }

    // Return actual character code (letters display in amber)
    return code;
  }
}
