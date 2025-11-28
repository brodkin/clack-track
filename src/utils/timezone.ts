/**
 * Timezone utilities for working with POSIX TZ environment variable
 * and Intl.DateTimeFormat API for proper timezone handling.
 *
 * Default timezone: America/Los_Angeles (Pacific Time)
 */

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * Get the current timezone from TZ environment variable or default.
 *
 * @returns The timezone identifier (e.g., "America/Los_Angeles", "UTC")
 */
export function getTimezone(): string {
  const tz = process.env.TZ;
  return tz && tz.trim() !== '' ? tz : DEFAULT_TIMEZONE;
}

/**
 * Get current date/time as a Date object.
 * Note: Date objects are timezone-agnostic. This is primarily for testing.
 *
 * @param _tz - Optional timezone (not used for Date creation, but kept for API consistency)
 * @returns Current date/time
 */
export function getCurrentDateTime(_tz?: string): Date {
  return new Date();
}

/**
 * Format day name in uppercase using Intl.DateTimeFormat.
 *
 * @param date - The date to format
 * @param tz - Optional timezone identifier (defaults to getTimezone())
 * @returns Day name in uppercase (e.g., "MONDAY")
 */
export function formatDayName(date: Date, tz?: string): string {
  const timezone = tz ?? getTimezone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: timezone,
  });
  return formatter.format(date).toUpperCase();
}

/**
 * Format date as "MMM DD" using Intl.DateTimeFormat.
 *
 * @param date - The date to format
 * @param tz - Optional timezone identifier (defaults to getTimezone())
 * @returns Formatted date (e.g., "NOV 27")
 */
export function formatDateMonth(date: Date, tz?: string): string {
  const timezone = tz ?? getTimezone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });

  const formatted = formatter.format(date);
  // Format is "MMM D" or "MMM DD", we need to uppercase the month
  return formatted.toUpperCase();
}

/**
 * Format time as "HH:MM" in 24-hour format using Intl.DateTimeFormat.
 *
 * @param date - The date to format
 * @param tz - Optional timezone identifier (defaults to getTimezone())
 * @returns Time in 24-hour format (e.g., "14:30")
 */
export function formatTime(date: Date, tz?: string): string {
  const timezone = tz ?? getTimezone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });

  const formatted = formatter.format(date);
  // Intl.DateTimeFormat may return "24:00" for midnight, normalize to "00:00"
  return formatted.replace(/^24:/, '00:');
}

/**
 * Get the hour (0-23) in the specified timezone.
 *
 * @param date - The date to extract hour from
 * @param tz - Optional timezone identifier (defaults to getTimezone())
 * @returns Hour in 24-hour format (0-23)
 */
export function getHourInTimezone(date: Date, tz?: string): number {
  const timezone = tz ?? getTimezone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  });

  const hourStr = formatter.format(date);
  let hour = parseInt(hourStr, 10);
  // Intl.DateTimeFormat may return 24 for midnight, normalize to 0
  if (hour === 24) {
    hour = 0;
  }
  return hour;
}
