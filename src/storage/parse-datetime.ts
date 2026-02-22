/**
 * Shared utility for parsing MySQL DATETIME strings as UTC
 *
 * MySQL DATETIME columns store timestamps without timezone indicator
 * (e.g., "2026-02-22 05:26:11"). When read back, `new Date()` parses
 * these space-separated strings as local time, which introduces an
 * offset error in non-UTC environments (e.g., TZ=America/Los_Angeles).
 *
 * This function normalizes MySQL DATETIME strings to ISO 8601 UTC format
 * before constructing the Date object, ensuring correct UTC interpretation.
 */

/**
 * Parse a MySQL DATETIME string (or other date value) as UTC.
 *
 * - "YYYY-MM-DD HH:MM:SS" -> appends T separator and Z suffix, then parses
 * - ISO strings (already contain T/Z) -> parsed directly
 * - Date objects -> returned as-is (SQLite test environments may return Date)
 * - null/undefined -> returned as-is
 *
 * @param value - Raw datetime value from a database row
 * @returns A Date in UTC, or null/undefined if input was null/undefined
 */
export function parseMySQLDateTime(value: null): null;
export function parseMySQLDateTime(value: undefined): undefined;
export function parseMySQLDateTime(value: Date): Date;
export function parseMySQLDateTime(value: string): Date;
export function parseMySQLDateTime(value: string | Date): Date;
export function parseMySQLDateTime(
  value: string | Date | null | undefined
): Date | null | undefined;
export function parseMySQLDateTime(
  value: string | Date | null | undefined
): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value instanceof Date) return value;

  // MySQL DATETIME format: "YYYY-MM-DD HH:MM:SS" (space-separated, no timezone)
  // Convert to ISO 8601 UTC: "YYYY-MM-DDTHH:MM:SSZ"
  const mysqlDatetimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  if (mysqlDatetimePattern.test(value)) {
    return new Date(value.replace(' ', 'T') + 'Z');
  }

  // Already ISO format or other parseable string — parse directly
  return new Date(value);
}
