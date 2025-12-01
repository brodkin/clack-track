import knex, { Knex } from 'knex';
import { log } from '../utils/logger.js';
import * as path from 'path';

/**
 * Singleton Knex instance for database management
 * Ensures only one connection pool is active at a time
 */
let knexInstance: Knex | null = null;

/**
 * Load Knex configuration for the current environment
 * Supports SQLite (dev/test) and MySQL (production)
 */
function loadKnexConfig(environment: string): Knex.Config {
  // Use process.cwd() which works in both CommonJS (tests) and ESM (runtime)
  const rootDir = process.cwd();
  const migrationsDir = path.join(rootDir, 'migrations');
  const seedsDir = path.join(rootDir, 'seeds');

  if (environment === 'test') {
    return {
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
      },
      useNullAsDefault: true,
      migrations: {
        directory: migrationsDir,
        loadExtensions: ['.js'],
        // Use CommonJS require for migrations in test environment
        disableMigrationsListValidation: true,
      },
      seeds: {
        directory: seedsDir,
        loadExtensions: ['.js'],
      },
    };
  }

  if (environment === 'production' && process.env.DB_TYPE === 'mysql') {
    return {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'clack_track',
      },
      migrations: {
        directory: migrationsDir,
        loadExtensions: ['.js'],
      },
      seeds: {
        directory: seedsDir,
        loadExtensions: ['.js'],
      },
      pool: {
        min: 2,
        max: 10,
      },
    };
  }

  // Default: development SQLite
  return {
    client: 'sqlite3',
    connection: {
      filename: path.join(rootDir, 'data', 'clack-track-dev.sqlite'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: migrationsDir,
      loadExtensions: ['.js'],
    },
    seeds: {
      directory: seedsDir,
      loadExtensions: ['.js'],
    },
  };
}

/**
 * Factory function to create a Knex instance with optional configuration
 *
 * @param config - Optional Knex configuration. If not provided, uses environment-based config
 * @returns Knex instance
 */
export function createKnexInstance(config?: Knex.Config): Knex {
  const finalConfig = config || loadKnexConfig(process.env.NODE_ENV || 'development');

  return knex(finalConfig);
}

/**
 * Get or create the singleton Knex instance
 *
 * This function ensures only one Knex connection pool exists throughout
 * the application lifecycle, following the Singleton pattern (SOLID: DIP)
 *
 * @returns Singleton Knex instance
 */
export function getKnexInstance(): Knex {
  if (!knexInstance) {
    const environment = process.env.NODE_ENV || 'development';
    const config = loadKnexConfig(environment);

    knexInstance = knex(config);
    log(`Knex instance created for environment: ${environment}`);
  }

  return knexInstance;
}

/**
 * Close the Knex connection and cleanup resources
 *
 * This function properly destroys the connection pool and resets the singleton.
 * Essential for clean test teardown and application shutdown.
 *
 * Following SOLID principles:
 * - Single Responsibility: Only handles connection cleanup
 * - Open/Closed: Can be extended without modification
 *
 * @returns Promise that resolves when connection is closed
 * @throws Never throws - handles errors gracefully
 */
export async function closeKnexInstance(): Promise<void> {
  if (knexInstance) {
    try {
      await knexInstance.destroy();
      knexInstance = null;
      log('Knex connection closed');
    } catch (error) {
      // Log error but don't throw - allow cleanup to continue
      log(
        `Warning: Error during Knex connection cleanup: ${error instanceof Error ? error.message : String(error)}`
      );
      // Reset instance even if destroy fails to prevent memory leaks
      knexInstance = null;
    }
  }
}

/**
 * Reset the singleton instance (primarily for testing)
 * Use closeKnexInstance() in production code
 *
 * @internal
 */
export function resetKnexInstance(): void {
  knexInstance = null;
}

/**
 * Initialize Knex connection and run migrations
 *
 * This function provides a unified initialization point for database setup,
 * combining connection establishment with schema migrations.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles database initialization lifecycle
 * - Dependency Inversion: Returns Knex interface, not concrete implementation
 *
 * @returns Promise resolving to the initialized Knex instance
 * @throws Error if migration fails
 */
export async function initializeKnex(): Promise<Knex> {
  const knex = getKnexInstance();

  try {
    const [batchNo, migrationFiles] = await knex.migrate.latest();
    log(`Database migrations completed: batch ${batchNo}, files: ${migrationFiles.join(', ')}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Migration error: ${errorMessage}`);
    throw error;
  }

  return knex;
}

/**
 * Check if Knex database connection is active
 *
 * Executes a simple query to verify connectivity. Useful for health checks
 * and application startup validation.
 *
 * Following SOLID principles:
 * - Single Responsibility: Only checks connection health
 * - Open/Closed: Returns boolean for easy extension
 *
 * @returns Promise resolving to true if connected, false otherwise
 */
export async function isKnexConnected(): Promise<boolean> {
  // Return false if no instance exists (don't create one)
  if (!knexInstance) {
    return false;
  }

  try {
    await knexInstance.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Export Knex types for use in other modules
 */
export type { Knex };
