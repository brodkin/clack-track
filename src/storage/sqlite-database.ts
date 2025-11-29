import BetterSqlite3 from 'better-sqlite3';
import { log } from '../utils/logger.js';
import type { DatabaseRow, DatabaseResult } from './database.js';

// Singleton in-memory database instance for test isolation
// All SQLiteDatabase instances share the same underlying database in tests
let sharedDbInstance: BetterSqlite3.Database | null = null;

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
   * Run database migrations to create tables and indexes.
   * Creates content, votes, and logs tables with appropriate indexes.
   * Safe to call multiple times (uses IF NOT EXISTS).
   *
   * @returns Promise that resolves when migrations are complete
   * @throws Error if database is not connected
   */
  async migrate(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }

    // SQLite-compatible schema (mirrors MySQL schema with SQLite syntax)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('major', 'minor')),
        generatedAt TEXT NOT NULL,
        sentAt TEXT DEFAULT NULL,
        aiProvider TEXT NOT NULL,
        metadata TEXT DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('success', 'failed')),
        generatorId TEXT DEFAULT NULL,
        generatorName TEXT DEFAULT NULL,
        priority INTEGER DEFAULT 2,
        aiModel TEXT DEFAULT NULL,
        modelTier TEXT DEFAULT NULL,
        failedOver INTEGER DEFAULT 0,
        primaryProvider TEXT DEFAULT NULL,
        primaryError TEXT DEFAULT NULL,
        errorType TEXT DEFAULT NULL,
        errorMessage TEXT DEFAULT NULL,
        tokensUsed INTEGER DEFAULT NULL
      )
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_generated_at ON content(generatedAt)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_status ON content(status)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_generator_id ON content(generatorId)`);

    // Votes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id INTEGER NOT NULL,
        vote_type TEXT NOT NULL CHECK(vote_type IN ('good', 'bad')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        userAgent TEXT DEFAULT NULL,
        ipAddress TEXT DEFAULT NULL,
        FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_votes_content_id ON votes(content_id)`);

    // Logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error', 'debug')),
        message TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT NULL
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)`);

    log('SQLite database migrations completed');
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
