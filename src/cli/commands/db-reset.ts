import { log, error } from '../../utils/logger.js';
import { getKnexInstance, closeKnexInstance } from '../../storage/knex.js';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

/**
 * Database Reset Command Options
 */
export interface DbResetOptions {
  /** Truncate tables instead of dropping (keeps schema) */
  truncate: boolean;
  /** Run seeds after reset */
  seed: boolean;
  /** Skip confirmation prompts (for CI/CD) */
  force: boolean;
}

/**
 * Database Reset Command
 *
 * Safely resets the database with multiple protection layers:
 * - Blocks execution in production environment
 * - Requires user confirmation (unless --force)
 * - Supports truncate mode (keeps schema) or drop mode (re-runs migrations)
 * - Optionally runs seeds after reset
 *
 * Safety Principle (SOLID: Single Responsibility):
 * Each safety check is isolated and clear, making the command auditable
 * and maintainable.
 *
 * @param options - Reset options
 * @throws Error if executed in production
 * @throws Error if database operations fail
 */
export async function dbResetCommand(options: DbResetOptions): Promise<void> {
  // SAFETY CHECK 1: Block production environment (check BEFORE try block)
  if (process.env.NODE_ENV === 'production') {
    error('db:reset is not allowed in production environment');
    throw new Error('db:reset is not allowed in production environment');
  }

  try {
    // SAFETY CHECK 2: Get user confirmation (unless --force)
    if (!options.force) {
      const confirmed = await promptConfirmation();
      if (!confirmed) {
        log('Database reset aborted.');
        return;
      }
    }

    // Get Knex instance for database operations
    const knex = getKnexInstance();

    try {
      // RESET OPERATION: Choose between truncate or drop mode
      if (options.truncate) {
        await truncateTables(knex);
      } else {
        await dropAndRecreate(knex);
      }

      // OPTIONAL: Run seeds if requested
      if (options.seed) {
        await runSeeds(knex);
      }

      log('Database reset complete.');
    } finally {
      // CLEANUP: Always close Knex connection to prevent leaks
      await closeKnexInstance();
    }
  } catch (err) {
    error('Failed to reset database:', err);
    process.exit(1);
  }
}

/**
 * Prompt user for confirmation with clear warning
 *
 * Following SOLID principles:
 * - Single Responsibility: Only handles user confirmation
 * - Dependency Inversion: Uses readline abstraction
 *
 * @returns Promise<boolean> - True if user confirms, false otherwise
 */
async function promptConfirmation(): Promise<boolean> {
  const rl = createInterface({ input, output });

  try {
    log('\n⚠️  WARNING: This operation will RESET the database.');
    log('⚠️  ALL DATA WILL BE LOST and cannot be recovered.');
    log('⚠️  Only proceed if you understand the consequences.\n');

    const answer = await rl.question('Are you sure you want to continue? (yes/no): ');

    const confirmed = answer.toLowerCase().trim() === 'yes' || answer.toLowerCase().trim() === 'y';

    if (!confirmed) {
      log('Aborted by user.');
    }

    return confirmed;
  } finally {
    rl.close();
  }
}

/**
 * Truncate all tables except migration tables
 *
 * Truncate mode clears all data but preserves the database schema.
 * This is faster than drop mode and keeps migration history intact.
 *
 * Following SOLID principles:
 * - Single Responsibility: Only truncates tables
 * - Open/Closed: Can be extended for custom table filtering
 *
 * @param knex - Knex instance
 */
async function truncateTables(knex: ReturnType<typeof getKnexInstance>): Promise<void> {
  log('Truncating all tables (except migration tables)...');

  // Get list of all tables
  const tables = await getTableList(knex);

  // Filter out migration tables - we never want to truncate these
  const PROTECTED_TABLES = ['knex_migrations', 'knex_migrations_lock'];
  const tablesToTruncate = tables.filter(table => !PROTECTED_TABLES.includes(table));

  // Truncate each table
  for (const table of tablesToTruncate) {
    log(`  Truncating table: ${table}`);
    await knex(table).truncate();
  }

  log('All tables truncated successfully.');
}

/**
 * Drop all tables and re-run migrations
 *
 * Drop mode completely resets the database by rolling back all migrations
 * and then running them again. This ensures a clean state matching the
 * latest migration files.
 *
 * Following SOLID principles:
 * - Single Responsibility: Only handles drop and recreate
 * - Dependency Inversion: Uses Knex migration API
 *
 * @param knex - Knex instance
 */
async function dropAndRecreate(knex: ReturnType<typeof getKnexInstance>): Promise<void> {
  log('Rolling back all migrations...');
  await knex.migrate.rollback(undefined, true); // true = rollback all

  log('Running migrations...');
  await knex.migrate.latest();

  log('Database schema reset successfully.');
}

/**
 * Run database seeds
 *
 * Seeds populate the database with initial or sample data.
 * This is useful for development and testing environments.
 *
 * Following SOLID principles:
 * - Single Responsibility: Only runs seeds
 * - Open/Closed: Delegates to Knex seed API
 *
 * @param knex - Knex instance
 */
async function runSeeds(knex: ReturnType<typeof getKnexInstance>): Promise<void> {
  log('Running seeds...');
  await knex.seed.run();
  log('Seeds executed successfully.');
}

/**
 * Get list of all tables in the database
 *
 * This is database-agnostic and works with SQLite and MySQL.
 *
 * Following SOLID principles:
 * - Single Responsibility: Only retrieves table list
 * - Open/Closed: Handles multiple database types
 * - Liskov Substitution: Works with any Knex instance
 *
 * @param knex - Knex instance
 * @returns Array of table names
 * @throws Error if database client is unsupported
 */
async function getTableList(knex: ReturnType<typeof getKnexInstance>): Promise<string[]> {
  const client = knex.client.config.client;

  if (client === 'sqlite3') {
    // SQLite: Query sqlite_master table
    const result = await knex.raw<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    // SQLite returns array directly
    return result.map(row => row.name);
  } else if (client === 'mysql2') {
    // MySQL: Use SHOW TABLES with parameterized query to prevent SQL injection
    const dbName = knex.client.database();
    if (!dbName) {
      throw new Error('MySQL database name is not configured');
    }
    const result = await knex.raw<Array<Array<{ [key: string]: string }>>>('SHOW TABLES FROM ??', [
      dbName,
    ]);
    // MySQL returns [[{ Tables_in_db: 'table1' }, ...]]
    const tables = result[0];
    const columnName = `Tables_in_${dbName}`;
    return tables.map(row => row[columnName]);
  } else {
    // Fallback for other databases
    throw new Error(
      `Unsupported database client: ${client}. Only sqlite3 and mysql2 are supported.`
    );
  }
}
