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
        extension: 'ts',
        loadExtensions: ['.ts'],
      },
      seeds: {
        directory: seedsDir,
        extension: 'ts',
        loadExtensions: ['.ts'],
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
        extension: 'ts',
        loadExtensions: ['.ts'],
      },
      seeds: {
        directory: seedsDir,
        extension: 'ts',
        loadExtensions: ['.ts'],
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
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: seedsDir,
      extension: 'ts',
      loadExtensions: ['.ts'],
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
 * Export Knex types for use in other modules
 */
export type { Knex };
