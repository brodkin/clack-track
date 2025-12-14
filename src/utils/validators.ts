import type { GeneratedContent, VestaboardLayout } from '../types/index.js';
import { ContentValidationError } from '../types/errors.js';
import { VESTABOARD } from '../config/constants.js';

/**
 * Character normalization map for converting typographic variants to ASCII equivalents.
 * AI providers often generate "smart" quotes and other typographic characters that
 * Vestaboard doesn't support. This map enables silent conversion to supported characters.
 */
const TEXT_NORMALIZATIONS: Record<string, string> = {
  '\u201C': '"', // left double quote "
  '\u201D': '"', // right double quote "
  '\u201E': '"', // low double quote „
  '\u2018': "'", // left single quote '
  '\u2019': "'", // right single quote '
  '\u201A': "'", // low single quote ‚
  '\u2014': '-', // em-dash —
  '\u2013': '-', // en-dash –
  '\u2026': '...', // ellipsis …
};

/**
 * Normalize text by converting typographic characters to their ASCII equivalents.
 * This silently converts curly quotes, smart apostrophes, em-dashes, etc.
 * to characters supported by Vestaboard.
 *
 * @param text - Text to normalize
 * @returns Normalized text with typographic characters replaced
 */
export function normalizeText(text: string): string {
  let normalized = text;
  for (const [from, to] of Object.entries(TEXT_NORMALIZATIONS)) {
    normalized = normalized.replaceAll(from, to);
  }
  return normalized;
}

/**
 * Result of generator output validation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Number of lines in the content */
  lineCount: number;
  /** Maximum line length found */
  maxLineLength: number;
  /** Array of invalid characters found */
  invalidChars: string[];
  /** Array of validation error messages */
  errors: string[];
}

/**
 * Validate generator output against Vestaboard constraints.
 *
 * For 'text' mode: validates against framed limits (5 lines × 21 chars)
 * For 'layout' mode: validates against unframed limits (6 rows × 22 cols)
 *
 * @throws {ContentValidationError} if validation fails
 * @returns {ValidationResult} validation details
 */
export function validateGeneratorOutput(content: GeneratedContent): ValidationResult {
  if (content.outputMode === 'text') {
    const result = validateTextContent(content.text);
    if (!result.valid) {
      throw new ContentValidationError(result.errors[0], {
        invalidChars: result.invalidChars,
        lineCount: result.lineCount,
        maxLineLength: result.maxLineLength,
      });
    }
    return result;
  } else if (content.outputMode === 'layout') {
    if (!content.layout) {
      throw new ContentValidationError('layout mode requires layout data');
    }
    const result = validateLayoutContent(content.layout);
    if (!result.valid) {
      throw new ContentValidationError(result.errors[0], {
        invalidChars: result.invalidChars,
        lineCount: result.lineCount,
        maxLineLength: result.maxLineLength,
      });
    }
    return result;
  }

  throw new ContentValidationError(`Invalid outputMode: ${content.outputMode}`);
}

/**
 * Validate text content against framed Vestaboard constraints.
 *
 * Framed content allows maximum 5 lines × 21 characters per line
 * (reserves 1 row for time/weather frame).
 *
 * @param text - Plain text content to validate
 * @returns {ValidationResult} validation details
 */
export function validateTextContent(text: string): ValidationResult {
  const errors: string[] = [];

  // Check for empty content
  if (text.length === 0) {
    errors.push('text content cannot be empty');
  }

  // Normalize typographic characters (curly quotes, em-dashes, etc.) to ASCII equivalents
  const normalizedText = normalizeText(text);

  // Split into lines and count (trim trailing newline if present)
  const lines = normalizedText.replace(/\n$/, '').split('\n');
  const lineCount = lines.length;
  const maxLineLength = Math.max(...lines.map(line => line.length), 0);

  // Validate line count (framed mode: max 5 lines)
  if (lineCount > VESTABOARD.FRAMED_MAX_ROWS) {
    errors.push(
      `text mode content must have at most ${VESTABOARD.FRAMED_MAX_ROWS} lines (found: ${lineCount})`
    );
  }

  // Validate line length (framed mode: max 21 chars per line)
  const tooLongLines = lines
    .map((line, idx) => ({ idx, length: line.length }))
    .filter(info => info.length > VESTABOARD.FRAMED_MAX_COLS);

  if (tooLongLines.length > 0) {
    const first = tooLongLines[0];
    errors.push(
      `text mode line ${first.idx} exceeds ${VESTABOARD.FRAMED_MAX_COLS} characters (found: ${first.length})`
    );
  }

  // Validate character set (check each line, not the text with newlines)
  // Uppercase before validation since text gets uppercased later in the pipeline
  const invalidChars = findInvalidCharacters(lines.join('').toUpperCase());

  if (invalidChars.length > 0) {
    errors.push(`text contains invalid characters: ${invalidChars.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    lineCount,
    maxLineLength,
    invalidChars,
    errors,
  };
}

/**
 * Validate layout content against unframed Vestaboard constraints.
 *
 * Layout content must have exactly 6 rows × 22 characters per row.
 *
 * @param layout - VestaboardLayout to validate
 * @returns {ValidationResult} validation details
 */
export function validateLayoutContent(layout: VestaboardLayout): ValidationResult {
  const errors: string[] = [];

  // Normalize typographic characters (curly quotes, em-dashes, etc.) to ASCII equivalents
  const normalizedRows = layout.rows.map(row => normalizeText(row));

  // Uppercase before validation since text gets uppercased later in the pipeline
  const allText = normalizedRows.join('').toUpperCase();
  const invalidChars = findInvalidCharacters(allText);

  const rowCount = layout.rows.length;
  const maxRowLength = Math.max(...layout.rows.map(row => row.length), 0);

  // Validate row count (must be exactly 6)
  if (rowCount !== VESTABOARD.MAX_ROWS) {
    errors.push(`layout must have exactly ${VESTABOARD.MAX_ROWS} rows (found: ${rowCount})`);
  }

  // Validate row lengths (max 22 chars per row)
  const tooLongRows = layout.rows
    .map((row, idx) => ({ idx, length: row.length }))
    .filter(info => info.length > VESTABOARD.MAX_COLS);

  if (tooLongRows.length > 0) {
    const first = tooLongRows[0];
    errors.push(
      `layout row ${first.idx} exceeds ${VESTABOARD.MAX_COLS} characters (found: ${first.length})`
    );
  }

  // Validate character set
  if (invalidChars.length > 0) {
    errors.push(`layout contains invalid characters: ${invalidChars.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    lineCount: rowCount,
    maxLineLength: maxRowLength,
    invalidChars,
    errors,
  };
}

/**
 * Find invalid Vestaboard characters in text.
 *
 * Vestaboard supports: A-Z, 0-9, space, and limited punctuation.
 * Returns array of unique invalid characters found.
 *
 * @param text - Text to check for invalid characters
 * @returns {string[]} array of unique invalid characters
 */
export function findInvalidCharacters(text: string): string[] {
  const supportedSet = new Set(VESTABOARD.SUPPORTED_CHARS.split(''));
  const invalidSet = new Set<string>();

  for (const char of text) {
    if (!supportedSet.has(char)) {
      invalidSet.add(char);
    }
  }

  return Array.from(invalidSet);
}

export function validateVestaboardText(text: string): { valid: boolean; error?: string } {
  // Vestaboard has 6 rows x 22 columns = 132 character limit
  const MAX_LENGTH = 132;

  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' };
  }

  if (text.length > MAX_LENGTH) {
    return { valid: false, error: `Text exceeds maximum length of ${MAX_LENGTH} characters` };
  }

  // TODO: Add validation for supported characters
  // Vestaboard has a limited character set

  return { valid: true };
}

export function validateApiKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0;
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateVote(vote: string): vote is 'good' | 'bad' {
  return vote === 'good' || vote === 'bad';
}
