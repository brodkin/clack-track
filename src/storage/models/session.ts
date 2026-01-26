import { Knex } from 'knex';

/**
 * Represents a session record in the database
 * Sessions track authenticated user sessions with expiration handling
 */
export interface SessionRecord {
  id: number;
  token: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
  data?: Record<string, unknown>;
}

/**
 * SessionModel handles database operations for session records
 * Manages user authentication sessions with expiration and cleanup support
 */
export class SessionModel {
  /**
   * Standard SELECT fields for session records
   * Uses snake_case to match database column names
   */
  private static readonly SELECT_FIELDS = [
    'id',
    'token',
    'user_id',
    'expires_at',
    'created_at',
    'last_accessed_at',
    'data',
  ];

  constructor(private knex: Knex) {}

  /**
   * Convert JavaScript Date to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
   * MySQL DATETIME does not support ISO format with 'T' separator or milliseconds
   */
  private toMySQLDateTime(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  /**
   * Create a new session record in the database
   *
   * @param session - Session data (without id)
   * @returns Created session record with ID
   * @throws Error if token already exists or database error
   */
  async create(session: Omit<SessionRecord, 'id'>): Promise<SessionRecord> {
    const dataJson = session.data ? JSON.stringify(session.data) : null;

    const [id] = await this.knex('sessions').insert({
      token: session.token,
      user_id: session.userId,
      expires_at: this.toMySQLDateTime(session.expiresAt),
      created_at: this.toMySQLDateTime(session.createdAt),
      last_accessed_at: this.toMySQLDateTime(session.lastAccessedAt),
      data: dataJson,
    });

    if (!id) {
      throw new Error('Failed to create session record');
    }

    return {
      id,
      token: session.token,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      data: session.data,
    };
  }

  /**
   * Find a session record by token
   *
   * @param token - The session token to search for
   * @returns Session record or null if not found
   */
  async findByToken(token: string): Promise<SessionRecord | null> {
    const row = await this.knex('sessions')
      .select(SessionModel.SELECT_FIELDS)
      .where('token', token)
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToSessionRecord(row);
  }

  /**
   * Find a valid (non-expired) session by token
   *
   * @param token - The session token to search for
   * @returns Session record if valid and not expired, null otherwise
   */
  async findValidByToken(token: string): Promise<SessionRecord | null> {
    const now = new Date();

    const row = await this.knex('sessions')
      .select(SessionModel.SELECT_FIELDS)
      .where('token', token)
      .where('expires_at', '>', this.toMySQLDateTime(now))
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToSessionRecord(row);
  }

  /**
   * Find all sessions for a user
   *
   * @param userId - The user ID to search for
   * @returns Array of session records, ordered by createdAt descending
   */
  async findByUserId(userId: number): Promise<SessionRecord[]> {
    const rows = await this.knex('sessions')
      .select(SessionModel.SELECT_FIELDS)
      .where('user_id', userId)
      .orderBy('created_at', 'desc');

    return rows.map(row => this.mapRowToSessionRecord(row));
  }

  /**
   * Update session fields
   *
   * @param id - Session ID to update
   * @param updates - Fields to update (lastAccessedAt, expiresAt, data)
   * @returns Updated session record or null if not found
   */
  async update(
    id: number,
    updates: Partial<Pick<SessionRecord, 'lastAccessedAt' | 'expiresAt' | 'data'>>
  ): Promise<SessionRecord | null> {
    const updateData: Record<string, unknown> = {};

    if (updates.lastAccessedAt) {
      updateData.last_accessed_at = this.toMySQLDateTime(updates.lastAccessedAt);
    }

    if (updates.expiresAt) {
      updateData.expires_at = this.toMySQLDateTime(updates.expiresAt);
    }

    if (updates.data !== undefined) {
      updateData.data = JSON.stringify(updates.data);
    }

    const affectedRows = await this.knex('sessions').where('id', id).update(updateData);

    if (affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  /**
   * Update session lastAccessedAt to current time
   * Convenience method for session activity tracking
   *
   * @param id - Session ID to touch
   * @returns Updated session record or null if not found
   */
  async touch(id: number): Promise<SessionRecord | null> {
    return this.update(id, { lastAccessedAt: new Date() });
  }

  /**
   * Extend session expiration by specified duration
   *
   * @param id - Session ID to extend
   * @param extensionMs - Duration to extend in milliseconds
   * @returns Updated session record or null if not found
   */
  async extendExpiration(id: number, extensionMs: number): Promise<SessionRecord | null> {
    const newExpiresAt = new Date(Date.now() + extensionMs);
    return this.update(id, { expiresAt: newExpiresAt });
  }

  /**
   * Delete a session by ID
   *
   * @param id - Session ID to delete
   * @returns true if session was deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    const deletedCount = await this.knex('sessions').where('id', id).del();
    return deletedCount > 0;
  }

  /**
   * Delete a session by token
   *
   * @param token - Session token to delete
   * @returns true if session was deleted, false if not found
   */
  async deleteByToken(token: string): Promise<boolean> {
    const deletedCount = await this.knex('sessions').where('token', token).del();
    return deletedCount > 0;
  }

  /**
   * Delete all sessions for a user
   *
   * @param userId - User ID whose sessions to delete
   * @returns Number of sessions deleted
   */
  async deleteByUserId(userId: number): Promise<number> {
    const deletedCount = await this.knex('sessions').where('user_id', userId).del();
    return deletedCount;
  }

  /**
   * Delete all expired sessions
   * Used for periodic session cleanup
   *
   * @returns Number of expired sessions deleted
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const deletedCount = await this.knex('sessions')
      .where('expires_at', '<', this.toMySQLDateTime(now))
      .del();
    return deletedCount;
  }

  /**
   * Count sessions for a user
   *
   * @param userId - User ID to count sessions for
   * @returns Number of active sessions
   */
  async countByUserId(userId: number): Promise<number> {
    const result = await this.knex('sessions')
      .where('user_id', userId)
      .count('id as count')
      .first();

    if (!result || result.count === null) {
      return 0;
    }

    return Number(result.count);
  }

  /**
   * Find a session by ID (internal helper)
   */
  private async findById(id: number): Promise<SessionRecord | null> {
    const row = await this.knex('sessions')
      .select(SessionModel.SELECT_FIELDS)
      .where('id', id)
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToSessionRecord(row);
  }

  /**
   * Map database row to SessionRecord
   * Converts snake_case database columns to camelCase for TypeScript interface
   */
  private mapRowToSessionRecord(row: Record<string, unknown>): SessionRecord {
    let data: Record<string, unknown> | undefined;
    try {
      const dataStr = row.data as string | null;
      if (dataStr) {
        data = JSON.parse(dataStr);
      }
    } catch {
      // If data parsing fails, leave it undefined
    }

    return {
      id: row.id as number,
      token: row.token as string,
      userId: row.user_id as number,
      expiresAt: new Date(row.expires_at as string | Date),
      createdAt: new Date(row.created_at as string | Date),
      lastAccessedAt: new Date(row.last_accessed_at as string | Date),
      data,
    };
  }
}
