import { VestaboardContent, VestaboardLayout } from '../../types/content.js';
import { textToLayout as defaultTextToLayout } from '../../api/vestaboard/character-converter.js';
import type { CharacterConverter } from '../../api/vestaboard/types.js';

/**
 * Text alignment options for horizontal positioning
 */
export type TextAlignment = 'left' | 'center' | 'right';

/**
 * Options for formatting content
 */
export interface FormatOptions {
  /** Horizontal text alignment (default: 'center') */
  alignment?: TextAlignment;
}

/**
 * Formats VestaboardContent into a VestaboardLayout with text rows and character codes
 *
 * This formatter:
 * 1. Wraps text at word boundaries to fit 22-character rows
 * 2. Aligns text horizontally (left, center, or right) and centers vertically
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
   * @param options - Optional formatting options (alignment defaults to 'center')
   * @returns VestaboardLayout with rows and characterCodes
   */
  format(content: VestaboardContent, options?: FormatOptions): VestaboardLayout {
    const text = content.text || '';
    const upperText = text.toUpperCase();
    const alignment = options?.alignment ?? 'center';

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

    // Build the rows array with aligned text
    const rows: string[] = [];
    for (let i = 0; i < this.MAX_ROWS; i++) {
      const lineIndex = i - verticalPadding;
      if (lineIndex >= 0 && lineIndex < linesToUse.length) {
        // Align horizontally and pad to full width
        const alignedLine = this.alignText(linesToUse[lineIndex], this.MAX_COLS, alignment);
        rows.push(alignedLine);
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
   * Aligns text within a given width using the specified alignment
   *
   * @param text - Text to align
   * @param width - Total width
   * @param alignment - Alignment mode ('left', 'center', or 'right')
   * @returns Aligned text padded to full width
   */
  private alignText(text: string, width: number, alignment: TextAlignment): string {
    if (text.length >= width) {
      return text.substring(0, width);
    }

    const padding = width - text.length;

    switch (alignment) {
      case 'left':
        // No left padding, all padding on right
        return text + ' '.repeat(padding);
      case 'right':
        // All padding on left, text at end
        return ' '.repeat(padding) + text;
      case 'center':
      default: {
        // Split padding between left and right
        const leftPadding = Math.floor(padding / 2);
        const rightPadding = padding - leftPadding;
        return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
      }
    }
  }
}
