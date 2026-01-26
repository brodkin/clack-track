import { MagicLinkModel } from '../../../../src/storage/models/magic-link.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('MagicLinkModel', () => {
  let knex: Knex;
  let magicLinkModel: MagicLinkModel;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table manually instead of using migrations (avoids ES module import issues)
    // This pattern matches ContentModel tests
    const magicLinksTableExists = await knex.schema.hasTable('magic_links');
    if (!magicLinksTableExists) {
      await knex.schema.createTable('magic_links', table => {
        // Primary key
        table.increments('id').primary();

        // Token for magic link (unique, required for lookup)
        table.string('token', 255).unique().notNullable();

        // Email address of the invited user
        table.string('email', 255).notNullable();

        // Expiration timestamp for link validity
        table.timestamp('expires_at').notNullable();

        // Usage tracking - null means unused, timestamp means when it was used
        table.timestamp('used_at').nullable();

        // Creator tracking - foreign key to users table (nullable for system-generated links)
        table.integer('created_by').unsigned().nullable();

        // Creation timestamp
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        // Indexes for common queries
        table.index('token', 'idx_magic_links_token');
        table.index('email', 'idx_magic_links_email');
        table.index(['email', 'used_at'], 'idx_magic_links_email_used_at');
        table.index('expires_at', 'idx_magic_links_expires_at');
      });
    }
  });

  beforeEach(async () => {
    // Clean table data for isolated tests (table structure persists)
    await knex('magic_links').del();
    magicLinkModel = new MagicLinkModel(knex);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('create', () => {
    test('should create a magic link record with all required fields', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      const linkData = {
        token: 'test-token-abc123',
        email: 'test@example.com',
        expiresAt,
        createdBy: null,
      };

      const result = await magicLinkModel.create(linkData);

      expect(result).toMatchObject({
        token: 'test-token-abc123',
        email: 'test@example.com',
      });
      expect(result.id).toBeDefined();
      expect(result.usedAt).toBeNull();
      expect(result.expiresAt).toEqual(expiresAt);
    });

    test('should create a magic link with createdBy user ID', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const linkData = {
        token: 'test-token-with-creator',
        email: 'invited@example.com',
        expiresAt,
        createdBy: 1, // Admin user ID
      };

      const result = await magicLinkModel.create(linkData);

      expect(result.createdBy).toBe(1);
    });

    test('should generate unique IDs for each magic link', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const link1 = await magicLinkModel.create({
        token: 'token-1',
        email: 'user1@example.com',
        expiresAt,
        createdBy: null,
      });

      const link2 = await magicLinkModel.create({
        token: 'token-2',
        email: 'user2@example.com',
        expiresAt,
        createdBy: null,
      });

      expect(link1.id).not.toBe(link2.id);
    });

    test('should reject duplicate tokens', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await magicLinkModel.create({
        token: 'duplicate-token',
        email: 'user1@example.com',
        expiresAt,
        createdBy: null,
      });

      await expect(
        magicLinkModel.create({
          token: 'duplicate-token', // Same token
          email: 'user2@example.com',
          expiresAt,
          createdBy: null,
        })
      ).rejects.toThrow();
    });

    test('should allow multiple tokens for the same email', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const link1 = await magicLinkModel.create({
        token: 'token-for-same-email-1',
        email: 'same@example.com',
        expiresAt,
        createdBy: null,
      });

      const link2 = await magicLinkModel.create({
        token: 'token-for-same-email-2',
        email: 'same@example.com',
        expiresAt,
        createdBy: null,
      });

      expect(link1.email).toBe(link2.email);
      expect(link1.token).not.toBe(link2.token);
    });
  });

  describe('findByToken', () => {
    test('should find a valid magic link by token', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await magicLinkModel.create({
        token: 'find-me-token',
        email: 'find@example.com',
        expiresAt,
        createdBy: null,
      });

      const found = await magicLinkModel.findByToken('find-me-token');

      expect(found).not.toBeNull();
      expect(found?.token).toBe('find-me-token');
      expect(found?.email).toBe('find@example.com');
    });

    test('should return null for nonexistent token', async () => {
      const found = await magicLinkModel.findByToken('nonexistent-token');

      expect(found).toBeNull();
    });

    test('should return null for expired token', async () => {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 1000); // Already expired

      await magicLinkModel.create({
        token: 'expired-token',
        email: 'expired@example.com',
        expiresAt: expiredAt,
        createdBy: null,
      });

      const found = await magicLinkModel.findByToken('expired-token');

      expect(found).toBeNull();
    });

    test('should return null for already used token', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const created = await magicLinkModel.create({
        token: 'used-token',
        email: 'used@example.com',
        expiresAt,
        createdBy: null,
      });

      // Mark as used
      await magicLinkModel.markUsed(created.id);

      const found = await magicLinkModel.findByToken('used-token');

      expect(found).toBeNull();
    });

    test('should find valid unused and unexpired token', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await magicLinkModel.create({
        token: 'valid-token',
        email: 'valid@example.com',
        expiresAt,
        createdBy: null,
      });

      const found = await magicLinkModel.findByToken('valid-token');

      expect(found).not.toBeNull();
      expect(found?.usedAt).toBeNull();
    });
  });

  describe('markUsed', () => {
    test('should set usedAt timestamp on magic link', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const created = await magicLinkModel.create({
        token: 'mark-used-token',
        email: 'markused@example.com',
        expiresAt,
        createdBy: null,
      });

      expect(created.usedAt).toBeNull();

      const marked = await magicLinkModel.markUsed(created.id);

      expect(marked).not.toBeNull();
      expect(marked?.usedAt).not.toBeNull();
      expect(marked?.usedAt).toBeInstanceOf(Date);
    });

    test('should return null for nonexistent ID', async () => {
      const result = await magicLinkModel.markUsed(99999);

      expect(result).toBeNull();
    });

    test('should prevent reuse after marking as used', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const created = await magicLinkModel.create({
        token: 'single-use-token',
        email: 'singleuse@example.com',
        expiresAt,
        createdBy: null,
      });

      await magicLinkModel.markUsed(created.id);

      // Now the token should not be found (already used)
      const found = await magicLinkModel.findByToken('single-use-token');
      expect(found).toBeNull();
    });
  });

  describe('deleteExpired', () => {
    test('should delete expired magic links', async () => {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      const futureExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Create expired link
      await magicLinkModel.create({
        token: 'expired-link',
        email: 'expired@example.com',
        expiresAt: expiredAt,
        createdBy: null,
      });

      // Create valid link
      await magicLinkModel.create({
        token: 'valid-link',
        email: 'valid@example.com',
        expiresAt: futureExpiresAt,
        createdBy: null,
      });

      const deletedCount = await magicLinkModel.deleteExpired();

      expect(deletedCount).toBe(1);
    });

    test('should return 0 when no expired links exist', async () => {
      const now = new Date();
      const futureExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await magicLinkModel.create({
        token: 'valid-link',
        email: 'valid@example.com',
        expiresAt: futureExpiresAt,
        createdBy: null,
      });

      const deletedCount = await magicLinkModel.deleteExpired();

      expect(deletedCount).toBe(0);
    });

    test('should handle empty table gracefully', async () => {
      const deletedCount = await magicLinkModel.deleteExpired();

      expect(deletedCount).toBe(0);
    });

    test('should delete multiple expired links', async () => {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      for (let i = 0; i < 5; i++) {
        await magicLinkModel.create({
          token: `expired-${i}`,
          email: `expired${i}@example.com`,
          expiresAt: expiredAt,
          createdBy: null,
        });
      }

      const deletedCount = await magicLinkModel.deleteExpired();

      expect(deletedCount).toBe(5);
    });
  });

  describe('findByEmail', () => {
    test('should find all magic links for an email address', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await magicLinkModel.create({
        token: 'token-1',
        email: 'find-by-email@example.com',
        expiresAt,
        createdBy: null,
      });

      await magicLinkModel.create({
        token: 'token-2',
        email: 'find-by-email@example.com',
        expiresAt: new Date(now.getTime() + 2000),
        createdBy: null,
      });

      await magicLinkModel.create({
        token: 'token-other',
        email: 'other@example.com',
        expiresAt,
        createdBy: null,
      });

      const results = await magicLinkModel.findByEmail('find-by-email@example.com');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.email === 'find-by-email@example.com')).toBe(true);
    });

    test('should return empty array for email with no links', async () => {
      const results = await magicLinkModel.findByEmail('nonexistent@example.com');

      expect(results).toEqual([]);
    });

    test('should order results by createdAt descending', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Create first record
      const first = await magicLinkModel.create({
        token: 'first-token',
        email: 'ordering@example.com',
        expiresAt,
        createdBy: null,
      });

      // Create second record
      const second = await magicLinkModel.create({
        token: 'second-token',
        email: 'ordering@example.com',
        expiresAt,
        createdBy: null,
      });

      const results = await magicLinkModel.findByEmail('ordering@example.com');

      expect(results).toHaveLength(2);
      // Both should be present and ordered by createdAt desc, with ID as tiebreaker
      // Since createdAt precision may not differentiate close creates, use ID as secondary sort
      // Second record has higher ID (created later) and should be first with DESC ordering
      expect(results[0].id).toBe(second.id);
      expect(results[1].id).toBe(first.id);
    });

    test('should include used and expired links for audit purposes', async () => {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const futureExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Create expired link
      await magicLinkModel.create({
        token: 'expired-audit',
        email: 'audit@example.com',
        expiresAt: expiredAt,
        createdBy: null,
      });

      // Create and use a link
      const used = await magicLinkModel.create({
        token: 'used-audit',
        email: 'audit@example.com',
        expiresAt: futureExpiresAt,
        createdBy: null,
      });
      await magicLinkModel.markUsed(used.id);

      // Create active link
      await magicLinkModel.create({
        token: 'active-audit',
        email: 'audit@example.com',
        expiresAt: futureExpiresAt,
        createdBy: null,
      });

      const results = await magicLinkModel.findByEmail('audit@example.com');

      // All 3 should be returned for audit purposes
      expect(results).toHaveLength(3);
    });
  });

  describe('findById', () => {
    test('should find a magic link by ID', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const created = await magicLinkModel.create({
        token: 'find-by-id-token',
        email: 'findbyid@example.com',
        expiresAt,
        createdBy: null,
      });

      const found = await magicLinkModel.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.token).toBe('find-by-id-token');
    });

    test('should return null for nonexistent ID', async () => {
      const found = await magicLinkModel.findById(99999);

      expect(found).toBeNull();
    });
  });
});
