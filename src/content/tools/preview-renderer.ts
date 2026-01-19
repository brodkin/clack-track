/**
 * Preview Renderer for Vestaboard Content Validation
 *
 * Renders content as it will appear on Vestaboard for inclusion in tool
 * rejection messages. Helps LLMs understand why their content was rejected
 * by showing exactly how it would render.
 *
 * Display constraints:
 * - Full display: 6 rows x 22 columns
 * - Content area (framed): 5 rows x 21 columns
 */

import { VESTABOARD } from '../../config/constants.js';
import { wrapText } from '../../api/vestaboard/character-converter.js';

/**
 * Render mode for the preview
 * - 'content': Content area only (5x21), used when frame decoration is applied
 * - 'full': Full display (6x22), used for unframed/layout content
 */
export type RenderMode = 'content' | 'full';

/**
 * Status of a rendered line
 * - 'ok': Line is within character limit
 * - 'overflow': Line exceeds character limit
 */
export type LineStatus = 'ok' | 'overflow';

/**
 * Represents a single rendered line with validation metadata
 */
export interface RenderedLine {
  /** Line number (1-indexed) */
  lineNumber: number;
  /** Original text content */
  text: string;
  /** Character count */
  length: number;
  /** Validation status */
  status: LineStatus;
  /** Characters over the limit (only present if status is 'overflow') */
  overflowBy?: number;
  /** Preview of how the line would wrap at word boundaries (only if overflow) */
  wrapPreview?: string[];
}

/**
 * Configuration options for PreviewRenderer
 */
export interface PreviewRendererOptions {
  /** Render mode: 'content' (5x21) or 'full' (6x22). Default: 'content' */
  mode?: RenderMode;
}

/**
 * Result of rendering content for preview
 */
export interface PreviewResult {
  /** Rendered lines with metadata */
  lines: RenderedLine[];
  /** Render mode used */
  mode: RenderMode;
  /** Maximum columns for this mode */
  maxCols: number;
  /** Maximum rows for this mode */
  maxRows: number;
  /** Whether any validation errors were found */
  hasErrors: boolean;
  /** Whether row count exceeds limit */
  rowOverflow: boolean;
  /** Convert result to ASCII art string for LLM consumption */
  toAsciiArt: () => string;
}

/**
 * PreviewRenderer renders Vestaboard content for validation preview.
 *
 * Creates ASCII art representations showing:
 * - Content grid (5x21 or 6x22)
 * - Lines that exceed limits with indicators
 * - Where word-wrap would break lines
 *
 * Designed for inclusion in tool rejection messages so LLMs understand
 * why their content was rejected.
 *
 * @example
 * ```typescript
 * const renderer = new PreviewRenderer();
 * const result = renderer.render('FORTUNE FAVORS THE BOLD');
 * console.log(result.toAsciiArt());
 * // Output:
 * // Preview (5x21 content area):
 * // FORTUNE FAVORS THE BOLD  |ERR 23 chars (+2)
 * //   would wrap to:
 * //   - FORTUNE FAVORS THE
 * //   - BOLD
 * ```
 */
export class PreviewRenderer {
  private readonly mode: RenderMode;
  private readonly maxCols: number;
  private readonly maxRows: number;

  /**
   * Create a new PreviewRenderer
   *
   * @param options - Configuration options
   */
  constructor(options?: PreviewRendererOptions) {
    this.mode = options?.mode ?? 'content';
    this.maxCols = this.mode === 'content' ? VESTABOARD.FRAMED_MAX_COLS : VESTABOARD.MAX_COLS;
    this.maxRows = this.mode === 'content' ? VESTABOARD.FRAMED_MAX_ROWS : VESTABOARD.MAX_ROWS;
  }

  /**
   * Render content for preview
   *
   * @param text - Content to render
   * @returns PreviewResult with lines, metadata, and ASCII art generator
   */
  render(text: string): PreviewResult {
    // Handle empty input
    if (text === '') {
      return this.createResult([], false, false);
    }

    // Remove trailing newline to avoid extra empty line
    const normalizedText = text.replace(/\n$/, '');

    // Split into lines
    const rawLines = normalizedText.split('\n');

    // Process each line
    const lines: RenderedLine[] = rawLines.map((lineText, index) =>
      this.processLine(lineText, index + 1)
    );

    // Check for errors
    const hasLineOverflow = lines.some(line => line.status === 'overflow');
    const rowOverflow = lines.length > this.maxRows;
    const hasErrors = hasLineOverflow || rowOverflow;

    return this.createResult(lines, hasErrors, rowOverflow);
  }

  /**
   * Process a single line and generate metadata
   */
  private processLine(text: string, lineNumber: number): RenderedLine {
    const length = text.length;
    const isOverflow = length > this.maxCols;

    const line: RenderedLine = {
      lineNumber,
      text,
      length,
      status: isOverflow ? 'overflow' : 'ok',
    };

    if (isOverflow) {
      line.overflowBy = length - this.maxCols;
      line.wrapPreview = wrapText(text, this.maxCols);
    }

    return line;
  }

  /**
   * Create the result object with toAsciiArt method bound
   */
  private createResult(
    lines: RenderedLine[],
    hasErrors: boolean,
    rowOverflow: boolean
  ): PreviewResult {
    const result: PreviewResult = {
      lines,
      mode: this.mode,
      maxCols: this.maxCols,
      maxRows: this.maxRows,
      hasErrors,
      rowOverflow,
      toAsciiArt: () => this.generateAsciiArt(result),
    };

    return result;
  }

  /**
   * Generate ASCII art representation of the preview result
   *
   * Format is designed for LLM consumption - plain ASCII, no emojis.
   */
  private generateAsciiArt(result: PreviewResult): string {
    const output: string[] = [];

    // Header with dimensions
    const modeLabel = result.mode === 'content' ? 'content area' : 'full display';
    output.push(`Preview (${result.maxRows}x${result.maxCols} ${modeLabel}):`);
    output.push('');

    // Process each line
    for (const line of result.lines) {
      const statusLabel = line.status === 'ok' ? 'ok' : 'ERR';
      const lengthInfo = `${line.length} chars`;
      const overflowInfo = line.overflowBy ? ` (+${line.overflowBy})` : '';

      // Format: "TEXT |STATUS chars (+overflow)"
      output.push(`${line.text} |${statusLabel} ${lengthInfo}${overflowInfo}`);

      // Show wrap preview for overflow lines
      if (line.status === 'overflow' && line.wrapPreview && line.wrapPreview.length > 1) {
        output.push('  would wrap to:');
        for (const wrappedLine of line.wrapPreview) {
          output.push(`  - ${wrappedLine}`);
        }
      }
    }

    // Row overflow summary
    if (result.rowOverflow) {
      output.push('');
      output.push(`ERROR: ${result.lines.length} rows exceeds ${result.maxRows} max rows`);
    }

    return output.join('\n');
  }

  /**
   * Convenience static method for generating error messages
   *
   * @param text - Content that failed validation
   * @param mode - Render mode ('content' or 'full')
   * @returns Formatted error message with preview
   */
  static renderForToolError(text: string, mode: RenderMode = 'content'): string {
    const renderer = new PreviewRenderer({ mode });
    const result = renderer.render(text);
    return result.toAsciiArt();
  }
}
