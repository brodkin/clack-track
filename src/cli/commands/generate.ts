import { log, error } from '../../utils/logger.js';
import { bootstrap, type BootstrapResult } from '../../bootstrap.js';

/**
 * Generate Command
 *
 * Generates content and sends it to Vestaboard using the ContentOrchestrator.
 * Supports both major (full content refresh) and minor (time/weather only) updates.
 *
 * @param options - Command options
 * @param options.type - Update type ('major' or 'minor', defaults to 'major')
 */
export async function generateCommand(options: { type?: 'major' | 'minor' }): Promise<void> {
  let scheduler: BootstrapResult['scheduler'] | null = null;

  try {
    const updateType = options.type || 'major';
    log(`Generating ${updateType} content update...`);

    // Step 1: Bootstrap the application to initialize all dependencies
    const { orchestrator, scheduler: bootstrapScheduler } = await bootstrap();
    scheduler = bootstrapScheduler;

    // Step 2: Generate and send content via orchestrator
    await orchestrator.generateAndSend({
      updateType,
      timestamp: new Date(),
    });

    // Step 3: Log success
    log(`Successfully generated and sent ${updateType} update to Vestaboard`);
  } catch (err) {
    error('Failed to generate content:', err);
    process.exit(1);
  } finally {
    // Step 4: Clean shutdown - stop scheduler to prevent dangling timers
    if (scheduler) {
      try {
        scheduler.stop();
      } catch {
        // Ignore scheduler stop errors - not critical for CLI command
      }
    }
  }
}
