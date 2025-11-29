/**
 * Timezone helper utilities for portable timezone testing
 * Allows tests to run in any timezone without failing
 */

export const TEST_TIMEZONES = {
  UTC: 'UTC',
  PACIFIC: 'America/Los_Angeles',
  EASTERN: 'America/New_York',
  LONDON: 'Europe/London',
  PARIS: 'Europe/Paris',
  SYDNEY: 'Australia/Sydney',
  TOKYO: 'Asia/Tokyo',
} as const;

/**
 * Execute a function with a specific timezone
 * Uses TZ environment variable to override system timezone
 *
 * @param timezone Timezone string (e.g., 'America/Los_Angeles', 'UTC')
 * @param fn Function to execute in the specified timezone
 * @returns Result of the function
 */
export function withTimezone<T>(timezone: string, fn: () => T): T {
  const originalTz = process.env.TZ;

  try {
    process.env.TZ = timezone;
    // Force Node.js to reinitialize timezone handling
    // This is necessary for new Date() and related methods to use the new timezone
    delete (global as Record<string, unknown>).systemTimezone;
    return fn();
  } finally {
    if (originalTz !== undefined) {
      process.env.TZ = originalTz;
    } else {
      delete process.env.TZ;
    }
    delete (global as Record<string, unknown>).systemTimezone;
  }
}

/**
 * Execute an async function with a specific timezone
 * Uses TZ environment variable to override system timezone
 *
 * @param timezone Timezone string (e.g., 'America/Los_Angeles', 'UTC')
 * @param fn Async function to execute in the specified timezone
 * @returns Promise resolving to result of the function
 */
export async function withTimezoneAsync<T>(
  timezone: string,
  fn: () => Promise<T>,
): Promise<T> {
  const originalTz = process.env.TZ;

  try {
    process.env.TZ = timezone;
    delete (global as Record<string, unknown>).systemTimezone;
    return await fn();
  } finally {
    if (originalTz !== undefined) {
      process.env.TZ = originalTz;
    } else {
      delete process.env.TZ;
    }
    delete (global as Record<string, unknown>).systemTimezone;
  }
}
