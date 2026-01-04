/**
 * Sleep utility for delays in retry logic
 *
 * Provides a promise-based sleep function for implementing
 * exponential backoff and other timing strategies.
 */

/**
 * Sleep for a specified number of milliseconds
 *
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 *
 * @example
 * ```typescript
 * await sleep(1000); // Sleep for 1 second
 * await sleep(2000); // Sleep for 2 seconds
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
