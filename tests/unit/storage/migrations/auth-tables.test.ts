/**
 * Tests for authentication database migrations (users and sessions tables)
 *
 * These tests verify:
 * - Migration 007: users table creation with proper schema
 * - Migration 008: sessions table creation with foreign key to users
 * - Rollback functionality for both migrations
 * - Index creation and constraints
 */
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

// Import migrations using require (CommonJS modules)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const usersMigration = require('../../../../migrations/007_create_users_table.cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sessionsMigration = require('../../../../migrations/008_create_sessions_table.cjs');

describe('Authentication Tables Migrations', () => {
  let knex: Knex;

  beforeAll(async () => {
    // Reset singleton to ensure clean state
    resetKnexInstance();
    knex = getKnexInstance();
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('Migration 007: Create users table', () => {
    beforeEach(async () => {
      // Clean up tables if they exist from previous test runs
      await knex.schema.dropTableIfExists('sessions');
      await knex.schema.dropTableIfExists('users');
    });

    afterEach(async () => {
      // Clean up after each test
      await knex.schema.dropTableIfExists('sessions');
      await knex.schema.dropTableIfExists('users');
    });

    describe('up migration', () => {
      it('should create users table', async () => {
        await usersMigration.up(knex);

        const exists = await knex.schema.hasTable('users');
        expect(exists).toBe(true);
      });

      it('should create users table with id column as primary key', async () => {
        await usersMigration.up(knex);

        const columns = await knex.raw(
          "SELECT name, type FROM pragma_table_info('users') WHERE pk = 1"
        );
        expect(columns[0]?.name).toBe('id');
      });

      it('should create users table with email column', async () => {
        await usersMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('users', 'email');
        expect(hasColumn).toBe(true);
      });

      it('should create users table with name column', async () => {
        await usersMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('users', 'name');
        expect(hasColumn).toBe(true);
      });

      it('should create users table with created_at column', async () => {
        await usersMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('users', 'created_at');
        expect(hasColumn).toBe(true);
      });

      it('should create users table with updated_at column', async () => {
        await usersMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('users', 'updated_at');
        expect(hasColumn).toBe(true);
      });

      it('should enforce unique constraint on email', async () => {
        await usersMigration.up(knex);

        // Insert first user
        await knex('users').insert({
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Attempt to insert duplicate email should fail
        await expect(
          knex('users').insert({
            email: 'test@example.com',
            name: 'Another User',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });

      it('should allow null name', async () => {
        await usersMigration.up(knex);

        // Insert user without name
        const [id] = await knex('users').insert({
          email: 'test@example.com',
          name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        const user = await knex('users').where('id', id).first();
        expect(user.name).toBeNull();
      });

      it('should require email', async () => {
        await usersMigration.up(knex);

        // Attempt to insert without email should fail
        await expect(
          knex('users').insert({
            name: 'Test User',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });
    });

    describe('down migration', () => {
      it('should drop users table', async () => {
        // First create the table
        await usersMigration.up(knex);
        let exists = await knex.schema.hasTable('users');
        expect(exists).toBe(true);

        // Then drop it
        await usersMigration.down(knex);
        exists = await knex.schema.hasTable('users');
        expect(exists).toBe(false);
      });
    });
  });

  describe('Migration 008: Create sessions table', () => {
    beforeEach(async () => {
      // Clean up and set up dependencies
      await knex.schema.dropTableIfExists('sessions');
      await knex.schema.dropTableIfExists('users');

      // Create users table first (dependency)
      await usersMigration.up(knex);
    });

    afterEach(async () => {
      await knex.schema.dropTableIfExists('sessions');
      await knex.schema.dropTableIfExists('users');
    });

    describe('up migration', () => {
      it('should create sessions table', async () => {
        await sessionsMigration.up(knex);

        const exists = await knex.schema.hasTable('sessions');
        expect(exists).toBe(true);
      });

      it('should create sessions table with id column as primary key', async () => {
        await sessionsMigration.up(knex);

        const columns = await knex.raw(
          "SELECT name, type FROM pragma_table_info('sessions') WHERE pk = 1"
        );
        expect(columns[0]?.name).toBe('id');
      });

      it('should create sessions table with user_id column', async () => {
        await sessionsMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('sessions', 'user_id');
        expect(hasColumn).toBe(true);
      });

      it('should create sessions table with token column', async () => {
        await sessionsMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('sessions', 'token');
        expect(hasColumn).toBe(true);
      });

      it('should create sessions table with expires_at column', async () => {
        await sessionsMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('sessions', 'expires_at');
        expect(hasColumn).toBe(true);
      });

      it('should create sessions table with created_at column', async () => {
        await sessionsMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('sessions', 'created_at');
        expect(hasColumn).toBe(true);
      });

      it('should create sessions table with data column', async () => {
        await sessionsMigration.up(knex);

        const hasColumn = await knex.schema.hasColumn('sessions', 'data');
        expect(hasColumn).toBe(true);
      });

      it('should allow null user_id for anonymous sessions', async () => {
        await sessionsMigration.up(knex);

        // Insert session without user_id (anonymous session)
        const token = 'test-token-anonymous';
        const [id] = await knex('sessions').insert({
          user_id: null,
          token,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
        });

        const session = await knex('sessions').where('id', id).first();
        expect(session.user_id).toBeNull();
        expect(session.token).toBe(token);
      });

      it('should link session to user via foreign key', async () => {
        await sessionsMigration.up(knex);

        // Create a user first
        const [userId] = await knex('users').insert({
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Create session linked to user
        const token = 'test-token-user';
        const [sessionId] = await knex('sessions').insert({
          user_id: userId,
          token,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
        });

        const session = await knex('sessions').where('id', sessionId).first();
        expect(session.user_id).toBe(userId);
      });

      it('should require token', async () => {
        await sessionsMigration.up(knex);

        // Attempt to insert without token should fail
        await expect(
          knex('sessions').insert({
            user_id: null,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            created_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });

      it('should require expires_at', async () => {
        await sessionsMigration.up(knex);

        // Attempt to insert without expires_at should fail
        await expect(
          knex('sessions').insert({
            user_id: null,
            token: 'test-token',
            created_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });

      it('should allow storing JSON data in data column', async () => {
        await sessionsMigration.up(knex);

        const sessionData = { userAgent: 'Mozilla/5.0', ip: '127.0.0.1' };
        const [id] = await knex('sessions').insert({
          user_id: null,
          token: 'test-token',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
          data: JSON.stringify(sessionData),
        });

        const session = await knex('sessions').where('id', id).first();
        expect(JSON.parse(session.data)).toEqual(sessionData);
      });

      it('should enforce unique constraint on token', async () => {
        await sessionsMigration.up(knex);

        const token = 'unique-test-token';

        // Insert first session
        await knex('sessions').insert({
          user_id: null,
          token,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
        });

        // Attempt to insert duplicate token should fail (unique constraint)
        await expect(
          knex('sessions').insert({
            user_id: null,
            token,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            created_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });
    });

    describe('down migration', () => {
      it('should drop sessions table', async () => {
        // First create the table
        await sessionsMigration.up(knex);
        let exists = await knex.schema.hasTable('sessions');
        expect(exists).toBe(true);

        // Then drop it
        await sessionsMigration.down(knex);
        exists = await knex.schema.hasTable('sessions');
        expect(exists).toBe(false);
      });
    });

    describe('foreign key behavior', () => {
      it('should delete sessions when user is deleted (CASCADE)', async () => {
        await sessionsMigration.up(knex);

        // Enable foreign keys in SQLite
        await knex.raw('PRAGMA foreign_keys = ON');

        // Create a user
        const [userId] = await knex('users').insert({
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Create session linked to user
        await knex('sessions').insert({
          user_id: userId,
          token: 'test-token',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
        });

        // Verify session exists
        let sessions = await knex('sessions').where('user_id', userId);
        expect(sessions).toHaveLength(1);

        // Delete user
        await knex('users').where('id', userId).del();

        // Verify session is also deleted
        sessions = await knex('sessions').where('user_id', userId);
        expect(sessions).toHaveLength(0);
      });
    });
  });

  describe('Index verification', () => {
    beforeEach(async () => {
      await knex.schema.dropTableIfExists('sessions');
      await knex.schema.dropTableIfExists('users');

      await usersMigration.up(knex);
      await sessionsMigration.up(knex);
    });

    afterEach(async () => {
      await knex.schema.dropTableIfExists('sessions');
      await knex.schema.dropTableIfExists('users');
    });

    it('should have unique index on users.email', async () => {
      // Test by attempting duplicate insert
      await knex('users').insert({
        email: 'unique@example.com',
        name: 'Test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await expect(
        knex('users').insert({
          email: 'unique@example.com',
          name: 'Different',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it('should have index on sessions.token for fast lookup', async () => {
      // Verify index exists by checking SQLite index list
      const indexes = await knex.raw("PRAGMA index_list('sessions')");
      const indexNames = indexes.map((idx: { name: string }) => idx.name);

      // Check for an index that contains 'token' in its name
      const hasTokenIndex = indexNames.some(
        (name: string) => name.includes('token') || name.includes('sessions_token')
      );
      expect(hasTokenIndex).toBe(true);
    });
  });
});
