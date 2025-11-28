/**
 * ThrottledLogger - Prevents error spam by throttling repeated messages
 *
 * Design Pattern: Rate Limiting / Throttling
 * Use Case: Prevent log spam when errors repeat frequently (e.g., cron scheduler errors)
 *
 * Features:
 * - Logs first occurrence of each error key immediately
 * - Suppresses subsequent logs with same key within throttle window
 * - Shows suppressed count when logging resumes
 * - Independent throttling per error key (different errors logged independently)
 *
 * @example
 * ```typescript
 * const logger = new ThrottledLogger(5 * 60 * 1000); // 5 minute throttle
 *
 * // First error logs immediately
 * logger.error('db-connection', 'Database connection failed');
 *
 * // Same error 30s later - suppressed
 * logger.error('db-connection', 'Database connection failed');
 *
 * // Different error - logs immediately
 * logger.error('api-timeout', 'API request timed out');
 *
 * // 6 minutes later - logs with suppressed count
 * logger.error('db-connection', 'Database connection failed');
 * // Output: "[db-connection] Database connection failed (1 similar messages suppressed)"
 * ```
 */

export class ThrottledLogger {
  private readonly lastLogTime: Map<string, number> = new Map();
  private readonly suppressedCount: Map<string, number> = new Map();
  private readonly throttleMs: number;
  private readonly maxEntries: number = 100;

  /**
   * Create a new ThrottledLogger
   *
   * @param throttleMs - Minimum milliseconds between logs for same key (default: 5 minutes)
   */
  constructor(throttleMs: number = 5 * 60 * 1000) {
    this.throttleMs = throttleMs;
  }

  /**
   * Log a warning with throttling
   *
   * @param key - Unique identifier for this error type (e.g., 'db-connection', 'api-timeout')
   * @param message - Warning message to log
   * @param args - Additional arguments to pass to console.warn
   */
  warn(key: string, message: string, ...args: unknown[]): void {
    this.logWithThrottle('warn', key, message, ...args);
  }

  /**
   * Log an error with throttling
   *
   * @param key - Unique identifier for this error type (e.g., 'db-connection', 'api-timeout')
   * @param message - Error message to log
   * @param args - Additional arguments to pass to console.error
   */
  error(key: string, message: string, ...args: unknown[]): void {
    this.logWithThrottle('error', key, message, ...args);
  }

  /**
   * Ensure map capacity doesn't exceed maxEntries by evicting oldest entry
   *
   * @param key - The key being added
   * @private
   */
  private ensureCapacity(key: string): void {
    // If key already exists, no capacity check needed
    if (this.lastLogTime.has(key)) return;

    // If we're at capacity, evict the oldest entry
    if (this.lastLogTime.size >= this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      // Find the oldest entry
      for (const [k, time] of this.lastLogTime) {
        if (time < oldestTime) {
          oldestTime = time;
          oldestKey = k;
        }
      }

      // Evict the oldest entry from both maps
      if (oldestKey) {
        this.lastLogTime.delete(oldestKey);
        this.suppressedCount.delete(oldestKey);
      }
    }
  }

  /**
   * Internal method to handle throttled logging
   *
   * @param level - Log level ('warn' or 'error')
   * @param key - Unique identifier for this log type
   * @param message - Message to log
   * @param args - Additional arguments
   * @private
   */
  private logWithThrottle(
    level: 'warn' | 'error',
    key: string,
    message: string,
    ...args: unknown[]
  ): void {
    // Ensure we don't exceed capacity before processing
    this.ensureCapacity(key);

    const now = Date.now();
    const lastTime = this.lastLogTime.get(key) || 0;

    // Check if we're within throttle window
    if (now - lastTime < this.throttleMs) {
      // Suppress this log and increment counter
      this.suppressedCount.set(key, (this.suppressedCount.get(key) || 0) + 1);
      return;
    }

    // Throttle window expired - log the message
    const suppressed = this.suppressedCount.get(key) || 0;
    const logMethod = level === 'warn' ? console.warn : console.error;

    if (suppressed > 0) {
      // Show suppressed count
      logMethod(`[${key}] ${message} (${suppressed} similar messages suppressed)`, ...args);
      this.suppressedCount.set(key, 0);
    } else {
      // No suppressed messages - log normally
      logMethod(`[${key}] ${message}`, ...args);
    }

    // Update last log time for this key
    this.lastLogTime.set(key, now);
  }
}
