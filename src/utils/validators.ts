import type { GeneratedContent, VestaboardLayout } from '../types/index.js';
import { ContentValidationError } from '../types/errors.js';
import { VESTABOARD } from '../config/constants.js';
import { wrapText, COLOR_EMOJI_MAP } from '../api/vestaboard/character-converter.js';

/**
 * Character normalization map for converting typographic variants to ASCII equivalents.
 * AI providers often generate "smart" quotes and other typographic characters that
 * Vestaboard doesn't support. This map enables silent conversion to supported characters.
 */
const TEXT_NORMALIZATIONS: Record<string, string> = {
  // Quotes
  '\u201C': '"', // left double quote "
  '\u201D': '"', // right double quote "
  '\u201E': '"', // low double quote „
  '\u2018': "'", // left single quote '
  '\u2019': "'", // right single quote '
  '\u201A': "'", // low single quote ‚
  // Dashes
  '\u2014': '-', // em-dash —
  '\u2013': '-', // en-dash –
  // Ellipsis
  '\u2026': '...', // ellipsis …
  // Accented vowels → ASCII equivalents
  À: 'A',
  Á: 'A',
  Â: 'A',
  Ã: 'A',
  Ä: 'A',
  Å: 'A',
  È: 'E',
  É: 'E',
  Ê: 'E',
  Ë: 'E',
  Ì: 'I',
  Í: 'I',
  Î: 'I',
  Ï: 'I',
  Ò: 'O',
  Ó: 'O',
  Ô: 'O',
  Õ: 'O',
  Ö: 'O',
  Ù: 'U',
  Ú: 'U',
  Û: 'U',
  Ü: 'U',
  Ý: 'Y',
  Ñ: 'N',
  Ç: 'C',
  // Lowercase accented (will be uppercased later but normalize anyway)
  à: 'A',
  á: 'A',
  â: 'A',
  ã: 'A',
  ä: 'A',
  å: 'A',
  è: 'E',
  é: 'E',
  ê: 'E',
  ë: 'E',
  ì: 'I',
  í: 'I',
  î: 'I',
  ï: 'I',
  ò: 'O',
  ó: 'O',
  ô: 'O',
  õ: 'O',
  ö: 'O',
  ù: 'U',
  ú: 'U',
  û: 'U',
  ü: 'U',
  ý: 'Y',
  ñ: 'N',
  ç: 'C',
};

/**
 * Set of supported color emojis from COLOR_EMOJI_MAP.
 * Used for O(1) lookup during validation to distinguish color emojis
 * from standard characters and unsupported emojis.
 */
export const SUPPORTED_COLOR_EMOJIS = new Set(Object.keys(COLOR_EMOJI_MAP));

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
  /** Number of lines in the content (after wrapping if applied) */
  lineCount: number;
  /** Maximum line length found (after wrapping if applied) */
  maxLineLength: number;
  /** Array of invalid characters found */
  invalidChars: string[];
  /** Array of validation error messages */
  errors: string[];
  /** Whether pre-validation wrapping was applied to salvage long lines */
  wrappingApplied?: boolean;
  /** Original max line length before wrapping (if wrapping was applied) */
  originalMaxLength?: number;
  /** The normalized and wrapped text (for use by caller) */
  normalizedText?: string;
  /** Whether unsupported emojis were stripped from the content */
  emojisStripped?: boolean;
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
 * If any lines exceed 21 characters, pre-validation wrapping is applied
 * to salvage content that slightly exceeds limits. However, if wrapping
 * causes the line count to exceed 5, validation fails.
 *
 * @param text - Plain text content to validate
 * @returns {ValidationResult} validation details
 */
export function validateTextContent(text: string): ValidationResult {
  const errors: string[] = [];

  // Check for empty content
  if (text.length === 0) {
    errors.push('text content cannot be empty');
    return {
      valid: false,
      lineCount: 0,
      maxLineLength: 0,
      invalidChars: [],
      errors,
    };
  }

  // Normalize typographic characters (curly quotes, em-dashes, etc.) to ASCII equivalents
  const normalizedText = normalizeText(text);

  // Strip unsupported emojis (preserve color emojis that can be converted to Vestaboard color codes)
  const { text: strippedText, emojisStripped } = stripUnsupportedEmojis(normalizedText);

  // Split into lines (trim trailing newline if present)
  const originalLines = strippedText.replace(/\n$/, '').split('\n');
  const originalMaxLength = Math.max(...originalLines.map(line => line.length), 0);

  // Check if any lines exceed the character limit
  const hasLongLines = originalLines.some(line => line.length > VESTABOARD.FRAMED_MAX_COLS);
  let wrappingApplied = false;
  let lines: string[];

  if (hasLongLines) {
    // Apply pre-validation wrapping to salvage content
    wrappingApplied = true;
    lines = [];
    for (const line of originalLines) {
      if (line.length > VESTABOARD.FRAMED_MAX_COLS) {
        // Wrap long lines using word-boundary wrapping
        const wrappedLines = wrapText(line, VESTABOARD.FRAMED_MAX_COLS);
        lines.push(...wrappedLines);
      } else {
        lines.push(line);
      }
    }
  } else {
    lines = originalLines;
  }

  const lineCount = lines.length;
  const maxLineLength = Math.max(...lines.map(line => line.length), 0);

  // Validate line count (framed mode: max 5 lines)
  // CRITICAL: If wrapping caused line count to exceed 5, fail validation
  if (lineCount > VESTABOARD.FRAMED_MAX_ROWS) {
    if (wrappingApplied) {
      errors.push(
        `content exceeds ${VESTABOARD.FRAMED_MAX_ROWS} lines after wrapping (found: ${lineCount})`
      );
    } else {
      errors.push(
        `text mode content must have at most ${VESTABOARD.FRAMED_MAX_ROWS} lines (found: ${lineCount})`
      );
    }
  }

  // After wrapping, all lines should be within limit
  // This check handles edge cases where wrapText truncates single long words
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
    wrappingApplied,
    originalMaxLength: wrappingApplied ? originalMaxLength : undefined,
    normalizedText: lines.join('\n'),
    emojisStripped,
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

  // Check if we have characterCodes (numeric array) - used by pattern generators
  if (layout.characterCodes && layout.characterCodes.length > 0) {
    const rowCount = layout.characterCodes.length;
    const maxRowLength = Math.max(...layout.characterCodes.map(row => row.length), 0);

    // Validate row count (must be exactly 6)
    if (rowCount !== VESTABOARD.MAX_ROWS) {
      errors.push(`layout must have exactly ${VESTABOARD.MAX_ROWS} rows (found: ${rowCount})`);
    }

    // Validate column count (must be exactly 22)
    const invalidRows = layout.characterCodes
      .map((row, idx) => ({ idx, length: row.length }))
      .filter(info => info.length !== VESTABOARD.MAX_COLS);

    if (invalidRows.length > 0) {
      const first = invalidRows[0];
      errors.push(
        `layout row ${first.idx} must have exactly ${VESTABOARD.MAX_COLS} columns (found: ${first.length})`
      );
    }

    // Validate character codes (must be 0-71)
    // Vestaboard codes: 0=blank, 1-26=A-Z, 27-36=0-9, 37-62=symbols, 63-69=colors,
    // 70=black (explicit black tile for white boards), 71=filled (adaptive)
    for (let row = 0; row < layout.characterCodes.length; row++) {
      for (let col = 0; col < layout.characterCodes[row].length; col++) {
        const code = layout.characterCodes[row][col];
        if (code < 0 || code > 71) {
          errors.push(`Invalid character code ${code} at row ${row}, col ${col} (must be 0-71)`);
          break; // Only report first invalid code
        }
      }
      if (errors.length > 0) break;
    }

    return {
      valid: errors.length === 0,
      lineCount: rowCount,
      maxLineLength: maxRowLength,
      invalidChars: [],
      errors,
    };
  }

  // Fall back to text-based rows validation
  // Normalize typographic characters (curly quotes, em-dashes, etc.) to ASCII equivalents
  const normalizedRows = layout.rows.map(row => normalizeText(row));

  // Strip unsupported emojis from each row (preserve color emojis)
  let emojisStripped = false;
  const strippedRows = normalizedRows.map(row => {
    const result = stripUnsupportedEmojis(row);
    if (result.emojisStripped) emojisStripped = true;
    return result.text;
  });

  // Uppercase before validation since text gets uppercased later in the pipeline
  const allText = strippedRows.join('').toUpperCase();
  const invalidChars = findInvalidCharacters(allText);

  const rowCount = strippedRows.length;
  const maxRowLength = Math.max(...strippedRows.map(row => row.length), 0);

  // Validate row count (must be exactly 6)
  if (rowCount !== VESTABOARD.MAX_ROWS) {
    errors.push(`layout must have exactly ${VESTABOARD.MAX_ROWS} rows (found: ${rowCount})`);
  }

  // Validate row lengths (max 22 chars per row) - check stripped rows
  const tooLongRows = strippedRows
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
    emojisStripped,
  };
}

/**
 * Legacy symbols that match Extended_Pictographic but should NOT be stripped.
 * These are handled by normal character validation (findInvalidCharacters).
 * Extended_Pictographic is overly broad and includes these legacy symbols.
 */
const LEGACY_SYMBOLS_NOT_EMOJIS = new Set([
  '™', // U+2122 - Trade Mark Sign
  '®', // U+00AE - Registered Sign
  '©', // U+00A9 - Copyright Sign
  '℗', // U+2117 - Sound Recording Copyright
  '℠', // U+2120 - Service Mark
]);

/**
 * Strip unsupported emojis from text while preserving color emojis.
 *
 * AI providers sometimes generate emojis (e.g., 🎯) that cannot be displayed
 * on Vestaboard. This function removes unsupported emojis while preserving:
 * - Color emojis (🔴, 🟢, etc.) that can be converted to Vestaboard color codes
 * - Legacy symbols (™, ®, ©) that should be handled by character validation
 * - All other non-emoji characters (even if invalid - other validation handles those)
 *
 * Uses Array.from() for proper grapheme cluster iteration, then handles
 * variant selectors (U+FE0F) by peeking ahead and combining when needed.
 *
 * @param text - Text to strip unsupported emojis from
 * @returns Object with sanitized text and whether any emojis were stripped
 */
export function stripUnsupportedEmojis(text: string): { text: string; emojisStripped: boolean } {
  const chars = Array.from(text);
  const result: string[] = [];
  let emojisStripped = false;

  // Regex to detect emoji characters using Unicode Extended_Pictographic property
  const emojiRegex = /\p{Extended_Pictographic}/u;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    // Preserve legacy symbols that match Extended_Pictographic but aren't emojis
    if (LEGACY_SYMBOLS_NOT_EMOJIS.has(char)) {
      result.push(char);
      continue;
    }

    // Check if next character is a variant selector (U+FE0F)
    // If so, combine them for emoji lookup
    if (i + 1 < chars.length && chars[i + 1] === '\uFE0F') {
      const withVariant = char + '\uFE0F';
      // Check if the combined emoji is a supported color emoji
      if (SUPPORTED_COLOR_EMOJIS.has(withVariant)) {
        result.push(withVariant);
        i++; // Skip the variant selector on next iteration
        continue;
      }
      // If it's an unsupported emoji with variant selector, skip both
      if (emojiRegex.test(char)) {
        emojisStripped = true;
        i++; // Skip the variant selector
        continue;
      }
    }

    // Check if it's a supported color emoji (without variant selector)
    if (SUPPORTED_COLOR_EMOJIS.has(char)) {
      result.push(char);
      continue;
    }

    // Check if character is an emoji (unsupported)
    if (emojiRegex.test(char)) {
      emojisStripped = true;
      continue; // Skip unsupported emoji
    }

    // Keep all non-emoji characters (even if invalid - other validation handles those)
    result.push(char);
  }

  return { text: result.join(''), emojisStripped };
}

/**
 * Find invalid Vestaboard characters in text.
 *
 * Vestaboard supports: A-Z, 0-9, space, limited punctuation, and color emojis.
 * Returns array of unique invalid characters found.
 *
 * Uses Array.from() for proper grapheme cluster iteration, then handles
 * variant selectors (U+FE0F) by peeking ahead and combining when needed.
 *
 * @param text - Text to check for invalid characters
 * @returns {string[]} array of unique invalid characters
 */
export function findInvalidCharacters(text: string): string[] {
  const supportedSet = new Set(VESTABOARD.SUPPORTED_CHARS.split(''));
  const invalidSet = new Set<string>();

  // Use Array.from to properly iterate over grapheme clusters (handles emoji surrogate pairs)
  const chars = Array.from(text);

  for (let i = 0; i < chars.length; i++) {
    let char = chars[i];

    // Check if next character is a variant selector (U+FE0F)
    // If so, combine them for emoji lookup
    if (i + 1 < chars.length && chars[i + 1] === '\uFE0F') {
      const withVariant = char + '\uFE0F';
      // Check if the combined emoji is a color emoji
      if (SUPPORTED_COLOR_EMOJIS.has(withVariant)) {
        i++; // Skip the variant selector on next iteration
        continue;
      }
    }

    // Check if it's a color emoji (without variant selector)
    if (SUPPORTED_COLOR_EMOJIS.has(char)) {
      continue;
    }

    // Check if it's a standard supported character
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
