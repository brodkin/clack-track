import { VestaboardContent, VestaboardLayout } from '../../types/content.js';
import { textToLayout as defaultTextToLayout } from '../../api/vestaboard/character-converter.js';
import type { CharacterConverter } from '../../api/vestaboard/types.js';

/**
 * Formats VestaboardContent into a VestaboardLayout with text rows and character codes
 *
 * This formatter:
 * 1. Wraps text at word boundaries to fit 22-character rows
 * 2. Centers text horizontally and vertically
 * 3. Converts text to Vestaboard character codes
 */
export class TextLayoutFormatter {
  private readonly MAX_ROWS = 6;
  private readonly MAX_COLS = 22;
  private readonly converter: CharacterConverter;

  /**
   * Creates a new TextLayoutFormatter
   *
   * @param converter - Optional character converter (defaults to production converter)
   */
  constructor(converter?: CharacterConverter) {
    this.converter = converter ?? { textToLayout: defaultTextToLayout };
  }

  /**
   * Formats content into a Vestaboard layout
   *
   * @param content - The content to format
   * @returns VestaboardLayout with rows and characterCodes
   */
  format(content: VestaboardContent): VestaboardLayout {
    const text = content.text || '';
    const upperText = text.toUpperCase();

    // Split by explicit newlines first
    const explicitLines = upperText.split('\n');

    // Wrap each line to fit within column width
    const allLines: string[] = [];
    for (const line of explicitLines) {
      const wrappedLines = this.wrapText(line, this.MAX_COLS);
      allLines.push(...wrappedLines);
    }

    // Truncate to max rows
    const linesToUse = allLines.slice(0, this.MAX_ROWS);

    // Calculate vertical padding for centering
    const verticalPadding = Math.floor((this.MAX_ROWS - linesToUse.length) / 2);

    // Build the rows array with centered text
    const rows: string[] = [];
    for (let i = 0; i < this.MAX_ROWS; i++) {
      const lineIndex = i - verticalPadding;
      if (lineIndex >= 0 && lineIndex < linesToUse.length) {
        // Center horizontally and pad to full width
        const centeredLine = this.centerText(linesToUse[lineIndex], this.MAX_COLS);
        rows.push(centeredLine);
      } else {
        // Empty row
        rows.push(' '.repeat(this.MAX_COLS));
      }
    }

    // Generate character codes using the converter
    const characterCodes = this.converter.textToLayout(rows.join('\n'));

    return {
      rows,
      characterCodes,
    };
  }

  /**
   * Wraps text at word boundaries to fit within the specified width
   *
   * @param text - Text to wrap
   * @param maxWidth - Maximum width of each line
   * @returns Array of wrapped lines
   */
  private wrapText(text: string, maxWidth: number): string[] {
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
   *
   * @param text - Text to center
   * @param width - Total width
   * @returns Centered text padded to full width
   */
  private centerText(text: string, width: number): string {
    if (text.length >= width) {
      return text.substring(0, width);
    }

    const padding = width - text.length;
    const leftPadding = Math.floor(padding / 2);
    const rightPadding = padding - leftPadding;

    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
  }
}
