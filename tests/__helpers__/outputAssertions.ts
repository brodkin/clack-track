/**
 * CLI Output Validation Helpers
 *
 * Provides utilities for testing CLI command output by stripping ANSI codes,
 * normalizing whitespace, and extracting structured sections from console output.
 *
 * These helpers make CLI tests more robust by ignoring formatting differences
 * while still validating the actual content.
 */

/**
 * Strip ANSI escape codes and normalize whitespace for assertion comparison.
 *
 * Removes all ANSI color/formatting codes and collapses multiple whitespace
 * characters (spaces, newlines, tabs) into single spaces. Useful for comparing
 * CLI output where formatting may vary but content should match.
 *
 * @param output - Raw output string potentially containing ANSI codes
 * @returns Normalized string with ANSI codes removed and whitespace collapsed
 *
 * @example
 * ```typescript
 * const raw = '\x1b[32mSuccess\x1b[0m   \n  message';
 * const normalized = normalizeOutput(raw);
 * expect(normalized).toBe('Success message');
 * ```
 */
export function normalizeOutput(output: string): string {
  // Remove ANSI escape codes (color, bold, etc.)
  const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');

  // Collapse multiple whitespace into single space and trim
  return stripped.replace(/\s+/g, ' ').trim();
}

/**
 * Assert that output contains expected text (case-insensitive, ANSI-stripped).
 *
 * Convenience assertion that normalizes output and performs case-insensitive
 * substring matching. Useful for checking that CLI output includes expected
 * messages without worrying about exact formatting or capitalization.
 *
 * @param output - Raw output string to search within
 * @param expected - Text that should be present in the output
 * @throws AssertionError if expected text is not found
 *
 * @example
 * ```typescript
 * const output = '\x1b[32mSUCCESS:\x1b[0m Operation completed';
 * expectOutputContains(output, 'success'); // passes
 * expectOutputContains(output, 'operation completed'); // passes
 * expectOutputContains(output, 'failed'); // throws AssertionError
 * ```
 */
export function expectOutputContains(output: string, expected: string): void {
  const normalized = normalizeOutput(output);
  expect(normalized.toLowerCase()).toContain(expected.toLowerCase());
}

/**
 * Extract a named section from CLI output.
 *
 * Finds sections that start with a specific header (e.g., "P0:", "P2:", "Total:")
 * and extracts all content until the next section header is found. Returns null
 * if the section is not present.
 *
 * Section headers are identified by patterns like "P0:", "Total:", etc. at the
 * start of a line (after normalization).
 *
 * @param output - Raw CLI output containing multiple sections
 * @param sectionName - Section header to search for (e.g., "P0:", "Total:")
 * @returns Extracted section content or null if section not found
 *
 * @example
 * ```typescript
 * const output = `
 *   P0: NOTIFICATION (2 generators)
 *     - arrival-notification
 *   P2: NORMAL (5 generators)
 *     - motivational
 *   Total: 7 generators
 * `;
 *
 * const p0Section = extractSection(output, 'P0:');
 * expect(p0Section).toContain('arrival-notification');
 *
 * const missing = extractSection(output, 'P1:');
 * expect(missing).toBeNull();
 * ```
 */
export function extractSection(output: string, sectionName: string): string | null {
  // Strip ANSI codes but preserve newlines (don't use normalizeOutput which collapses newlines)
  const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');
  const lines = stripped.split('\n');

  // Find the line that starts with the section name
  const sectionStart = lines.findIndex((line) => line.trim().startsWith(sectionName));

  if (sectionStart === -1) {
    return null;
  }

  // Find the next section header (line starting with pattern like "P0:", "Total:")
  const sectionEnd = lines.findIndex(
    (line, i) => i > sectionStart && /^[A-Z][0-9]?:|^Total:/i.test(line.trim())
  );

  // Extract lines from section start to section end (or end of output)
  const sectionLines = lines.slice(
    sectionStart,
    sectionEnd === -1 ? undefined : sectionEnd
  );

  return sectionLines.join('\n');
}

/**
 * Capture console.log output during a function call.
 *
 * Temporarily replaces console.log to capture all output produced by a function,
 * then restores the original console.log. Useful for testing CLI commands that
 * write to stdout.
 *
 * The original console.log is always restored, even if the function throws an error.
 *
 * @param fn - Function to execute while capturing console.log output
 * @returns Object containing the function's return value and captured output lines
 *
 * @example
 * ```typescript
 * const { result, output } = await captureConsoleOutput(async () => {
 *   console.log('First message');
 *   console.log('Second message');
 *   return 42;
 * });
 *
 * expect(result).toBe(42);
 * expect(output).toEqual(['First message', 'Second message']);
 * ```
 */
export async function captureConsoleOutput<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; output: string[] }> {
  const output: string[] = [];
  const originalLog = console.log;

  // Replace console.log with a capturing version
  console.log = (...args: unknown[]) => {
    output.push(args.map(String).join(' '));
  };

  try {
    const result = await fn();
    return { result, output };
  } finally {
    // Always restore original console.log
    console.log = originalLog;
  }
}

/**
 * Capture console.error output during a function call.
 *
 * Similar to captureConsoleOutput but captures console.error instead.
 * Useful for testing error reporting in CLI commands.
 *
 * @param fn - Function to execute while capturing console.error output
 * @returns Object containing the function's return value and captured error lines
 *
 * @example
 * ```typescript
 * const { result, errors } = await captureConsoleErrors(async () => {
 *   console.error('Error occurred');
 *   return false;
 * });
 *
 * expect(result).toBe(false);
 * expect(errors).toEqual(['Error occurred']);
 * ```
 */
export async function captureConsoleErrors<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; errors: string[] }> {
  const errors: string[] = [];
  const originalError = console.error;

  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  try {
    const result = await fn();
    return { result, errors };
  } finally {
    console.error = originalError;
  }
}
