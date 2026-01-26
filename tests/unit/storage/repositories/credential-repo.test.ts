/**
 * Tests for CredentialRepository
 *
 * Repository pattern wrapper for CredentialModel with graceful error handling.
 * Follows fire-and-forget pattern for write operations and graceful degradation for reads.
 */

import { CredentialRepository } from '../../../../src/storage/repositories/credential-repo.js';
import { CredentialModel } from '../../../../src/storage/models/credential.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('CredentialRepository', () => {
  let knex: Knex;
  let credentialModel: CredentialModel;
  let credentialRepo: CredentialRepository;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create users table first (required for foreign key relationship)
    // Uses snake_case to match production migration
    const usersTableExists = await knex.schema.hasTable('users');
    if (!usersTableExists) {
      await knex.schema.createTable('users', table => {
        table.increments('id').primary();
        table.string('email', 255).unique().notNullable();
        table.string('name', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      });
    }

    // Create credentials table for WebAuthn credential storage
    // Uses snake_case to match production migration
    const credentialsTableExists = await knex.schema.hasTable('credentials');
    if (!credentialsTableExists) {
      await knex.schema.createTable('credentials', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable();
        table.string('credential_id', 512).unique().notNullable();
        table.text('public_key').notNullable();
        table.integer('counter').unsigned().notNullable().defaultTo(0);
        table.string('device_type', 50).nullable();
        table.string('name', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('last_used_at').nullable();

        table.index('user_id', 'idx_credentials_user_id');
        table.index('credential_id', 'idx_credentials_credential_id');
      });
    }
  });

  beforeEach(async () => {
    // Clean table data for isolated tests (table structure persists)
    await knex('credentials').del();
    await knex('users').del();
    credentialModel = new CredentialModel(knex);
    credentialRepo = new CredentialRepository(credentialModel);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  // Helper to create a test user (uses snake_case to match DB schema)
  async function createTestUser(
    email: string = 'test@example.com',
    name: string = 'Test User'
  ): Promise<number> {
    const [userId] = await knex('users').insert({
      email,
      name,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return userId;
  }

  describe('save', () => {
    test('should save credential record via model', async () => {
      const userId = await createTestUser();
      const now = new Date();
      const credentialData = {
        userId,
        credentialId: 'c2F2ZS10ZXN0LWNyZWQ=',
        publicKey: 'cHVibGljLWtleS1kYXRh',
        counter: 0,
        createdAt: now,
      };

      const result = await credentialRepo.save(credentialData);

      expect(result).toMatchObject({
        userId,
        credentialId: 'c2F2ZS10ZXN0LWNyZWQ=',
        publicKey: 'cHVibGljLWtleS1kYXRh',
        counter: 0,
      });
      expect(result?.id).toBeDefined();
    });

    test('should handle database errors gracefully and return null', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        create: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const result = await failingRepo.save({
        userId: 1,
        credentialId: 'ZmFpbC1zYXZl',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        createdAt: new Date(),
      });

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save credential'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('findByCredentialId', () => {
    test('should find credential by credentialId', async () => {
      const userId = await createTestUser();
      await credentialRepo.save({
        userId,
        credentialId: 'ZmluZC1ieS1jcmVkLWlk',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 5,
        createdAt: new Date(),
      });

      const found = await credentialRepo.findByCredentialId('ZmluZC1ieS1jcmVkLWlk');

      expect(found).not.toBeNull();
      expect(found?.credentialId).toBe('ZmluZC1ieS1jcmVkLWlk');
      expect(found?.counter).toBe(5);
    });

    test('should return null for nonexistent credentialId', async () => {
      const found = await credentialRepo.findByCredentialId('bm9uZXhpc3RlbnQ=');

      expect(found).toBeNull();
    });

    test('should handle database errors gracefully and return null', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByCredentialId: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const result = await failingRepo.findByCredentialId('ZXJyb3ItdGVzdA==');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find credential by credentialId'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('findByUserId', () => {
    test('should find all credentials for a user', async () => {
      const userId = await createTestUser();
      const now = new Date();

      await credentialRepo.save({
        userId,
        credentialId: 'dXNlci1jcmVkLTE=',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      await credentialRepo.save({
        userId,
        credentialId: 'dXNlci1jcmVkLTI=',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: new Date(now.getTime() + 1000),
      });

      const results = await credentialRepo.findByUserId(userId);

      expect(results).toHaveLength(2);
      expect(results.every(c => c.userId === userId)).toBe(true);
    });

    test('should return empty array when user has no credentials', async () => {
      const userId = await createTestUser();
      const results = await credentialRepo.findByUserId(userId);

      expect(results).toEqual([]);
    });

    test('should handle database errors gracefully and return empty array', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByUserId: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const results = await failingRepo.findByUserId(1);

      expect(results).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find credentials by userId'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('updateCounter', () => {
    test('should update counter value', async () => {
      const userId = await createTestUser();
      const saved = await credentialRepo.save({
        userId,
        credentialId: 'dXBkYXRlLWNvdW50ZXI=',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        createdAt: new Date(),
      });

      const updated = await credentialRepo.updateCounter(saved!.id, 10);

      expect(updated?.counter).toBe(10);
    });

    test('should return null for nonexistent credential', async () => {
      const result = await credentialRepo.updateCounter(99999, 10);

      expect(result).toBeNull();
    });

    test('should handle database errors gracefully and return null', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        updateCounter: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const result = await failingRepo.updateCounter(1, 10);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update credential counter'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('updateLastUsed', () => {
    test('should update lastUsedAt timestamp', async () => {
      const userId = await createTestUser();
      const saved = await credentialRepo.save({
        userId,
        credentialId: 'dXBkYXRlLWxhc3QtdXNlZA==',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        createdAt: new Date(),
        lastUsedAt: null,
      });

      const now = new Date();
      const updated = await credentialRepo.updateLastUsed(saved!.id, now);

      // MySQL DATETIME strips milliseconds, so compare within 1 second tolerance
      expect(updated?.lastUsedAt).not.toBeNull();
      expect(Math.abs(updated!.lastUsedAt!.getTime() - now.getTime())).toBeLessThan(1000);
    });

    test('should return null for nonexistent credential', async () => {
      const result = await credentialRepo.updateLastUsed(99999, new Date());

      expect(result).toBeNull();
    });

    test('should handle database errors gracefully and return null', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        updateLastUsed: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const result = await failingRepo.updateLastUsed(1, new Date());

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update credential lastUsedAt'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('delete', () => {
    test('should delete a credential by ID', async () => {
      const userId = await createTestUser();
      const saved = await credentialRepo.save({
        userId,
        credentialId: 'ZGVsZXRlLXRlc3Q=',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        createdAt: new Date(),
      });

      const deleteResult = await credentialRepo.delete(saved!.id);
      expect(deleteResult).toBe(true);

      const found = await credentialRepo.findByCredentialId('ZGVsZXRlLXRlc3Q=');
      expect(found).toBeNull();
    });

    test('should return false for nonexistent credential', async () => {
      const result = await credentialRepo.delete(99999);

      expect(result).toBe(false);
    });

    test('should handle database errors gracefully and return false', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        delete: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const result = await failingRepo.delete(1);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete credential'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('deleteByUserId', () => {
    test('should delete all credentials for a user', async () => {
      const userId = await createTestUser();
      const now = new Date();

      await credentialRepo.save({
        userId,
        credentialId: 'dXNlci1jcmVkLWE=',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      await credentialRepo.save({
        userId,
        credentialId: 'dXNlci1jcmVkLWI=',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: now,
      });

      const deletedCount = await credentialRepo.deleteByUserId(userId);

      expect(deletedCount).toBe(2);

      const remaining = await credentialRepo.findByUserId(userId);
      expect(remaining).toHaveLength(0);
    });

    test('should return 0 when user has no credentials', async () => {
      const userId = await createTestUser();
      const deletedCount = await credentialRepo.deleteByUserId(userId);

      expect(deletedCount).toBe(0);
    });

    test('should handle database errors gracefully and return 0', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        deleteByUserId: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const result = await failingRepo.deleteByUserId(1);

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete credentials by userId'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('countByUserId', () => {
    test('should count credentials for a user', async () => {
      const userId = await createTestUser();
      const now = new Date();

      await credentialRepo.save({
        userId,
        credentialId: 'Y291bnQtY3JlZC0x',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      await credentialRepo.save({
        userId,
        credentialId: 'Y291bnQtY3JlZC0y',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: now,
      });

      const count = await credentialRepo.countByUserId(userId);

      expect(count).toBe(2);
    });

    test('should return 0 when user has no credentials', async () => {
      const userId = await createTestUser();
      const count = await credentialRepo.countByUserId(userId);

      expect(count).toBe(0);
    });

    test('should handle database errors gracefully and return 0', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        countByUserId: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const result = await failingRepo.countByUserId(1);

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to count credentials'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('recordAuthentication', () => {
    test('should update both counter and lastUsedAt in a single call', async () => {
      const userId = await createTestUser();
      const saved = await credentialRepo.save({
        userId,
        credentialId: 'cmVjb3JkLWF1dGg=',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 5,
        createdAt: new Date(),
        lastUsedAt: null,
      });

      const newCounter = 10;
      const updated = await credentialRepo.recordAuthentication(saved!.id, newCounter);

      expect(updated?.counter).toBe(10);
      expect(updated?.lastUsedAt).not.toBeNull();
    });

    test('should return null for nonexistent credential', async () => {
      const result = await credentialRepo.recordAuthentication(99999, 10);

      expect(result).toBeNull();
    });

    test('should handle database errors gracefully and return null', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        updateCounter: jest.fn().mockRejectedValue(new Error('Database error')),
        updateLastUsed: jest.fn(),
      };

      const failingRepo = new CredentialRepository(mockModel as unknown as CredentialModel);
      const result = await failingRepo.recordAuthentication(1, 10);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record authentication'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
