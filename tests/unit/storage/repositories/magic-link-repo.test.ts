import { MagicLinkRepository } from '../../../../src/storage/repositories/magic-link-repo.js';
import { MagicLinkModel } from '../../../../src/storage/models/magic-link.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('MagicLinkRepository', () => {
  let knex: Knex;
  let magicLinkModel: MagicLinkModel;
  let magicLinkRepo: MagicLinkRepository;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table manually instead of using migrations (avoids ES module import issues)
    // This pattern matches ContentRepository tests
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
    magicLinkRepo = new MagicLinkRepository(magicLinkModel);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('generateToken', () => {
    test('should generate a cryptographically secure token', () => {
      const token = MagicLinkRepository.generateToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // Default length is 32 bytes = 64 hex characters
      expect(token.length).toBe(64);
    });

    test('should generate unique tokens on each call', () => {
      const token1 = MagicLinkRepository.generateToken();
      const token2 = MagicLinkRepository.generateToken();
      const token3 = MagicLinkRepository.generateToken();

      expect(token1).not.toBe(token2);
      expect(token2).not.toBe(token3);
      expect(token1).not.toBe(token3);
    });

    test('should generate token with custom byte length', () => {
      const token16 = MagicLinkRepository.generateToken(16);
      const token64 = MagicLinkRepository.generateToken(64);

      // 16 bytes = 32 hex characters
      expect(token16.length).toBe(32);
      // 64 bytes = 128 hex characters
      expect(token64.length).toBe(128);
    });

    test('should generate only hexadecimal characters', () => {
      const token = MagicLinkRepository.generateToken();

      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('createInvite', () => {
    test('should create a magic link with generated token', async () => {
      const result = await magicLinkRepo.createInvite('newuser@example.com');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('newuser@example.com');
      expect(result?.token).toBeDefined();
      expect(result?.token.length).toBe(64);
      expect(result?.usedAt).toBeNull();
    });

    test('should create a magic link with createdBy user ID', async () => {
      const result = await magicLinkRepo.createInvite('invited@example.com', 1);

      expect(result?.createdBy).toBe(1);
    });

    test('should create a magic link with default 24 hour expiration', async () => {
      const before = new Date();
      const result = await magicLinkRepo.createInvite('expiry@example.com');
      const after = new Date();

      // Expiration should be approximately 24 hours in the future
      const expectedMin = new Date(before.getTime() + 23 * 60 * 60 * 1000);
      const expectedMax = new Date(after.getTime() + 25 * 60 * 60 * 1000);

      expect(result?.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(result?.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    test('should create a magic link with custom expiration hours', async () => {
      const before = new Date();
      const result = await magicLinkRepo.createInvite('custom-expiry@example.com', null, 48);
      const after = new Date();

      // Expiration should be approximately 48 hours in the future
      const expectedMin = new Date(before.getTime() + 47 * 60 * 60 * 1000);
      const expectedMax = new Date(after.getTime() + 49 * 60 * 60 * 1000);

      expect(result?.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(result?.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        create: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new MagicLinkRepository(mockModel as unknown as MagicLinkModel);
      const result = await failingRepo.createInvite('error@example.com');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create magic link'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('validateAndConsume', () => {
    test('should validate and consume a valid token', async () => {
      const created = await magicLinkRepo.createInvite('consume@example.com');
      expect(created).not.toBeNull();

      const result = await magicLinkRepo.validateAndConsume(created!.token);

      expect(result).not.toBeNull();
      expect(result?.email).toBe('consume@example.com');
      expect(result?.usedAt).not.toBeNull();
    });

    test('should return null for invalid token', async () => {
      const result = await magicLinkRepo.validateAndConsume('nonexistent-token');

      expect(result).toBeNull();
    });

    test('should return null for expired token', async () => {
      // Create an expired link by manipulating the database directly
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 1000);

      await magicLinkModel.create({
        token: 'expired-validate-token',
        email: 'expired-validate@example.com',
        expiresAt: expiredAt,
        createdBy: null,
      });

      const result = await magicLinkRepo.validateAndConsume('expired-validate-token');

      expect(result).toBeNull();
    });

    test('should return null for already used token', async () => {
      const created = await magicLinkRepo.createInvite('already-used@example.com');
      expect(created).not.toBeNull();

      // Use it once
      const firstUse = await magicLinkRepo.validateAndConsume(created!.token);
      expect(firstUse).not.toBeNull();

      // Try to use again
      const secondUse = await magicLinkRepo.validateAndConsume(created!.token);
      expect(secondUse).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByToken: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new MagicLinkRepository(mockModel as unknown as MagicLinkModel);
      const result = await failingRepo.validateAndConsume('any-token');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to validate magic link'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('findByEmail', () => {
    test('should find all magic links for an email', async () => {
      await magicLinkRepo.createInvite('find@example.com');
      await magicLinkRepo.createInvite('find@example.com');
      await magicLinkRepo.createInvite('other@example.com');

      const results = await magicLinkRepo.findByEmail('find@example.com');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.email === 'find@example.com')).toBe(true);
    });

    test('should return empty array for email with no links', async () => {
      const results = await magicLinkRepo.findByEmail('nonexistent@example.com');

      expect(results).toEqual([]);
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByEmail: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new MagicLinkRepository(mockModel as unknown as MagicLinkModel);
      const results = await failingRepo.findByEmail('any@example.com');

      expect(results).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find magic links by email'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('cleanupExpired', () => {
    test('should delete expired magic links', async () => {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create expired links directly
      await magicLinkModel.create({
        token: 'expired-cleanup-1',
        email: 'cleanup1@example.com',
        expiresAt: expiredAt,
        createdBy: null,
      });

      await magicLinkModel.create({
        token: 'expired-cleanup-2',
        email: 'cleanup2@example.com',
        expiresAt: expiredAt,
        createdBy: null,
      });

      // Create valid link
      await magicLinkRepo.createInvite('valid@example.com');

      const deletedCount = await magicLinkRepo.cleanupExpired();

      expect(deletedCount).toBe(2);
    });

    test('should return 0 when no expired links exist', async () => {
      await magicLinkRepo.createInvite('valid@example.com');

      const deletedCount = await magicLinkRepo.cleanupExpired();

      expect(deletedCount).toBe(0);
    });

    test('should log cleanup results', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const now = new Date();
      const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await magicLinkModel.create({
        token: 'expired-for-log',
        email: 'log@example.com',
        expiresAt: expiredAt,
        createdBy: null,
      });

      await magicLinkRepo.cleanupExpired();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Magic link cleanup'));

      consoleSpy.mockRestore();
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        deleteExpired: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new MagicLinkRepository(mockModel as unknown as MagicLinkModel);
      const deletedCount = await failingRepo.cleanupExpired();

      expect(deletedCount).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Magic link cleanup failed'),
        expect.any(String)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('revokeForEmail', () => {
    test('should delete all unused links for an email', async () => {
      await magicLinkRepo.createInvite('revoke@example.com');
      await magicLinkRepo.createInvite('revoke@example.com');
      await magicLinkRepo.createInvite('keep@example.com');

      const deletedCount = await magicLinkRepo.revokeForEmail('revoke@example.com');

      expect(deletedCount).toBe(2);

      const remaining = await magicLinkRepo.findByEmail('revoke@example.com');
      expect(remaining).toHaveLength(0);

      const kept = await magicLinkRepo.findByEmail('keep@example.com');
      expect(kept).toHaveLength(1);
    });

    test('should not delete used links', async () => {
      const created = await magicLinkRepo.createInvite('revoke-used@example.com');
      await magicLinkRepo.createInvite('revoke-used@example.com');

      // Use the first link
      await magicLinkRepo.validateAndConsume(created!.token);

      const deletedCount = await magicLinkRepo.revokeForEmail('revoke-used@example.com');

      expect(deletedCount).toBe(1); // Only the unused one

      const remaining = await magicLinkRepo.findByEmail('revoke-used@example.com');
      expect(remaining).toHaveLength(1); // The used one remains
    });

    test('should return 0 for email with no links', async () => {
      const deletedCount = await magicLinkRepo.revokeForEmail('nonexistent@example.com');

      expect(deletedCount).toBe(0);
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByEmail: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new MagicLinkRepository(mockModel as unknown as MagicLinkModel);
      const deletedCount = await failingRepo.revokeForEmail('any@example.com');

      expect(deletedCount).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to revoke magic links'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('hasValidInvite', () => {
    test('should return true if email has a valid unused invite', async () => {
      await magicLinkRepo.createInvite('has-valid@example.com');

      const hasValid = await magicLinkRepo.hasValidInvite('has-valid@example.com');

      expect(hasValid).toBe(true);
    });

    test('should return false if email has no invites', async () => {
      const hasValid = await magicLinkRepo.hasValidInvite('no-invites@example.com');

      expect(hasValid).toBe(false);
    });

    test('should return false if all invites are expired', async () => {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await magicLinkModel.create({
        token: 'all-expired-token',
        email: 'all-expired@example.com',
        expiresAt: expiredAt,
        createdBy: null,
      });

      const hasValid = await magicLinkRepo.hasValidInvite('all-expired@example.com');

      expect(hasValid).toBe(false);
    });

    test('should return false if all invites are used', async () => {
      const created = await magicLinkRepo.createInvite('all-used@example.com');
      await magicLinkRepo.validateAndConsume(created!.token);

      const hasValid = await magicLinkRepo.hasValidInvite('all-used@example.com');

      expect(hasValid).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByEmail: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new MagicLinkRepository(mockModel as unknown as MagicLinkModel);
      const hasValid = await failingRepo.hasValidInvite('any@example.com');

      expect(hasValid).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check for valid invite'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
