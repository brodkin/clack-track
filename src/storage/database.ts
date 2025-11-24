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
 * Supports in-memory implementation for testing and SQLite for production
 */
export class Database {
  private connection: unknown; // Will be populated by actual DB driver
  private inMemoryData: Map<string, DatabaseRow[]> = new Map();
  private idCounters: Map<string, number> = new Map();

  async connect(_connectionString?: string): Promise<void> {
    void _connectionString;
    // TODO: Implement actual database connection
    // For now, in-memory store is initialized
    this.initializeTables();
    log('Database connection established');
  }

  async disconnect(): Promise<void> {
    // TODO: Implement graceful disconnection
    this.inMemoryData.clear();
    this.idCounters.clear();
    log('Database connection closed');
  }

  async migrate(): Promise<void> {
    // TODO: Implement database migrations
    // Create tables for content, votes, logs
    this.initializeTables();
    log('Database migrations completed');
  }

  /**
   * Execute a SELECT query and return the first row
   */
  async get(sql: string, params: unknown[] = []): Promise<DatabaseRow | undefined> {
    const rows = await this.all(sql, params);
    return rows[0];
  }

  /**
   * Execute a SELECT query and return all rows
   */
  async all(sql: string, params: unknown[] = []): Promise<DatabaseRow[]> {
    // Parse the SQL and simulate the query
    return this.simulateQuery(sql, params);
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE query
   */
  async run(sql: string, params: unknown[] = []): Promise<DatabaseResult> {
    // For testing, we'll implement a simple in-memory store
    // In production, this would use actual DB driver
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes('insert')) {
      return this.handleInsert(sql, params);
    }

    if (lowerSql.includes('update')) {
      return this.handleUpdate(sql, params);
    }

    if (lowerSql.includes('delete')) {
      return this.handleDelete(sql, params);
    }

    return { changes: 0 };
  }

  private handleInsert(sql: string, params: unknown[]): DatabaseResult {
    const tableName = this.extractTableName(sql);
    const id = this.generateId(tableName);
    const row = this.buildRowFromInsert(sql, params, { id });

    if (!this.inMemoryData.has(tableName)) {
      this.inMemoryData.set(tableName, []);
    }
    this.inMemoryData.get(tableName)!.push(row);

    return { lastID: id, changes: 1 };
  }

  private handleUpdate(sql: string, params: unknown[]): DatabaseResult {
    const tableName = this.extractTableName(sql);
    const rows = this.inMemoryData.get(tableName) || [];
    const whereClause = this.extractWhereClause(sql);
    const updates = this.buildRowFromUpdate(sql, params);
    const updateParamCount = Object.keys(updates).length;
    let changed = 0;

    if (!whereClause) {
      // Update all rows if no WHERE clause
      rows.forEach(row => {
        Object.assign(row, updates);
        changed++;
      });
    } else {
      // Extract WHERE parameters (they come after the SET parameters)
      const whereParams = params.slice(updateParamCount);

      rows.forEach(row => {
        if (this.rowMatchesCondition(row, whereClause, whereParams)) {
          Object.assign(row, updates);
          changed++;
        }
      });
    }

    return { changes: changed };
  }

  private handleDelete(sql: string, params: unknown[]): DatabaseResult {
    const tableName = this.extractTableName(sql);
    const rows = this.inMemoryData.get(tableName) || [];
    const originalLength = rows.length;
    const whereClause = this.extractWhereClause(sql);

    if (!whereClause) {
      // Delete all if no WHERE clause
      this.inMemoryData.set(tableName, []);
      return { changes: originalLength };
    }

    const filtered = rows.filter(row => {
      return !this.rowMatchesCondition(row, whereClause, params);
    });

    this.inMemoryData.set(tableName, filtered);
    return { changes: originalLength - filtered.length };
  }

  private initializeTables(): void {
    // Initialize empty tables
    this.inMemoryData.set('votes', []);
    this.inMemoryData.set('content', []);
    this.inMemoryData.set('logs', []);
    this.idCounters.set('votes', 0);
    this.idCounters.set('content', 0);
    this.idCounters.set('logs', 0);
  }

  private generateId(tableName: string): number {
    const current = this.idCounters.get(tableName) || 0;
    const next = current + 1;
    this.idCounters.set(tableName, next);
    return next;
  }

  private extractTableName(sql: string): string {
    const fromMatch = sql.match(/(?:from|into|update)\s+(\w+)/i);
    return fromMatch ? fromMatch[1].toLowerCase() : 'unknown';
  }

  private extractWhereClause(sql: string): string | null {
    const match = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/i);
    return match ? match[1] : null;
  }

  private simulateQuery(sql: string, params: unknown[]): DatabaseRow[] {
    const lowerSql = sql.toLowerCase();
    const tableName = this.extractTableName(sql);
    let rows = [...(this.inMemoryData.get(tableName) || [])];

    // Handle SELECT COUNT (*)
    if (lowerSql.includes('count(*)')) {
      const groupByMatch = sql.match(/group\s+by\s+(\w+)/i);
      if (groupByMatch) {
        const groupColumn = groupByMatch[1];
        const grouped: Map<unknown, number> = new Map();

        rows.forEach(row => {
          const key = row[groupColumn];
          grouped.set(key, (grouped.get(key) || 0) + 1);
        });

        const result: DatabaseRow[] = [];
        grouped.forEach((count, key) => {
          result.push({ [groupColumn]: key, count });
        });
        return result;
      }
    }

    // Handle WHERE clause
    const whereClause = this.extractWhereClause(sql);
    if (whereClause) {
      rows = rows.filter(row => this.rowMatchesCondition(row, whereClause, params));
    }

    // Handle ORDER BY
    const orderMatch = sql.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
    if (orderMatch) {
      const column = orderMatch[1];
      const direction = (orderMatch[2] || 'asc').toLowerCase();
      rows.sort((a, b) => {
        const aVal = a[column] as unknown;
        const bVal = b[column] as unknown;
        if ((aVal as string | number | Date) < (bVal as string | number | Date))
          return direction === 'asc' ? -1 : 1;
        if ((aVal as string | number | Date) > (bVal as string | number | Date))
          return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Handle LIMIT - extract the actual limit value, not as parameter
    const limitMatch = sql.match(/limit\s+\?/i);
    let limitValue = 999999;
    if (limitMatch && params.length > 0) {
      // Last parameter is typically the limit when using ?
      const lastParam = params[params.length - 1];
      if (typeof lastParam === 'number') {
        limitValue = lastParam;
      }
    } else {
      const limitNumMatch = sql.match(/limit\s+(\d+)/i);
      if (limitNumMatch) {
        limitValue = parseInt(limitNumMatch[1], 10);
      }
    }

    if (limitValue < 999999) {
      rows = rows.slice(0, limitValue);
    }

    return rows;
  }

  private rowMatchesCondition(row: DatabaseRow, whereClause: string, params: unknown[]): boolean {
    // Split multiple AND conditions
    const conditions = whereClause.split(/\s+and\s+/i);

    for (const condition of conditions) {
      const trimmed = condition.trim();
      const lowerTrimmed = trimmed.toLowerCase();

      // Handle IS NOT NULL
      if (lowerTrimmed.includes('is not null')) {
        const columnMatch = trimmed.match(/(\w+)\s+is\s+not\s+null/i);
        if (columnMatch) {
          const column = columnMatch[1];
          if (row[column] === null || row[column] === undefined) {
            return false;
          }
          continue;
        }
      }

      // Handle IS NULL
      if (lowerTrimmed.includes('is null') && !lowerTrimmed.includes('is not null')) {
        const columnMatch = trimmed.match(/(\w+)\s+is\s+null/i);
        if (columnMatch) {
          const column = columnMatch[1];
          if (row[column] !== null && row[column] !== undefined) {
            return false;
          }
          continue;
        }
      }

      // Handle equality with parameterized queries
      const conditionMatch = trimmed.match(/(\w+)\s*=\s*\?/);
      if (conditionMatch) {
        const column = conditionMatch[1];
        const paramIndex = conditions.indexOf(condition);
        if (paramIndex < params.length) {
          if (row[column] !== params[paramIndex]) {
            return false;
          }
          continue;
        }
      }

      // Handle less than with parameterized queries
      const ltMatch = trimmed.match(/(\w+)\s*<\s*\?/);
      if (ltMatch) {
        const column = ltMatch[1];
        const paramIndex = conditions.indexOf(condition);
        if (paramIndex < params.length) {
          if (!((row[column] as unknown as string) < (params[paramIndex] as unknown as string))) {
            return false;
          }
          continue;
        }
      }
    }

    return true;
  }

  private buildRowFromInsert(
    sql: string,
    params: unknown[],
    defaults: Record<string, unknown>
  ): DatabaseRow {
    const match = sql.match(/insert\s+into\s+\w+\s*\(([^)]+)\)\s+values/i);
    if (!match) return defaults;

    const columns = match[1].split(',').map(col => col.trim());

    const row = { ...defaults };
    columns.forEach((col, idx) => {
      row[col] = params[idx];
    });

    return row;
  }

  private buildRowFromUpdate(sql: string, params: unknown[]): Record<string, unknown> {
    const match = sql.match(/update\s+\w+\s+set\s+(.+?)\s+(?:where|$)/i);
    if (!match) return {};

    const setClause = match[1];
    const updates: Record<string, unknown> = {};
    const setParts = setClause.split(',').map(s => s.trim());

    setParts.forEach((part, idx) => {
      const [column] = part.split('=').map(s => s.trim());
      updates[column] = params[idx];
    });

    return updates;
  }
}
