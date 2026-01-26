import { SessionRepository } from '../../../../src/storage/repositories/session-repo.js';
import { SessionModel } from '../../../../src/storage/models/session.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('SessionRepository', () => {
  let knex: Knex;
  let sessionModel: SessionModel;
  let sessionRepo: SessionRepository;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table manually instead of using migrations (avoids ES module import issues)
    // Uses snake_case column names to match migration 008_create_sessions_table.cjs
    const sessionsTableExists = await knex.schema.hasTable('sessions');
    if (!sessionsTableExists) {
      await knex.schema.createTable('sessions', table => {
        table.increments('id').primary();
        table.string('token', 255).notNullable().unique();
        table.integer('user_id').unsigned().notNullable();
        table.dateTime('expires_at').notNullable();
        table.dateTime('created_at').notNullable();
        table.dateTime('last_accessed_at').notNullable();
        table.json('data').nullable();

        // Indexes for common queries
        table.index('token', 'idx_session_token');
        table.index('user_id', 'idx_session_user_id');
        table.index('expires_at', 'idx_session_expires_at');
      });
    }
  });

  beforeEach(async () => {
    // Clean table data for isolated tests (table structure persists)
    await knex('sessions').del();
    sessionModel = new SessionModel(knex);
    sessionRepo = new SessionRepository(sessionModel);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('createSession', () => {
    test('should create a session and return it', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const result = await sessionRepo.createSession({
        token: 'repo-test-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      expect(result).not.toBeNull();
      expect(result?.token).toBe('repo-test-token');
      expect(result?.userId).toBe(1);
    });

    test('should create a session with data field', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const result = await sessionRepo.createSession({
        token: 'repo-data-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
        data: { browser: 'Chrome', os: 'macOS' },
      });

      expect(result?.data).toEqual({ browser: 'Chrome', os: 'macOS' });
    });

    test('should handle database errors gracefully and return null', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        create: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.createSession({
        token: 'fail-token',
        userId: 1,
        expiresAt: new Date(),
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      });

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create session'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getSessionByToken', () => {
    test('should find a session by token', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionRepo.createSession({
        token: 'find-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const found = await sessionRepo.getSessionByToken('find-token');

      expect(found).not.toBeNull();
      expect(found?.token).toBe('find-token');
    });

    test('should return null for nonexistent token', async () => {
      const found = await sessionRepo.getSessionByToken('nonexistent');

      expect(found).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByToken: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.getSessionByToken('any-token');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find session by token'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getValidSessionByToken', () => {
    test('should find a valid (non-expired) session by token', async () => {
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionRepo.createSession({
        token: 'valid-session-token',
        userId: 1,
        expiresAt: futureExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      const found = await sessionRepo.getValidSessionByToken('valid-session-token');

      expect(found).not.toBeNull();
      expect(found?.token).toBe('valid-session-token');
    });

    test('should return null for expired session', async () => {
      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 1000);

      await sessionRepo.createSession({
        token: 'expired-session-token',
        userId: 1,
        expiresAt: pastExpiry,
        createdAt: new Date(now.getTime() - 2000),
        lastAccessedAt: new Date(now.getTime() - 2000),
      });

      const found = await sessionRepo.getValidSessionByToken('expired-session-token');

      expect(found).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findValidByToken: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.getValidSessionByToken('any-token');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find valid session by token'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getUserSessions', () => {
    test('should return all sessions for a user', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionRepo.createSession({
        token: 'user-session-1',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionRepo.createSession({
        token: 'user-session-2',
        userId: 1,
        expiresAt,
        createdAt: new Date(now.getTime() + 1000),
        lastAccessedAt: new Date(now.getTime() + 1000),
      });

      const sessions = await sessionRepo.getUserSessions(1);

      expect(sessions).toHaveLength(2);
      expect(sessions.every(s => s.userId === 1)).toBe(true);
    });

    test('should return empty array when user has no sessions', async () => {
      const sessions = await sessionRepo.getUserSessions(999);

      expect(sessions).toEqual([]);
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByUserId: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.getUserSessions(1);

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find sessions for user'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('touchSession', () => {
    test('should update lastAccessedAt timestamp', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const created = await sessionRepo.createSession({
        token: 'touch-session-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const touched = await sessionRepo.touchSession(created!.id);

      expect(touched).not.toBeNull();
      // MySQL DATETIME drops milliseconds, so compare to second precision
      expect(Math.floor(touched!.lastAccessedAt.getTime() / 1000)).toBeGreaterThanOrEqual(
        Math.floor(now.getTime() / 1000)
      );
    });

    test('should return null for nonexistent session', async () => {
      const result = await sessionRepo.touchSession(99999);

      expect(result).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        touch: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.touchSession(1);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to touch session'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('deleteSession', () => {
    test('should delete a session by ID', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const created = await sessionRepo.createSession({
        token: 'delete-session-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deleted = await sessionRepo.deleteSession(created!.id);

      expect(deleted).toBe(true);

      const found = await sessionRepo.getSessionByToken('delete-session-token');
      expect(found).toBeNull();
    });

    test('should return false for nonexistent session', async () => {
      const deleted = await sessionRepo.deleteSession(99999);

      expect(deleted).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        delete: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.deleteSession(1);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete session'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('deleteSessionByToken', () => {
    test('should delete a session by token', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionRepo.createSession({
        token: 'delete-by-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deleted = await sessionRepo.deleteSessionByToken('delete-by-token');

      expect(deleted).toBe(true);

      const found = await sessionRepo.getSessionByToken('delete-by-token');
      expect(found).toBeNull();
    });

    test('should return false for nonexistent token', async () => {
      const deleted = await sessionRepo.deleteSessionByToken('nonexistent');

      expect(deleted).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        deleteByToken: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.deleteSessionByToken('any-token');

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete session by token'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('deleteUserSessions', () => {
    test('should delete all sessions for a user', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionRepo.createSession({
        token: 'user1-sess-a',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionRepo.createSession({
        token: 'user1-sess-b',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionRepo.createSession({
        token: 'user2-sess-a',
        userId: 2,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deletedCount = await sessionRepo.deleteUserSessions(1);

      expect(deletedCount).toBe(2);

      const user1Sessions = await sessionRepo.getUserSessions(1);
      expect(user1Sessions).toHaveLength(0);

      const user2Sessions = await sessionRepo.getUserSessions(2);
      expect(user2Sessions).toHaveLength(1);
    });

    test('should return 0 when user has no sessions', async () => {
      const deletedCount = await sessionRepo.deleteUserSessions(999);

      expect(deletedCount).toBe(0);
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        deleteByUserId: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.deleteUserSessions(1);

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete user sessions'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('cleanupExpiredSessions', () => {
    test('should delete all expired sessions', async () => {
      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 1000);
      const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionRepo.createSession({
        token: 'expired-sess',
        userId: 1,
        expiresAt: pastExpiry,
        createdAt: new Date(now.getTime() - 2000),
        lastAccessedAt: new Date(now.getTime() - 2000),
      });

      await sessionRepo.createSession({
        token: 'valid-sess',
        userId: 1,
        expiresAt: futureExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deletedCount = await sessionRepo.cleanupExpiredSessions();

      expect(deletedCount).toBe(1);

      const validSession = await sessionRepo.getSessionByToken('valid-sess');
      expect(validSession).not.toBeNull();
    });

    test('should log cleanup results when sessions are deleted', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 1000);

      await sessionRepo.createSession({
        token: 'expired-log-test',
        userId: 1,
        expiresAt: pastExpiry,
        createdAt: new Date(now.getTime() - 2000),
        lastAccessedAt: new Date(now.getTime() - 2000),
      });

      await sessionRepo.cleanupExpiredSessions();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session cleanup: deleted 1 expired session')
      );

      consoleSpy.mockRestore();
    });

    test('should not log when no sessions are deleted', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await sessionRepo.cleanupExpiredSessions();

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Session cleanup'));

      consoleSpy.mockRestore();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        deleteExpired: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.cleanupExpiredSessions();

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session cleanup failed'),
        expect.any(String)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('extendSession', () => {
    test('should extend session expiration', async () => {
      const now = new Date();
      const initialExpiry = new Date(now.getTime() + 1 * 60 * 60 * 1000);

      const created = await sessionRepo.createSession({
        token: 'extend-session-token',
        userId: 1,
        expiresAt: initialExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      const extensionMs = 24 * 60 * 60 * 1000;
      const extended = await sessionRepo.extendSession(created!.id, extensionMs);

      expect(extended).not.toBeNull();
      const expectedMinExpiry = now.getTime() + extensionMs - 5000;
      expect(extended!.expiresAt.getTime()).toBeGreaterThan(expectedMinExpiry);
    });

    test('should return null for nonexistent session', async () => {
      const result = await sessionRepo.extendSession(99999, 3600000);

      expect(result).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        extendExpiration: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.extendSession(1, 3600000);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extend session'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('countUserSessions', () => {
    test('should count sessions for a user', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionRepo.createSession({
        token: 'count-sess-1',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionRepo.createSession({
        token: 'count-sess-2',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const count = await sessionRepo.countUserSessions(1);

      expect(count).toBe(2);
    });

    test('should return 0 when user has no sessions', async () => {
      const count = await sessionRepo.countUserSessions(999);

      expect(count).toBe(0);
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        countByUserId: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.countUserSessions(1);

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to count user sessions'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('updateSessionData', () => {
    test('should update session data field', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const created = await sessionRepo.createSession({
        token: 'update-data-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
        data: { initial: true },
      });

      const updated = await sessionRepo.updateSessionData(created!.id, {
        initial: true,
        newField: 'added',
      });

      expect(updated).not.toBeNull();
      expect(updated?.data).toEqual({ initial: true, newField: 'added' });
    });

    test('should return null for nonexistent session', async () => {
      const result = await sessionRepo.updateSessionData(99999, { test: true });

      expect(result).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        update: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new SessionRepository(mockModel as unknown as SessionModel);
      const result = await failingRepo.updateSessionData(1, { test: true });

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update session data'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
