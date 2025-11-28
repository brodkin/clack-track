/**
 * CronScheduler - Minute-aligned minor update scheduler
 *
 * Schedules minor updates to run every minute on the minute (aligned to system clock).
 * Uses MinorUpdateGenerator to retrieve cached content and apply fresh frame with
 * updated time/weather information.
 *
 * Design Patterns:
 * - Dependency Injection: Accepts MinorUpdateGenerator and VestaboardClient
 * - Single Responsibility: Focused only on scheduling, not content generation
 * - Graceful Degradation: Logs errors but continues running
 *
 * @example
 * ```typescript
 * const scheduler = new CronScheduler(minorUpdateGenerator, vestaboardClient);
 * scheduler.start(); // Begins minute-aligned updates
 * scheduler.stop();  // Stops scheduler
 * ```
 */

import { MinorUpdateGenerator } from '../content/generators/index.js';
import type { VestaboardClient } from '../api/vestaboard/index.js';
import { log } from '../utils/logger.js';

/**
 * Interval duration for minor updates (1 minute)
 */
const MINUTE_INTERVAL_MS = 60 * 1000;

export class CronScheduler {
  private readonly minorUpdateGenerator: MinorUpdateGenerator;
  private readonly vestaboardClient: VestaboardClient;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Create a new CronScheduler instance
   *
   * @param minorUpdateGenerator - Generator for minor updates (retrieves cache, applies frame)
   * @param vestaboardClient - Client for sending content to Vestaboard
   */
  constructor(minorUpdateGenerator: MinorUpdateGenerator, vestaboardClient: VestaboardClient) {
    this.minorUpdateGenerator = minorUpdateGenerator;
    this.vestaboardClient = vestaboardClient;
  }

  /**
   * Start the cron scheduler
   *
   * Aligns first execution to the next minute boundary, then runs every 60 seconds.
   * This ensures minor updates happen consistently at :00 seconds of each minute.
   */
  start(): void {
    const msUntilNextMinute = this.calculateDelayToNextMinute();

    // Wait until next minute boundary, then start recurring interval
    setTimeout(() => {
      this.runMinorUpdate();
      this.intervalId = setInterval(() => this.runMinorUpdate(), MINUTE_INTERVAL_MS);
    }, msUntilNextMinute);

    log('Cron scheduler started - minor updates every minute');
  }

  /**
   * Calculate milliseconds until next minute boundary
   *
   * @returns Delay in milliseconds to next :00 seconds
   */
  private calculateDelayToNextMinute(): number {
    const now = new Date();
    return (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  }

  /**
   * Stop the cron scheduler
   *
   * Clears the recurring interval and prevents further minor updates.
   * Safe to call multiple times (no-op if already stopped).
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log('Cron scheduler stopped');
    }
  }

  /**
   * Execute a single minor update cycle
   *
   * Process:
   * 1. Check if update should be skipped (full-frame content)
   * 2. Generate minor update with current timestamp
   * 3. Validate layout structure
   * 4. Send to Vestaboard
   *
   * Errors are logged but do not crash the scheduler, ensuring continuous operation.
   *
   * @private
   */
  private async runMinorUpdate(): Promise<void> {
    try {
      // Step 1: Check if minor update should be skipped
      if (this.minorUpdateGenerator.shouldSkip()) {
        log('Minor update skipped - cached content is full frame');
        return;
      }

      // Step 2: Generate minor update with current timestamp
      const content = await this.minorUpdateGenerator.generate({
        updateType: 'minor',
        timestamp: new Date(),
      });

      // Step 3: Validate layout structure
      // MinorUpdateGenerator always returns outputMode 'layout' after processing
      if (!content.layout?.characterCodes) {
        throw new Error('Minor update must return valid layout with characterCodes');
      }

      // Step 4: Send to Vestaboard
      await this.vestaboardClient.sendLayout(content.layout.characterCodes);
      log('Minor update sent successfully');
    } catch (error) {
      // Log error but don't crash scheduler - continue running
      console.error('Failed to run minor update:', error);
    }
  }
}
