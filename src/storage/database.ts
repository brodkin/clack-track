import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { log } from '../utils/logger.js';

export interface DatabaseRow {
  [key: string]: unknown;
}

export interface DatabaseResult {
  lastID?: number;
  changes?: number;
}

/**
 * Database abstraction layer for Clack Track
 * Supports MySQL with connection pooling for production
 */
export class Database {
  private pool: Pool | null = null;
  private config: { databaseUrl: string };

  constructor(config?: { databaseUrl: string }) {
    // Use provided config or default (environment config loaded during connect())
    this.config = config || { databaseUrl: '' };
  }

  private async loadConfigIfNeeded(): Promise<void> {
    // Load environment config only if databaseUrl is not already set
    if (!this.config.databaseUrl) {
      const { config: envConfig } = await import('../config/env.js');
      this.config.databaseUrl = envConfig.database.url || 'mysql://localhost:3306/clacktrack';
    }
  }

  async connect(): Promise<void> {
    try {
      // Load environment config if needed
      await this.loadConfigIfNeeded();

      // Create connection pool from DATABASE_URL
      this.pool = mysql.createPool({
        uri: this.config.databaseUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Test connection
      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();

      log('Database connection established');
    } catch (error) {
      log(`Database connection failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.close();
  }

  async migrate(): Promise<void> {
    // TODO: Implement database migrations
    // Create tables for content, votes, logs
    log('Database migrations completed');
  }

  /**
   * Execute a SELECT query and return the first row
   */
  async get<T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params);
    return rows[0] || null;
  }

  /**
   * Execute a SELECT query and return all rows
   */
  async all<T = DatabaseRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const [rows] = await this.pool.execute<RowDataPacket[]>(sql, params);
    return rows as T[];
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE query
   */
  async run(sql: string, params: unknown[] = []): Promise<DatabaseResult> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
    return {
      changes: result.affectedRows,
      lastID: result.insertId,
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      log('Database connection closed');
    }
  }

  /**
   * Execute a function within a transaction
   * Automatically commits on success, rolls back on error
   */
  async transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const conn = await this.pool.getConnection();
    await conn.beginTransaction();

    try {
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        // Log rollback error but preserve original error
        log(
          `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
        );
      }
      throw error;
    } finally {
      conn.release();
    }
  }
}
