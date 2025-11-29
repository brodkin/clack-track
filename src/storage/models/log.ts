import { Database, DatabaseRow } from '../database.js';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  created_at: Date;
  metadata?: Record<string, unknown>;
}

// Maintain backward compatibility with old interface name
export type LogRecord = LogEntry;

/**
 * LogModel handles database operations for log records
 * Manages application logs for debugging and monitoring
 */
export class LogModel {
  constructor(private db: Database) {}

  /**
   * Create a new log record in the database
   */
  async create(log: Omit<LogEntry, 'id' | 'created_at'>): Promise<LogEntry> {
    const now = new Date();
    const metadataJson = log.metadata ? JSON.stringify(log.metadata) : null;

    const result = await this.db.run(
      'INSERT INTO logs (level, message, metadata) VALUES (?, ?, ?)',
      [log.level, log.message, metadataJson]
    );

    if (!result.lastID) {
      throw new Error('Failed to create log record');
    }

    return {
      id: result.lastID,
      level: log.level,
      message: log.message,
      created_at: now,
      metadata: log.metadata,
    };
  }

  /**
   * Find recent log records, optionally filtered by level
   */
  async findRecent(limit: number = 100, level?: LogLevel): Promise<LogEntry[]> {
    let rows: DatabaseRow[];

    if (level) {
      rows = await this.db.all(
        'SELECT id, level, message, created_at, metadata FROM logs WHERE level = ? ORDER BY created_at DESC LIMIT ?',
        [level, limit]
      );
    } else {
      rows = await this.db.all(
        'SELECT id, level, message, created_at, metadata FROM logs ORDER BY created_at DESC LIMIT ?',
        [limit]
      );
    }

    return rows.map(row => this.mapRowToLogEntry(row));
  }

  /**
   * Find logs by level
   */
  async findByLevel(level: LogLevel, limit: number = 100): Promise<LogEntry[]> {
    return this.findRecent(limit, level);
  }

  /**
   * Find a log by ID
   */
  async findById(id: number): Promise<LogEntry | null> {
    const row = await this.db.get(
      'SELECT id, level, message, created_at, metadata FROM logs WHERE id = ?',
      [id]
    );

    if (!row) {
      return null;
    }

    return this.mapRowToLogEntry(row);
  }

  /**
   * Delete log records older than specified number of days
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.db.run('DELETE FROM logs WHERE created_at < ?', [
      cutoffDate.toISOString(),
    ]);
    return result.changes || 0;
  }

  /**
   * Get count of log records by level
   */
  async countByLevel(): Promise<Record<LogLevel, number>> {
    const rows = await this.db.all('SELECT level, COUNT(*) as count FROM logs GROUP BY level', []);

    const counts: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };

    rows.forEach(row => {
      const level = row.level as LogLevel;
      const count = row.count as number;
      if (level in counts) {
        counts[level] = count;
      }
    });

    return counts;
  }

  /**
   * Clear all logs (caution: deletes all log records)
   */
  async clear(): Promise<number> {
    const result = await this.db.run('DELETE FROM logs', []);
    return result.changes || 0;
  }

  private mapRowToLogEntry(row: DatabaseRow): LogEntry {
    let metadata: Record<string, unknown> | undefined;
    try {
      const metadataStr = row.metadata as string | null;
      if (metadataStr) {
        metadata = JSON.parse(metadataStr);
      }
    } catch {
      // If metadata parsing fails, leave it undefined
    }

    return {
      id: row.id as number,
      level: row.level as LogLevel,
      message: row.message as string,
      created_at: new Date(row.created_at as string),
      metadata,
    };
  }
}
