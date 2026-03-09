/**
 * Tests for CredentialModel
 *
 * Implements TDD for WebAuthn credential storage:
 * - create() - Store new credential with Base64-encoded credential_id and public_key
 * - findByCredentialId() - Lookup by credential_id for authentication
 * - findByUserId() - Get all credentials for a user
 * - updateCounter() - Increment counter for replay attack prevention
 * - updateLastUsed() - Update last_used_at timestamp
 * - delete() - Remove a credential
 */

import { CredentialModel, CredentialRecord } from '../../../../src/storage/models/credential.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('CredentialModel', () => {
  let knex: Knex;
  let credentialModel: CredentialModel;

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
        // Primary key
        table.increments('id').primary();

        // Foreign key to users table
        table.integer('user_id').unsigned().notNullable();

        // WebAuthn credential identifier (base64 encoded, unique for lookup)
        table.string('credential_id', 512).unique().notNullable();

        // WebAuthn public key (base64 encoded COSE key)
        table.text('public_key').notNullable();

        // Signature counter for replay attack prevention
        table.integer('counter').unsigned().notNullable().defaultTo(0);

        // Device type (platform, cross-platform)
        table.string('device_type', 50).nullable();

        // Human-readable name for the credential
        table.string('name', 255).nullable();

        // Timestamps
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('last_used_at').nullable();

        // Indexes for common queries
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

  describe('create', () => {
    test('should create a credential record with all required fields', async () => {
      const userId = await createTestUser();
      const now = new Date();
      const credentialData = {
        userId,
        credentialId: 'dGVzdC1jcmVkZW50aWFsLWlk', // Base64 encoded
        publicKey: 'cHVibGljLWtleS1kYXRh', // Base64 encoded
        counter: 0,
        createdAt: now,
      };

      const result = await credentialModel.create(credentialData);

      expect(result).toMatchObject({
        userId,
        credentialId: 'dGVzdC1jcmVkZW50aWFsLWlk',
        publicKey: 'cHVibGljLWtleS1kYXRh',
        counter: 0,
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toEqual(now);
    });

    test('should create a credential with device type and name', async () => {
      const userId = await createTestUser();
      const credentialData = {
        userId,
        credentialId: 'Y3JlZC13aXRoLW1ldGFkYXRh',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        deviceType: 'platform',
        name: 'MacBook Touch ID',
        createdAt: new Date(),
      };

      const result = await credentialModel.create(credentialData);

      expect(result.deviceType).toBe('platform');
      expect(result.name).toBe('MacBook Touch ID');
    });

    test('should create a credential without optional fields', async () => {
      const userId = await createTestUser();
      const credentialData = {
        userId,
        credentialId: 'bWluaW1hbC1jcmVk',
        publicKey: 'cHVibGljLWtleS0z',
        counter: 0,
        createdAt: new Date(),
      };

      const result = await credentialModel.create(credentialData);

      expect(result.deviceType).toBeUndefined();
      expect(result.name).toBeUndefined();
      expect(result.lastUsedAt).toBeNull();
    });

    test('should generate unique IDs for each credential', async () => {
      const userId = await createTestUser();
      const now = new Date();

      const cred1 = await credentialModel.create({
        userId,
        credentialId: 'Y3JlZDEtdW5pcXVl',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      const cred2 = await credentialModel.create({
        userId,
        credentialId: 'Y3JlZDItdW5pcXVl',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: now,
      });

      expect(cred1.id).not.toBe(cred2.id);
    });

    test('should reject duplicate credentialId values', async () => {
      const userId = await createTestUser();
      const now = new Date();

      await credentialModel.create({
        userId,
        credentialId: 'ZHVwbGljYXRlLWNyZWQ=',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      await expect(
        credentialModel.create({
          userId,
          credentialId: 'ZHVwbGljYXRlLWNyZWQ=', // Same credentialId
          publicKey: 'cHVibGljLWtleS0y',
          counter: 0,
          createdAt: now,
        })
      ).rejects.toThrow();
    });

    test('should default counter to 0 if not specified', async () => {
      const userId = await createTestUser();
      const credentialData = {
        userId,
        credentialId: 'ZGVmYXVsdC1jb3VudGVy',
        publicKey: 'cHVibGljLWtleQ==',
        createdAt: new Date(),
      };

      const result = await credentialModel.create(credentialData as Omit<CredentialRecord, 'id'>);

      expect(result.counter).toBe(0);
    });

    test('should handle cross-platform device type', async () => {
      const userId = await createTestUser();
      const credentialData = {
        userId,
        credentialId: 'Y3Jvc3MtcGxhdGZvcm0=',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        deviceType: 'cross-platform',
        name: 'YubiKey 5',
        createdAt: new Date(),
      };

      const result = await credentialModel.create(credentialData);

      expect(result.deviceType).toBe('cross-platform');
      expect(result.name).toBe('YubiKey 5');
    });
  });

  describe('findByCredentialId', () => {
    test('should find a credential by credentialId', async () => {
      const userId = await createTestUser();
      const created = await credentialModel.create({
        userId,
        credentialId: 'ZmluZC1ieS1jcmVkLWlk',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 5,
        createdAt: new Date(),
      });

      const found = await credentialModel.findByCredentialId('ZmluZC1ieS1jcmVkLWlk');

      expect(found).toMatchObject({
        id: created.id,
        userId,
        credentialId: 'ZmluZC1ieS1jcmVkLWlk',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 5,
      });
    });

    test('should return null for nonexistent credentialId', async () => {
      const found = await credentialModel.findByCredentialId('bm9uZXhpc3RlbnQ=');

      expect(found).toBeNull();
    });

    test('should include all metadata when present', async () => {
      const userId = await createTestUser();
      const now = new Date();
      await credentialModel.create({
        userId,
        credentialId: 'd2l0aC1tZXRhZGF0YQ==',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 10,
        deviceType: 'platform',
        name: 'iPhone Face ID',
        createdAt: now,
        lastUsedAt: now,
      });

      const found = await credentialModel.findByCredentialId('d2l0aC1tZXRhZGF0YQ==');

      expect(found?.deviceType).toBe('platform');
      expect(found?.name).toBe('iPhone Face ID');
      expect(found?.counter).toBe(10);
    });
  });

  describe('findByUserId', () => {
    test('should find all credentials for a user', async () => {
      const userId = await createTestUser();
      const now = new Date();

      await credentialModel.create({
        userId,
        credentialId: 'dXNlci1jcmVkLTE=',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        name: 'Credential 1',
        createdAt: now,
      });

      await credentialModel.create({
        userId,
        credentialId: 'dXNlci1jcmVkLTI=',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        name: 'Credential 2',
        createdAt: new Date(now.getTime() + 1000),
      });

      const results = await credentialModel.findByUserId(userId);

      expect(results).toHaveLength(2);
      expect(results.every(c => c.userId === userId)).toBe(true);
    });

    test('should return credentials ordered by createdAt descending', async () => {
      const userId = await createTestUser();
      const now = new Date();

      await credentialModel.create({
        userId,
        credentialId: 'b2xkZXItY3JlZA==',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        name: 'Older Credential',
        createdAt: now,
      });

      await credentialModel.create({
        userId,
        credentialId: 'bmV3ZXItY3JlZA==',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        name: 'Newer Credential',
        createdAt: new Date(now.getTime() + 1000),
      });

      const results = await credentialModel.findByUserId(userId);

      expect(results[0].name).toBe('Newer Credential');
      expect(results[1].name).toBe('Older Credential');
    });

    test('should return empty array when user has no credentials', async () => {
      const userId = await createTestUser();
      const results = await credentialModel.findByUserId(userId);

      expect(results).toEqual([]);
    });

    test('should not return credentials from other users', async () => {
      const userId1 = await createTestUser('user1@example.com', 'User 1');
      const userId2 = await createTestUser('user2@example.com', 'User 2');
      const now = new Date();

      await credentialModel.create({
        userId: userId1,
        credentialId: 'dXNlcjEtY3JlZA==',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      await credentialModel.create({
        userId: userId2,
        credentialId: 'dXNlcjItY3JlZA==',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: now,
      });

      const user1Creds = await credentialModel.findByUserId(userId1);
      const user2Creds = await credentialModel.findByUserId(userId2);

      expect(user1Creds).toHaveLength(1);
      expect(user1Creds[0].credentialId).toBe('dXNlcjEtY3JlZA==');

      expect(user2Creds).toHaveLength(1);
      expect(user2Creds[0].credentialId).toBe('dXNlcjItY3JlZA==');
    });
  });

  describe('updateCounter', () => {
    test('should update the counter value', async () => {
      const userId = await createTestUser();
      const created = await credentialModel.create({
        userId,
        credentialId: 'dXBkYXRlLWNvdW50ZXI=',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        createdAt: new Date(),
      });

      const updated = await credentialModel.updateCounter(created.id, 5);

      expect(updated?.counter).toBe(5);
    });

    test('should increment counter for replay attack prevention', async () => {
      const userId = await createTestUser();
      const created = await credentialModel.create({
        userId,
        credentialId: 'aW5jcmVtZW50LWNvdW50ZXI=',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 10,
        createdAt: new Date(),
      });

      // Simulate multiple authentications
      let credential = await credentialModel.updateCounter(created.id, 11);
      expect(credential?.counter).toBe(11);

      credential = await credentialModel.updateCounter(created.id, 12);
      expect(credential?.counter).toBe(12);

      credential = await credentialModel.updateCounter(created.id, 15);
      expect(credential?.counter).toBe(15);
    });

    test('should return null for nonexistent credential ID', async () => {
      const result = await credentialModel.updateCounter(99999, 10);

      expect(result).toBeNull();
    });

    test('should preserve other fields when updating counter', async () => {
      const userId = await createTestUser();
      const created = await credentialModel.create({
        userId,
        credentialId: 'cHJlc2VydmUtZmllbGRz',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        deviceType: 'platform',
        name: 'Test Device',
        createdAt: new Date(),
      });

      const updated = await credentialModel.updateCounter(created.id, 100);

      expect(updated).toMatchObject({
        id: created.id,
        userId,
        credentialId: 'cHJlc2VydmUtZmllbGRz',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 100,
        deviceType: 'platform',
        name: 'Test Device',
      });
    });
  });

  describe('updateLastUsed', () => {
    test('should update the lastUsedAt timestamp', async () => {
      const userId = await createTestUser();
      const created = await credentialModel.create({
        userId,
        credentialId: 'dXBkYXRlLWxhc3QtdXNlZA==',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        createdAt: new Date(),
        lastUsedAt: null,
      });

      expect(created.lastUsedAt).toBeNull();

      const now = new Date();
      const updated = await credentialModel.updateLastUsed(created.id, now);

      // MySQL DATETIME strips milliseconds, so compare within 1 second tolerance
      expect(updated?.lastUsedAt).not.toBeNull();
      expect(Math.abs(updated!.lastUsedAt!.getTime() - now.getTime())).toBeLessThan(1000);
    });

    test('should return null for nonexistent credential ID', async () => {
      const result = await credentialModel.updateLastUsed(99999, new Date());

      expect(result).toBeNull();
    });

    test('should preserve other fields when updating lastUsedAt', async () => {
      const userId = await createTestUser();
      const createdAt = new Date();
      const created = await credentialModel.create({
        userId,
        credentialId: 'cHJlc2VydmUtb24tbGFzdC11c2Vk',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 42,
        deviceType: 'cross-platform',
        name: 'Security Key',
        createdAt,
        lastUsedAt: null,
      });

      const lastUsedAt = new Date();
      const updated = await credentialModel.updateLastUsed(created.id, lastUsedAt);

      expect(updated).toMatchObject({
        id: created.id,
        userId,
        credentialId: 'cHJlc2VydmUtb24tbGFzdC11c2Vk',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 42,
        deviceType: 'cross-platform',
        name: 'Security Key',
      });
      // MySQL DATETIME strips milliseconds, so compare within 1 second tolerance
      expect(updated?.lastUsedAt).not.toBeNull();
      expect(Math.abs(updated!.lastUsedAt!.getTime() - lastUsedAt.getTime())).toBeLessThan(1000);
    });
  });

  describe('delete', () => {
    test('should delete a credential by ID', async () => {
      const userId = await createTestUser();
      const created = await credentialModel.create({
        userId,
        credentialId: 'ZGVsZXRlLXRlc3Q=',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        createdAt: new Date(),
      });

      const deleteResult = await credentialModel.delete(created.id);
      expect(deleteResult).toBe(true);

      const found = await credentialModel.findByCredentialId('ZGVsZXRlLXRlc3Q=');
      expect(found).toBeNull();
    });

    test('should return false when deleting nonexistent credential', async () => {
      const result = await credentialModel.delete(99999);

      expect(result).toBe(false);
    });

    test('should not affect other credentials when deleting', async () => {
      const userId = await createTestUser();
      const now = new Date();

      const cred1 = await credentialModel.create({
        userId,
        credentialId: 'a2VlcC10aGlzLW9uZQ==',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      const cred2 = await credentialModel.create({
        userId,
        credentialId: 'ZGVsZXRlLXRoaXMtb25l',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: now,
      });

      await credentialModel.delete(cred2.id);

      const remaining = await credentialModel.findByUserId(userId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(cred1.id);
    });
  });

  describe('deleteByUserId', () => {
    test('should delete all credentials for a user', async () => {
      const userId = await createTestUser();
      const now = new Date();

      await credentialModel.create({
        userId,
        credentialId: 'dXNlci1jcmVkLWE=',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      await credentialModel.create({
        userId,
        credentialId: 'dXNlci1jcmVkLWI=',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: now,
      });

      const deletedCount = await credentialModel.deleteByUserId(userId);

      expect(deletedCount).toBe(2);

      const remaining = await credentialModel.findByUserId(userId);
      expect(remaining).toHaveLength(0);
    });

    test('should return 0 when user has no credentials', async () => {
      const userId = await createTestUser();
      const deletedCount = await credentialModel.deleteByUserId(userId);

      expect(deletedCount).toBe(0);
    });

    test('should not delete credentials from other users', async () => {
      const userId1 = await createTestUser('user1@test.com', 'User 1');
      const userId2 = await createTestUser('user2@test.com', 'User 2');
      const now = new Date();

      await credentialModel.create({
        userId: userId1,
        credentialId: 'dXNlcjEtY3JlZA==',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      await credentialModel.create({
        userId: userId2,
        credentialId: 'dXNlcjItY3JlZA==',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: now,
      });

      await credentialModel.deleteByUserId(userId1);

      const user1Creds = await credentialModel.findByUserId(userId1);
      const user2Creds = await credentialModel.findByUserId(userId2);

      expect(user1Creds).toHaveLength(0);
      expect(user2Creds).toHaveLength(1);
    });
  });

  describe('findById', () => {
    test('should find a credential by ID', async () => {
      const userId = await createTestUser();
      const created = await credentialModel.create({
        userId,
        credentialId: 'ZmluZC1ieS1pZA==',
        publicKey: 'cHVibGljLWtleQ==',
        counter: 0,
        createdAt: new Date(),
      });

      const found = await credentialModel.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        userId,
        credentialId: 'ZmluZC1ieS1pZA==',
      });
    });

    test('should return null for nonexistent ID', async () => {
      const found = await credentialModel.findById(99999);

      expect(found).toBeNull();
    });
  });

  describe('countByUserId', () => {
    test('should count credentials for a user', async () => {
      const userId = await createTestUser();
      const now = new Date();

      await credentialModel.create({
        userId,
        credentialId: 'Y291bnQtY3JlZC0x',
        publicKey: 'cHVibGljLWtleS0x',
        counter: 0,
        createdAt: now,
      });

      await credentialModel.create({
        userId,
        credentialId: 'Y291bnQtY3JlZC0y',
        publicKey: 'cHVibGljLWtleS0y',
        counter: 0,
        createdAt: now,
      });

      await credentialModel.create({
        userId,
        credentialId: 'Y291bnQtY3JlZC0z',
        publicKey: 'cHVibGljLWtleS0z',
        counter: 0,
        createdAt: now,
      });

      const count = await credentialModel.countByUserId(userId);

      expect(count).toBe(3);
    });

    test('should return 0 when user has no credentials', async () => {
      const userId = await createTestUser();
      const count = await credentialModel.countByUserId(userId);

      expect(count).toBe(0);
    });
  });
});
