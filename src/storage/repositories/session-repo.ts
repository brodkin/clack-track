/**
 * SessionRepository - Repository pattern for session persistence
 *
 * Wraps SessionModel with graceful error handling following fire-and-forget pattern.
 * Database errors are logged but don't block authentication flows.
 *
 * @module storage/repositories
 */

import { SessionModel, SessionRecord } from '../models/session.js';

/**
 * Repository for session records with graceful degradation
 *
 * All methods handle database errors gracefully:
 * - create/update operations log errors and return null
 * - fetch operations return null/empty arrays on errors
 * - Application continues to function without database
 *
 * @example
 * ```typescript
 * const repository = new SessionRepository(sessionModel);
 *
 * // Create session (returns null on error)
 * const session = await repository.createSession({
 *   token: 'abc123',
 *   userId: 1,
 *   expiresAt: new Date(Date.now() + 86400000),
 *   createdAt: new Date(),
 *   lastAccessedAt: new Date()
 * });
 *
 * // Validate and touch session
 * const valid = await repository.getValidSessionByToken('abc123');
 * if (valid) {
 *   await repository.touchSession(valid.id);
 * }
 * ```
 */
export class SessionRepository {
  private model: SessionModel;

  constructor(model: SessionModel) {
    this.model = model;
  }

  /**
   * Create a new session
   *
   * @param session - Session data without ID
   * @returns Created session or null on error
   */
  async createSession(session: Omit<SessionRecord, 'id'>): Promise<SessionRecord | null> {
    try {
      return await this.model.create(session);
    } catch (error) {
      console.warn('Failed to create session:', error);
      return null;
    }
  }

  /**
   * Get session by token (regardless of expiration)
   *
   * @param token - Session token
   * @returns Session record or null
   */
  async getSessionByToken(token: string): Promise<SessionRecord | null> {
    try {
      return await this.model.findByToken(token);
    } catch (error) {
      console.warn('Failed to find session by token:', error);
      return null;
    }
  }

  /**
   * Get valid (non-expired) session by token
   * This is the primary method for session validation
   *
   * @param token - Session token
   * @returns Valid session or null if expired/not found
   */
  async getValidSessionByToken(token: string): Promise<SessionRecord | null> {
    try {
      return await this.model.findValidByToken(token);
    } catch (error) {
      console.warn('Failed to find valid session by token:', error);
      return null;
    }
  }

  /**
   * Get all sessions for a user
   *
   * @param userId - User ID
   * @returns Array of sessions (empty on error)
   */
  async getUserSessions(userId: number): Promise<SessionRecord[]> {
    try {
      return await this.model.findByUserId(userId);
    } catch (error) {
      console.warn('Failed to find sessions for user:', error);
      return [];
    }
  }

  /**
   * Touch session to update lastAccessedAt
   * Call this on each authenticated request to track activity
   *
   * @param sessionId - Session ID
   * @returns Updated session or null
   */
  async touchSession(sessionId: number): Promise<SessionRecord | null> {
    try {
      return await this.model.touch(sessionId);
    } catch (error) {
      console.warn('Failed to touch session:', error);
      return null;
    }
  }

  /**
   * Delete a session by ID
   *
   * @param sessionId - Session ID
   * @returns true if deleted, false otherwise
   */
  async deleteSession(sessionId: number): Promise<boolean> {
    try {
      return await this.model.delete(sessionId);
    } catch (error) {
      console.warn('Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Delete a session by token (for logout)
   *
   * @param token - Session token
   * @returns true if deleted, false otherwise
   */
  async deleteSessionByToken(token: string): Promise<boolean> {
    try {
      return await this.model.deleteByToken(token);
    } catch (error) {
      console.warn('Failed to delete session by token:', error);
      return false;
    }
  }

  /**
   * Delete all sessions for a user (for security actions like password reset)
   *
   * @param userId - User ID
   * @returns Number of sessions deleted
   */
  async deleteUserSessions(userId: number): Promise<number> {
    try {
      return await this.model.deleteByUserId(userId);
    } catch (error) {
      console.warn('Failed to delete user sessions:', error);
      return 0;
    }
  }

  /**
   * Cleanup expired sessions
   * Should be called periodically (e.g., via cron)
   *
   * @returns Number of expired sessions deleted
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const deleted = await this.model.deleteExpired();
      if (deleted > 0) {
        console.log(`Session cleanup: deleted ${deleted} expired session(s)`);
      }
      return deleted;
    } catch (error) {
      console.warn('Session cleanup failed:', error instanceof Error ? error.message : error);
      return 0;
    }
  }

  /**
   * Extend session expiration
   * Useful for sliding session windows
   *
   * @param sessionId - Session ID
   * @param extensionMs - Duration to extend in milliseconds
   * @returns Updated session or null
   */
  async extendSession(sessionId: number, extensionMs: number): Promise<SessionRecord | null> {
    try {
      return await this.model.extendExpiration(sessionId, extensionMs);
    } catch (error) {
      console.warn('Failed to extend session:', error);
      return null;
    }
  }

  /**
   * Count active sessions for a user
   * Useful for session limits
   *
   * @param userId - User ID
   * @returns Number of active sessions
   */
  async countUserSessions(userId: number): Promise<number> {
    try {
      return await this.model.countByUserId(userId);
    } catch (error) {
      console.warn('Failed to count user sessions:', error);
      return 0;
    }
  }

  /**
   * Update session data field
   *
   * @param sessionId - Session ID
   * @param data - New data object
   * @returns Updated session or null
   */
  async updateSessionData(
    sessionId: number,
    data: Record<string, unknown>
  ): Promise<SessionRecord | null> {
    try {
      return await this.model.update(sessionId, { data });
    } catch (error) {
      console.warn('Failed to update session data:', error);
      return null;
    }
  }
}
