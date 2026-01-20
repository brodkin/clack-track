/**
 * SubmitContent Tool Definition and Executor
 *
 * Provides the submit_content tool that LLMs call to submit their generated
 * content for Vestaboard display. The executor validates content against
 * display constraints and returns acceptance or rejection with actionable
 * feedback.
 *
 * Display Constraints (framed mode):
 * - 5 rows maximum (reserves 1 row for time/weather frame)
 * - 21 characters per line maximum
 * - Limited character set (uppercase A-Z, 0-9, common punctuation)
 *
 * @module content/tools/submit-content
 */

import type { ToolDefinition } from '../../types/ai.js';
import { validateTextContent, type ValidationResult } from '../../utils/validators.js';
import { PreviewRenderer } from './preview-renderer.js';
import { VESTABOARD } from '../../config/constants.js';

/**
 * Result returned by the submit_content tool executor.
 *
 * On success: { accepted: true, preview: [...] }
 * On failure: { accepted: false, preview: [...], errors: [...], hint: "..." }
 */
export interface SubmitContentResult {
  /** Whether the content was accepted */
  accepted: boolean;
  /** Preview showing how content renders on the display */
  preview: string[];
  /** Actionable error messages (only present on failure) */
  errors?: string[];
  /** Helpful hint for fixing the content (only present on failure) */
  hint?: string;
}

/**
 * Input parameters for the submit_content tool
 */
export interface SubmitContentParams {
  /** The content to submit for display */
  content: string;
}

/**
 * Tool definition for submit_content.
 *
 * Compatible with OpenAI's function calling and Anthropic's tool use APIs.
 * The content parameter accepts plain text with newlines for line breaks.
 */
export const submitContentToolDefinition: ToolDefinition = {
  name: 'submit_content',
  description:
    'Submit content for display on the Vestaboard. Content must fit within ' +
    'the framed display area (5 rows x 21 characters). Use newlines to ' +
    'separate lines. Content is automatically converted to uppercase.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description:
          'The text content to display. Maximum 5 rows with 21 characters per row. ' +
          'Use \\n for line breaks. Supported characters: A-Z, 0-9, space, and ' +
          'common punctuation (.,:;!?\'"-()+=/). Content is uppercased automatically.',
      },
    },
    required: ['content'],
  },
};

/**
 * Generate actionable error messages from validation result.
 *
 * Transforms generic validation errors into specific, actionable messages
 * that tell the LLM exactly what to fix.
 */
function generateActionableErrors(
  validationResult: ValidationResult,
  originalContent: string
): string[] {
  const errors: string[] = [];

  // Handle empty content
  if (originalContent.length === 0) {
    errors.push('Content cannot be empty. Please provide text to display.');
    return errors;
  }

  // Handle line count overflow
  if (validationResult.lineCount > VESTABOARD.FRAMED_MAX_ROWS) {
    const overBy = validationResult.lineCount - VESTABOARD.FRAMED_MAX_ROWS;
    if (validationResult.wrappingApplied) {
      errors.push(
        `Content has ${validationResult.lineCount} lines after word-wrapping (max ${VESTABOARD.FRAMED_MAX_ROWS}). ` +
          `Reduce by ${overBy} line${overBy > 1 ? 's' : ''} by shortening your text.`
      );
    } else {
      errors.push(
        `Content has ${validationResult.lineCount} lines (max ${VESTABOARD.FRAMED_MAX_ROWS}). ` +
          `Remove ${overBy} line${overBy > 1 ? 's' : ''}.`
      );
    }
  }

  // Handle invalid characters
  if (validationResult.invalidChars.length > 0) {
    const charList = validationResult.invalidChars.slice(0, 5).join(', ');
    const moreCount = validationResult.invalidChars.length - 5;
    const moreText = moreCount > 0 ? ` (and ${moreCount} more)` : '';
    errors.push(
      `Invalid characters found: ${charList}${moreText}. Use only A-Z, 0-9, space, and .,:;!?'"-()+=/`
    );
  }

  // Handle any other validation errors from the validator
  for (const error of validationResult.errors) {
    // Skip errors we've already transformed
    if (
      error.includes('empty') ||
      error.includes('lines') ||
      error.includes('invalid characters')
    ) {
      continue;
    }
    errors.push(error);
  }

  return errors;
}

/**
 * Generate a helpful hint based on the validation failures.
 *
 * Provides guidance on how to fix the content rather than just stating
 * what's wrong.
 */
function generateHint(validationResult: ValidationResult, originalContent: string): string {
  const hints: string[] = [];

  // Empty content hint
  if (originalContent.length === 0) {
    return 'Provide motivational, informational, or creative content for the display.';
  }

  // Line count overflow hint
  if (validationResult.lineCount > VESTABOARD.FRAMED_MAX_ROWS) {
    if (validationResult.wrappingApplied) {
      hints.push(
        'Your lines are too long and word-wrapping exceeded the row limit. ' +
          'Try using shorter phrases or fewer words per line.'
      );
    } else {
      hints.push(
        `The display can show ${VESTABOARD.FRAMED_MAX_ROWS} lines. ` +
          'Condense your message or split into multiple updates.'
      );
    }
  }

  // Invalid characters hint
  if (validationResult.invalidChars.length > 0) {
    hints.push(
      'The Vestaboard has a limited character set similar to airport departure boards. ' +
        'Stick to letters, numbers, and basic punctuation.'
    );
  }

  // Line length hint (if max length exceeded post-wrap)
  if (validationResult.maxLineLength > VESTABOARD.FRAMED_MAX_COLS) {
    hints.push(
      `Each line can have at most ${VESTABOARD.FRAMED_MAX_COLS} characters. ` +
        'Use shorter words or abbreviations.'
    );
  }

  // Combine hints or provide generic fallback
  if (hints.length === 0) {
    return 'Review the preview to see how your content would appear and adjust accordingly.';
  }

  return hints.join(' ');
}

/**
 * Execute the submit_content tool.
 *
 * Validates the provided content against Vestaboard display constraints
 * and returns a result indicating acceptance or rejection with preview
 * and actionable feedback.
 *
 * @param params - The tool parameters containing the content to validate
 * @returns Promise resolving to the validation result with preview
 *
 * @example
 * ```typescript
 * // Successful submission
 * const result = await executeSubmitContent({ content: 'HELLO WORLD' });
 * // { accepted: true, preview: [...] }
 *
 * // Failed submission
 * const result = await executeSubmitContent({ content: 'LINE1\nLINE2\nLINE3\nLINE4\nLINE5\nLINE6' });
 * // { accepted: false, preview: [...], errors: ['Content has 6 lines (max 5)...'], hint: '...' }
 * ```
 */
export async function executeSubmitContent(
  params: SubmitContentParams
): Promise<SubmitContentResult> {
  const { content } = params;

  // Validate content using the existing validator
  const validationResult = validateTextContent(content);

  // Generate preview using PreviewRenderer
  const renderer = new PreviewRenderer({ mode: 'content' });
  const previewResult = renderer.render(content);
  const preview = previewResult.toAsciiArt().split('\n');

  // Build result based on validation outcome
  if (validationResult.valid) {
    return {
      accepted: true,
      preview,
    };
  }

  // Generate actionable errors and hints for rejection
  const errors = generateActionableErrors(validationResult, content);
  const hint = generateHint(validationResult, content);

  return {
    accepted: false,
    preview,
    errors,
    hint,
  };
}
