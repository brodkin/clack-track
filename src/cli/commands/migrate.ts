import { log, error } from '../../utils/logger.js';
import { getKnexInstance, closeKnexInstance } from '../../storage/knex.js';

/**
 * Database Migrate Command
 *
 * Runs all pending database migrations using the programmatic Knex API.
 * This command works in production without requiring tsx or knexfile.ts.
 *
 * Following SOLID principles:
 * - Single Responsibility: Only runs migrations
 * - Dependency Inversion: Uses Knex migration API abstraction
 *
 * @throws Error if migration fails (exits with code 1)
 */
export async function dbMigrateCommand(): Promise<void> {
  try {
    log('Running migrations...');

    // Get Knex instance for database operations
    const knex = getKnexInstance();

    try {
      // Run all pending migrations
      const [batchNo, migrations] = await knex.migrate.latest();

      // Output migration status
      if (migrations.length === 0) {
        log('Database is already up to date.');
      } else {
        log(`Ran ${migrations.length} migration(s) in batch ${batchNo}:`);
        for (const migration of migrations) {
          log(`  - ${migration}`);
        }
        log('Migrations complete.');
      }
    } finally {
      // CLEANUP: Always close Knex connection to prevent leaks
      await closeKnexInstance();
    }
  } catch (err) {
    error('Migration failed:', err);
    process.exit(1);
  }
}
