/**
 * Tests for magic_links database migration
 *
 * These tests verify:
 * - Migration 010: magic_links table creation with proper schema
 * - Token uniqueness constraint for fast lookup
 * - Email + used_at composite index for validation queries
 * - Rollback functionality
 * - Column constraints and nullability
 */
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('Magic Links Table Migration', () => {
  let knex: Knex;

  beforeAll(async () => {
    // Reset singleton to ensure clean state
    resetKnexInstance();
    knex = getKnexInstance();
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('Migration 010: Create magic_links table', () => {
    beforeEach(async () => {
      // Clean up tables if they exist from previous test runs
      await knex.schema.dropTableIfExists('magic_links');
      await knex.schema.dropTableIfExists('users');

      // Create users table first (dependency for created_by foreign key)
      const usersMigration = await import('../../../../migrations/007_create_users_table.cjs');
      await usersMigration.up(knex);
    });

    afterEach(async () => {
      // Clean up after each test
      await knex.schema.dropTableIfExists('magic_links');
      await knex.schema.dropTableIfExists('users');
    });

    describe('up migration', () => {
      it('should create magic_links table', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const exists = await knex.schema.hasTable('magic_links');
        expect(exists).toBe(true);
      });

      it('should create magic_links table with id column as primary key', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const columns = await knex.raw(
          "SELECT name, type FROM pragma_table_info('magic_links') WHERE pk = 1"
        );
        expect(columns[0]?.name).toBe('id');
      });

      it('should create magic_links table with token column', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const hasColumn = await knex.schema.hasColumn('magic_links', 'token');
        expect(hasColumn).toBe(true);
      });

      it('should create magic_links table with email column', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const hasColumn = await knex.schema.hasColumn('magic_links', 'email');
        expect(hasColumn).toBe(true);
      });

      it('should create magic_links table with expires_at column', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const hasColumn = await knex.schema.hasColumn('magic_links', 'expires_at');
        expect(hasColumn).toBe(true);
      });

      it('should create magic_links table with used_at column', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const hasColumn = await knex.schema.hasColumn('magic_links', 'used_at');
        expect(hasColumn).toBe(true);
      });

      it('should create magic_links table with created_by column', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const hasColumn = await knex.schema.hasColumn('magic_links', 'created_by');
        expect(hasColumn).toBe(true);
      });

      it('should create magic_links table with created_at column', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const hasColumn = await knex.schema.hasColumn('magic_links', 'created_at');
        expect(hasColumn).toBe(true);
      });

      it('should enforce unique constraint on token', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        // Insert first magic link
        await knex('magic_links').insert({
          token: 'unique-token-123',
          email: 'test@example.com',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
        });

        // Attempt to insert duplicate token should fail
        await expect(
          knex('magic_links').insert({
            token: 'unique-token-123',
            email: 'different@example.com',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            created_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });

      it('should require token', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        // Attempt to insert without token should fail
        await expect(
          knex('magic_links').insert({
            email: 'test@example.com',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            created_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });

      it('should require email', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        // Attempt to insert without email should fail
        await expect(
          knex('magic_links').insert({
            token: 'test-token',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            created_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });

      it('should require expires_at', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        // Attempt to insert without expires_at should fail
        await expect(
          knex('magic_links').insert({
            token: 'test-token',
            email: 'test@example.com',
            created_at: new Date().toISOString(),
          })
        ).rejects.toThrow();
      });

      it('should allow null used_at for unused tokens', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const [id] = await knex('magic_links').insert({
          token: 'unused-token',
          email: 'test@example.com',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          used_at: null,
          created_at: new Date().toISOString(),
        });

        const magicLink = await knex('magic_links').where('id', id).first();
        expect(magicLink.used_at).toBeNull();
      });

      it('should allow null created_by for system-generated tokens', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const [id] = await knex('magic_links').insert({
          token: 'system-token',
          email: 'test@example.com',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_by: null,
          created_at: new Date().toISOString(),
        });

        const magicLink = await knex('magic_links').where('id', id).first();
        expect(magicLink.created_by).toBeNull();
      });

      it('should link created_by to users table via foreign key', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        // Create an admin user
        const [adminId] = await knex('users').insert({
          email: 'admin@example.com',
          name: 'Admin User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Create magic link with created_by referencing the admin
        const [id] = await knex('magic_links').insert({
          token: 'admin-created-token',
          email: 'newuser@example.com',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_by: adminId,
          created_at: new Date().toISOString(),
        });

        const magicLink = await knex('magic_links').where('id', id).first();
        expect(magicLink.created_by).toBe(adminId);
      });

      it('should track when token is used by setting used_at', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        const usedAt = new Date().toISOString();
        const [id] = await knex('magic_links').insert({
          token: 'used-token',
          email: 'test@example.com',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          used_at: usedAt,
          created_at: new Date().toISOString(),
        });

        const magicLink = await knex('magic_links').where('id', id).first();
        expect(magicLink.used_at).toBe(usedAt);
      });

      it('should allow same email for multiple tokens (re-registration attempts)', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        // First token for email
        await knex('magic_links').insert({
          token: 'first-token',
          email: 'same@example.com',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
        });

        // Second token for same email (should succeed)
        await knex('magic_links').insert({
          token: 'second-token',
          email: 'same@example.com',
          expires_at: new Date(Date.now() + 7200000).toISOString(),
          created_at: new Date().toISOString(),
        });

        const links = await knex('magic_links').where('email', 'same@example.com');
        expect(links).toHaveLength(2);
      });
    });

    describe('down migration', () => {
      it('should drop magic_links table', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');

        // First create the table
        await migration.up(knex);
        let exists = await knex.schema.hasTable('magic_links');
        expect(exists).toBe(true);

        // Then drop it
        await migration.down(knex);
        exists = await knex.schema.hasTable('magic_links');
        expect(exists).toBe(false);
      });
    });

    describe('foreign key behavior', () => {
      it('should set created_by to NULL when creator user is deleted (SET NULL)', async () => {
        const migration = await import('../../../../migrations/010_create_magic_links_table.cjs');
        await migration.up(knex);

        // Enable foreign keys in SQLite
        await knex.raw('PRAGMA foreign_keys = ON');

        // Create an admin user
        const [adminId] = await knex('users').insert({
          email: 'admin@example.com',
          name: 'Admin User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Create magic link with created_by referencing the admin
        const [linkId] = await knex('magic_links').insert({
          token: 'admin-created-token',
          email: 'newuser@example.com',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_by: adminId,
          created_at: new Date().toISOString(),
        });

        // Verify magic link exists with created_by
        let magicLink = await knex('magic_links').where('id', linkId).first();
        expect(magicLink.created_by).toBe(adminId);

        // Delete the admin user
        await knex('users').where('id', adminId).del();

        // Verify magic link still exists but created_by is NULL
        magicLink = await knex('magic_links').where('id', linkId).first();
        expect(magicLink).toBeDefined();
        expect(magicLink.created_by).toBeNull();
      });
    });
  });

  describe('Index verification', () => {
    beforeEach(async () => {
      await knex.schema.dropTableIfExists('magic_links');
      await knex.schema.dropTableIfExists('users');

      const usersMigration = await import('../../../../migrations/007_create_users_table.cjs');
      await usersMigration.up(knex);

      const magicLinksMigration =
        await import('../../../../migrations/010_create_magic_links_table.cjs');
      await magicLinksMigration.up(knex);
    });

    afterEach(async () => {
      await knex.schema.dropTableIfExists('magic_links');
      await knex.schema.dropTableIfExists('users');
    });

    it('should have unique index on token for fast lookup', async () => {
      // Verify index exists by checking SQLite index list
      const indexes = await knex.raw("PRAGMA index_list('magic_links')");
      const indexNames = indexes.map((idx: { name: string }) => idx.name);

      // Check for an index that contains 'token' in its name
      const hasTokenIndex = indexNames.some(
        (name: string) => name.includes('token') || name.includes('magic_links_token')
      );
      expect(hasTokenIndex).toBe(true);
    });

    it('should have index on email for email-based queries', async () => {
      // Verify index exists by checking SQLite index list
      const indexes = await knex.raw("PRAGMA index_list('magic_links')");
      const indexNames = indexes.map((idx: { name: string }) => idx.name);

      // Check for an index that contains 'email' in its name
      const hasEmailIndex = indexNames.some(
        (name: string) => name.includes('email') || name.includes('magic_links_email')
      );
      expect(hasEmailIndex).toBe(true);
    });

    it('should efficiently query by email and used_at (validation queries)', async () => {
      // Insert test data
      await knex('magic_links').insert({
        token: 'unused-token',
        email: 'test@example.com',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
      });

      await knex('magic_links').insert({
        token: 'used-token',
        email: 'test@example.com',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        used_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      // Query for unused tokens by email (common validation query)
      const unusedLinks = await knex('magic_links')
        .where('email', 'test@example.com')
        .whereNull('used_at');

      expect(unusedLinks).toHaveLength(1);
      expect(unusedLinks[0].token).toBe('unused-token');
    });
  });
});
