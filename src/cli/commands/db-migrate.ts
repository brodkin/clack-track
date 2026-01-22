import { log, error } from '../../utils/logger.js';
import { getKnexInstance, closeKnexInstance } from '../../storage/knex.js';

/**
 * Database Migration Command
 *
 * Runs pending database migrations to bring the schema up to date.
 * Safe for production use - only applies pending migrations.
 *
 * Exit codes:
 * - 0: Success (migrations applied or already up to date)
 * - 1: Failure (migration error)
 *
 * @throws Error if migration fails
 */
export async function dbMigrateCommand(): Promise<void> {
  try {
    const knex = getKnexInstance();

    try {
      log('Running database migrations...');
      const [batchNo, migrations] = await knex.migrate.latest();

      if (migrations.length === 0) {
        log('Database is already up to date.');
      } else {
        log(`Batch ${batchNo} ran: ${migrations.length} migration(s)`);
        for (const migration of migrations) {
          log(`  - ${migration}`);
        }
      }
    } finally {
      await closeKnexInstance();
    }
  } catch (err) {
    error('Migration failed:', err);
    process.exit(1);
  }
}
