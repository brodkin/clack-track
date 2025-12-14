import { log, error } from '../../utils/logger.js';
import { bootstrap, type BootstrapResult } from '../../bootstrap.js';
import { closeKnexInstance } from '../../storage/knex.js';

/**
 * Generate Command
 *
 * Generates content and sends it to Vestaboard using the ContentOrchestrator.
 * Supports both major (full content refresh) and minor (time/weather only) updates.
 *
 * @param options - Command options
 * @param options.type - Update type ('major' or 'minor', defaults to 'major')
 * @param options.generator - Optional generator ID to force a specific generator
 */
export async function generateCommand(options: {
  type?: 'major' | 'minor';
  generator?: string;
}): Promise<void> {
  let scheduler: BootstrapResult['scheduler'] | null = null;
  let haClient: BootstrapResult['haClient'] = null;
  let knex: BootstrapResult['knex'] = null;

  try {
    const updateType = options.type || 'major';
    const generatorId = options.generator;

    if (generatorId) {
      log(`Generating ${updateType} content update using generator: ${generatorId}`);
    } else {
      log(`Generating ${updateType} content update...`);
    }

    // Step 1: Bootstrap the application to initialize all dependencies
    const {
      orchestrator,
      scheduler: bootstrapScheduler,
      haClient: bootstrapHaClient,
      knex: bootstrapKnex,
    } = await bootstrap();
    scheduler = bootstrapScheduler;
    haClient = bootstrapHaClient;
    knex = bootstrapKnex;

    // Step 2: Generate and send content via orchestrator
    await orchestrator.generateAndSend({
      updateType,
      timestamp: new Date(),
      generatorId,
    });

    // Step 3: Log success
    log(`Successfully generated and sent ${updateType} update to Vestaboard`);
  } catch (err) {
    error('Failed to generate content:', err);
    process.exit(1);
  } finally {
    // Step 4: Clean shutdown - stop scheduler and disconnect HA client
    if (scheduler) {
      try {
        scheduler.stop();
      } catch {
        // Ignore scheduler stop errors - not critical for CLI command
      }
    }

    // Disconnect Home Assistant WebSocket to allow process to exit
    if (haClient) {
      try {
        await haClient.disconnect();
      } catch {
        // Ignore disconnect errors - not critical for CLI command
      }
    }

    // Close Knex database connection to allow process to exit
    if (knex) {
      try {
        await closeKnexInstance();
      } catch {
        // Ignore Knex close errors - not critical for CLI command
      }
    }
  }
}
