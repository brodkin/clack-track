import { SessionModel } from '../../../../src/storage/models/session.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('SessionModel', () => {
  let knex: Knex;
  let sessionModel: SessionModel;

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
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('create', () => {
    test('should create a session record with all required fields', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      const sessionData = {
        token: 'test-session-token-abc123',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      };

      const result = await sessionModel.create(sessionData);

      expect(result).toMatchObject({
        token: 'test-session-token-abc123',
        userId: 1,
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toEqual(now);
      expect(result.expiresAt).toEqual(expiresAt);
      expect(result.lastAccessedAt).toEqual(now);
    });

    test('should create a session record with JSON data field', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const sessionData = {
        token: 'token-with-data',
        userId: 2,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
        data: {
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
          loginMethod: 'passkey',
        },
      };

      const result = await sessionModel.create(sessionData);

      expect(result.data).toEqual({
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        loginMethod: 'passkey',
      });
    });

    test('should create a session without data field', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const sessionData = {
        token: 'token-no-data',
        userId: 3,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      };

      const result = await sessionModel.create(sessionData);

      expect(result.data).toBeUndefined();
    });

    test('should generate unique IDs for each session', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const session1 = await sessionModel.create({
        token: 'token-1',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const session2 = await sessionModel.create({
        token: 'token-2',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      expect(session1.id).not.toBe(session2.id);
    });

    test('should reject duplicate tokens', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionModel.create({
        token: 'duplicate-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await expect(
        sessionModel.create({
          token: 'duplicate-token',
          userId: 2,
          expiresAt,
          createdAt: now,
          lastAccessedAt: now,
        })
      ).rejects.toThrow();
    });
  });

  describe('findByToken', () => {
    test('should find a session record by token', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const created = await sessionModel.create({
        token: 'find-me-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const found = await sessionModel.findByToken('find-me-token');

      expect(found).toMatchObject({
        id: created.id,
        token: 'find-me-token',
        userId: 1,
      });
    });

    test('should return null for nonexistent token', async () => {
      const found = await sessionModel.findByToken('nonexistent-token');

      expect(found).toBeNull();
    });

    test('should include data field when present', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await sessionModel.create({
        token: 'token-with-metadata',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
        data: { device: 'iPhone' },
      });

      const found = await sessionModel.findByToken('token-with-metadata');

      expect(found?.data).toEqual({ device: 'iPhone' });
    });
  });

  describe('findByUserId', () => {
    test('should find all sessions for a user', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionModel.create({
        token: 'user1-session1',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionModel.create({
        token: 'user1-session2',
        userId: 1,
        expiresAt,
        createdAt: new Date(now.getTime() + 1000),
        lastAccessedAt: new Date(now.getTime() + 1000),
      });

      await sessionModel.create({
        token: 'user2-session1',
        userId: 2,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const results = await sessionModel.findByUserId(1);

      expect(results).toHaveLength(2);
      expect(results.every(s => s.userId === 1)).toBe(true);
    });

    test('should return sessions ordered by createdAt descending', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionModel.create({
        token: 'older-session',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionModel.create({
        token: 'newer-session',
        userId: 1,
        expiresAt,
        createdAt: new Date(now.getTime() + 1000),
        lastAccessedAt: new Date(now.getTime() + 1000),
      });

      const results = await sessionModel.findByUserId(1);

      expect(results[0].token).toBe('newer-session');
      expect(results[1].token).toBe('older-session');
    });

    test('should return empty array when user has no sessions', async () => {
      const results = await sessionModel.findByUserId(999);

      expect(results).toEqual([]);
    });
  });

  describe('update', () => {
    test('should update session lastAccessedAt', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const created = await sessionModel.create({
        token: 'update-test-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const newAccessTime = new Date(now.getTime() + 3600000); // 1 hour later
      const updated = await sessionModel.update(created.id, {
        lastAccessedAt: newAccessTime,
      });

      // MySQL DATETIME drops milliseconds, so compare to second precision
      expect(Math.floor(updated!.lastAccessedAt.getTime() / 1000)).toBe(
        Math.floor(newAccessTime.getTime() / 1000)
      );
    });

    test('should update session data field', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const created = await sessionModel.create({
        token: 'update-data-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
        data: { initial: true },
      });

      const updated = await sessionModel.update(created.id, {
        data: { initial: true, updated: true, count: 5 },
      });

      expect(updated?.data).toEqual({ initial: true, updated: true, count: 5 });
    });

    test('should update session expiresAt', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const created = await sessionModel.create({
        token: 'update-expiry-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const newExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
      const updated = await sessionModel.update(created.id, {
        expiresAt: newExpiresAt,
      });

      // MySQL DATETIME drops milliseconds, so compare to second precision
      expect(Math.floor(updated!.expiresAt.getTime() / 1000)).toBe(
        Math.floor(newExpiresAt.getTime() / 1000)
      );
    });

    test('should return null for nonexistent session ID', async () => {
      const result = await sessionModel.update(99999, {
        lastAccessedAt: new Date(),
      });

      expect(result).toBeNull();
    });
  });

  describe('touch', () => {
    test('should update lastAccessedAt to current time', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const created = await sessionModel.create({
        token: 'touch-test-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      // Simulate time passing
      const touched = await sessionModel.touch(created.id);

      expect(touched).not.toBeNull();
      // MySQL DATETIME drops milliseconds, so compare to second precision
      // The touched time should be >= the creation time (in seconds)
      expect(Math.floor(touched!.lastAccessedAt.getTime() / 1000)).toBeGreaterThanOrEqual(
        Math.floor(now.getTime() / 1000)
      );
    });

    test('should return null for nonexistent session ID', async () => {
      const result = await sessionModel.touch(99999);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    test('should delete a session by ID', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const created = await sessionModel.create({
        token: 'delete-test-token',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deleteResult = await sessionModel.delete(created.id);
      expect(deleteResult).toBe(true);

      const found = await sessionModel.findByToken('delete-test-token');
      expect(found).toBeNull();
    });

    test('should return false when deleting nonexistent session', async () => {
      const result = await sessionModel.delete(99999);

      expect(result).toBe(false);
    });
  });

  describe('deleteByToken', () => {
    test('should delete a session by token', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await sessionModel.create({
        token: 'delete-by-token-test',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deleteResult = await sessionModel.deleteByToken('delete-by-token-test');
      expect(deleteResult).toBe(true);

      const found = await sessionModel.findByToken('delete-by-token-test');
      expect(found).toBeNull();
    });

    test('should return false when deleting nonexistent token', async () => {
      const result = await sessionModel.deleteByToken('nonexistent-token');

      expect(result).toBe(false);
    });
  });

  describe('deleteByUserId', () => {
    test('should delete all sessions for a user', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionModel.create({
        token: 'user1-session-a',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionModel.create({
        token: 'user1-session-b',
        userId: 1,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionModel.create({
        token: 'user2-session-a',
        userId: 2,
        expiresAt,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deletedCount = await sessionModel.deleteByUserId(1);

      expect(deletedCount).toBe(2);

      const user1Sessions = await sessionModel.findByUserId(1);
      expect(user1Sessions).toHaveLength(0);

      const user2Sessions = await sessionModel.findByUserId(2);
      expect(user2Sessions).toHaveLength(1);
    });

    test('should return 0 when user has no sessions', async () => {
      const deletedCount = await sessionModel.deleteByUserId(999);

      expect(deletedCount).toBe(0);
    });
  });

  describe('deleteExpired', () => {
    test('should delete all expired sessions', async () => {
      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 1000); // Already expired
      const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Still valid

      await sessionModel.create({
        token: 'expired-session',
        userId: 1,
        expiresAt: pastExpiry,
        createdAt: new Date(now.getTime() - 2000),
        lastAccessedAt: new Date(now.getTime() - 2000),
      });

      await sessionModel.create({
        token: 'valid-session',
        userId: 1,
        expiresAt: futureExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deletedCount = await sessionModel.deleteExpired();

      expect(deletedCount).toBe(1);

      const validSession = await sessionModel.findByToken('valid-session');
      expect(validSession).not.toBeNull();

      const expiredSession = await sessionModel.findByToken('expired-session');
      expect(expiredSession).toBeNull();
    });

    test('should return 0 when no sessions are expired', async () => {
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionModel.create({
        token: 'valid-session-1',
        userId: 1,
        expiresAt: futureExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      const deletedCount = await sessionModel.deleteExpired();

      expect(deletedCount).toBe(0);
    });

    test('should handle empty database', async () => {
      const deletedCount = await sessionModel.deleteExpired();

      expect(deletedCount).toBe(0);
    });

    test('should delete multiple expired sessions', async () => {
      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 1000);

      for (let i = 0; i < 5; i++) {
        await sessionModel.create({
          token: `expired-session-${i}`,
          userId: 1,
          expiresAt: pastExpiry,
          createdAt: new Date(now.getTime() - 2000),
          lastAccessedAt: new Date(now.getTime() - 2000),
        });
      }

      const deletedCount = await sessionModel.deleteExpired();

      expect(deletedCount).toBe(5);
    });
  });

  describe('findValidByToken', () => {
    test('should find non-expired session by token', async () => {
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionModel.create({
        token: 'valid-token',
        userId: 1,
        expiresAt: futureExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      const found = await sessionModel.findValidByToken('valid-token');

      expect(found).not.toBeNull();
      expect(found?.token).toBe('valid-token');
    });

    test('should return null for expired session', async () => {
      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 1000);

      await sessionModel.create({
        token: 'expired-token',
        userId: 1,
        expiresAt: pastExpiry,
        createdAt: new Date(now.getTime() - 2000),
        lastAccessedAt: new Date(now.getTime() - 2000),
      });

      const found = await sessionModel.findValidByToken('expired-token');

      expect(found).toBeNull();
    });

    test('should return null for nonexistent token', async () => {
      const found = await sessionModel.findValidByToken('does-not-exist');

      expect(found).toBeNull();
    });
  });

  describe('countByUserId', () => {
    test('should count active sessions for a user', async () => {
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await sessionModel.create({
        token: 'session-1',
        userId: 1,
        expiresAt: futureExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionModel.create({
        token: 'session-2',
        userId: 1,
        expiresAt: futureExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      await sessionModel.create({
        token: 'session-3',
        userId: 2,
        expiresAt: futureExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      const count = await sessionModel.countByUserId(1);

      expect(count).toBe(2);
    });

    test('should return 0 when user has no sessions', async () => {
      const count = await sessionModel.countByUserId(999);

      expect(count).toBe(0);
    });
  });

  describe('extendExpiration', () => {
    test('should extend session expiration by specified duration', async () => {
      const now = new Date();
      const initialExpiry = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour

      const created = await sessionModel.create({
        token: 'extend-test-token',
        userId: 1,
        expiresAt: initialExpiry,
        createdAt: now,
        lastAccessedAt: now,
      });

      const extensionMs = 24 * 60 * 60 * 1000; // 24 hours
      const extended = await sessionModel.extendExpiration(created.id, extensionMs);

      expect(extended).not.toBeNull();
      // New expiry should be roughly now + extension (allowing some test execution time)
      const expectedMinExpiry = now.getTime() + extensionMs - 5000;
      expect(extended!.expiresAt.getTime()).toBeGreaterThan(expectedMinExpiry);
    });

    test('should return null for nonexistent session', async () => {
      const result = await sessionModel.extendExpiration(99999, 3600000);

      expect(result).toBeNull();
    });
  });
});
