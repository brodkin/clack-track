import BetterSqlite3 from 'better-sqlite3';
import { log } from '../utils/logger.js';
import type { DatabaseRow, DatabaseResult } from './database.js';

// Singleton in-memory database instance for test isolation
// All SQLiteDatabase instances share the same underlying database in tests
let sharedDbInstance: BetterSqlite3.Database | null = null;
let sharedDbMigrated = false;

/**
 * In-memory SQLite database for testing
 * Implements same interface as MySQL Database class
 * Uses singleton pattern so all instances share the same database
 */
export class SQLiteDatabase {
  private db: BetterSqlite3.Database | null = null;

  /**
   * Connect to the in-memory SQLite database.
   * Uses a singleton pattern to ensure all instances share the same database.
   * Enables foreign key support for CASCADE DELETE operations.
   *
   * @returns Promise that resolves when connection is established
   * @throws Error if database initialization fails
   */
  async connect(): Promise<void> {
    // Use shared singleton instance to ensure test and bootstrap share same database
    // Validate existing instance is still open before reuse
    if (!sharedDbInstance || !sharedDbInstance.open) {
      sharedDbInstance = new BetterSqlite3(':memory:');
      log('SQLite in-memory database connected (new instance)');
    } else {
      log('SQLite in-memory database connected (shared instance)');
    }
    this.db = sharedDbInstance;
    // Enable foreign key support EVERY time (required for CASCADE DELETE to work)
    // Must be set per-connection in SQLite
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Disconnect from the database.
   * Note: Does not close the shared singleton instance to allow other connections.
   *
   * @returns Promise that resolves when disconnection is complete
   */
  async disconnect(): Promise<void> {
    await this.close();
  }

  /**
   * Run database migrations using Knex migration system
   *
   * Creates a temporary Knex instance to run migrations, then copies the schema
   * to our BetterSQLite3 singleton instance by re-running the migrations.
   *
   * This approach ensures:
   * 1. Migrations are defined once in Knex migration files
   * 2. SQLiteDatabase (test) and Database (production) use the same schema
   * 3. Tests use the fast BetterSQLite3 singleton pattern
   *
   * IDEMPOTENT: Safe to call multiple times on the same shared database instance.
   * Uses sharedDbMigrated flag to prevent duplicate migrations.
   */
  async migrate(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }

    // Skip if already migrated on shared instance (idempotent pattern)
    if (sharedDbMigrated && this.db === sharedDbInstance) {
      return;
    }

    // Import migration files directly (same pattern as knex-migrations.test.ts)
    const path = await import('path');
    const rootDir = process.cwd();
    const migrationsDir = path.join(rootDir, 'migrations');

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const migration001 = require(path.join(migrationsDir, '001_create_content_table.js'));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const migration002 = require(path.join(migrationsDir, '002_create_votes_table.js'));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const migration003 = require(path.join(migrationsDir, '003_create_logs_table.js'));

      // Create a Knex instance using OUR BetterSQLite3 database
      // This requires using a file path, so we'll use a workaround
      const knex = (await import('knex')).default;

      // Get the database filename if it exists (for file-based SQLite)
      // For in-memory databases, this won't work, so we fall back to direct execution
      const isInMemory = !this.db.name || this.db.name === ':memory:' || this.db.name === '';

      if (isInMemory) {
        // For in-memory databases, create a wrapper Knex instance
        // We can't share the connection, so we create tables manually
        const tempKnex = knex({
          client: 'sqlite3',
          connection: { filename: ':memory:' },
          useNullAsDefault: true,
        });

        // Run migrations on temporary database
        await migration001.up(tempKnex);
        await migration002.up(tempKnex);
        await migration003.up(tempKnex);

        // Get the schema from temp database and replicate to ours
        // Query sqlite_master to get CREATE TABLE statements
        const tables = tempKnex('sqlite_master')
          .select('sql')
          .where('type', 'table')
          .andWhereNot('name', 'like', 'sqlite_%');

        const tableSchemas = await tables;

        // Execute CREATE TABLE statements on our database
        for (const { sql } of tableSchemas) {
          if (sql) {
            this.db.exec(sql);
          }
        }

        // Get indexes too
        const indexes = tempKnex('sqlite_master')
          .select('sql')
          .where('type', 'index')
          .andWhereNot('name', 'like', 'sqlite_%');

        const indexSchemas = await indexes;

        for (const { sql } of indexSchemas) {
          if (sql) {
            this.db.exec(sql);
          }
        }

        await tempKnex.destroy();
      } else {
        // For file-based SQLite, we can use Knex directly
        const knexInstance = knex({
          client: 'sqlite3',
          connection: { filename: this.db.name },
          useNullAsDefault: true,
        });

        await migration001.up(knexInstance);
        await migration002.up(knexInstance);
        await migration003.up(knexInstance);

        await knexInstance.destroy();
      }

      // Mark shared instance as migrated (idempotent pattern)
      if (this.db === sharedDbInstance) {
        sharedDbMigrated = true;
      }

      log('SQLite database migrations completed (via Knex)');
    } catch (error) {
      log(`SQLite migration error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Execute a SELECT query and return the first row.
   *
   * @template T - The expected type of the returned row
   * @param sql - SQL query string
   * @param params - Array of parameters to bind to the query
   * @returns Promise resolving to the first row or null if no rows found
   * @throws Error if database is not connected
   */
  async get<T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params);
    return rows[0] || null;
  }

  /**
   * Execute a SELECT query and return all rows.
   *
   * @template T - The expected type of the returned rows
   * @param sql - SQL query string
   * @param params - Array of parameters to bind to the query
   * @returns Promise resolving to an array of rows
   * @throws Error if database is not connected
   */
  async all<T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Convert parameters to SQLite-compatible types
   * SQLite only supports: numbers, strings, bigints, buffers, and null
   */
  private convertParams(params: unknown[]): unknown[] {
    return params.map(param => {
      if (typeof param === 'boolean') {
        return param ? 1 : 0; // Convert boolean to integer
      }
      return param;
    });
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE query.
   * Automatically converts boolean parameters to integers (SQLite compatibility).
   *
   * @param sql - SQL query string
   * @param params - Array of parameters to bind to the query
   * @returns Promise resolving to result with changes count and last inserted ID
   * @throws Error if database is not connected
   */
  async run(sql: string, params: unknown[] = []): Promise<DatabaseResult> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...this.convertParams(params));
    return {
      changes: result.changes,
      lastID: Number(result.lastInsertRowid),
    };
  }

  async close(): Promise<void> {
    // Don't actually close shared singleton - just disconnect this instance
    // The shared instance stays open for other test connections
    if (this.db) {
      this.db = null;
      log('SQLite database connection closed (shared instance kept open)');
    }
  }

  /**
   * Reset the shared database instance.
   * This actually closes the database and clears the singleton.
   * Should be called at the end of test suites to ensure clean teardown.
   *
   * @returns void
   */
  static resetSharedInstance(): void {
    if (sharedDbInstance) {
      sharedDbInstance.close();
      sharedDbInstance = null;
      sharedDbMigrated = false; // Reset migration flag for next test suite
      log('SQLite shared instance reset');
    }
  }

  /**
   * Execute a function within a transaction.
   * Automatically commits on success, rolls back on error.
   *
   * @template T - The return type of the transaction function
   * @param fn - Async function to execute within the transaction
   * @returns Promise resolving to the transaction function's return value
   * @throws Error if database is not connected or transaction fails
   */
  async transaction<T>(fn: (db: BetterSqlite3.Database) => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const db = this.db;
    db.exec('BEGIN TRANSACTION');

    try {
      const result = await fn(db);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        log(
          `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
        );
      }
      throw error;
    }
  }
}
