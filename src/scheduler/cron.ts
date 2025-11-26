import { MinorUpdateGenerator } from '../content/generators/index.js';
import type { VestaboardClient } from '../api/vestaboard/index.js';
import { log } from '../utils/logger.js';

export class CronScheduler {
  private minorUpdateGenerator: MinorUpdateGenerator;
  private vestaboardClient: VestaboardClient;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(minorUpdateGenerator: MinorUpdateGenerator, vestaboardClient: VestaboardClient) {
    this.minorUpdateGenerator = minorUpdateGenerator;
    this.vestaboardClient = vestaboardClient;
  }

  start(): void {
    // TODO: Implement minute-by-minute scheduling
    // Run on the minute (aligned to system clock)
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    setTimeout(() => {
      this.runMinorUpdate();
      this.intervalId = setInterval(() => this.runMinorUpdate(), 60 * 1000);
    }, msUntilNextMinute);

    log('Cron scheduler started - minor updates every minute');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log('Cron scheduler stopped');
    }
  }

  private async runMinorUpdate(): Promise<void> {
    try {
      const content = await this.minorUpdateGenerator.generate();
      await this.vestaboardClient.sendText(content.text);
      log('Minor update sent successfully');
    } catch (error) {
      // TODO: Implement error handling with logger
      console.error('Failed to run minor update:', error);
    }
  }
}
