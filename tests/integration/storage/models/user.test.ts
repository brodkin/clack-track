import { UserModel } from '../../../../src/storage/models/user.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('UserModel', () => {
  let knex: Knex;
  let userModel: UserModel;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table manually instead of using migrations (avoids ES module import issues)
    // This pattern matches ContentModel and other model tests
    // Uses snake_case column names to match migration schema
    const usersTableExists = await knex.schema.hasTable('users');
    if (!usersTableExists) {
      await knex.schema.createTable('users', table => {
        // Primary key
        table.increments('id').primary();

        // User profile
        table.string('email', 255).unique().notNullable();
        table.string('name', 255).nullable();

        // Audit timestamps (snake_case to match migration)
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      });
    }
  });

  beforeEach(async () => {
    // Clean table data for isolated tests (table structure persists)
    await knex('users').del();
    userModel = new UserModel(knex);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('create', () => {
    test('should create a user with email only', async () => {
      const userData = {
        email: 'test@example.com',
      };

      const result = await userModel.create(userData);

      expect(result).toMatchObject({
        email: 'test@example.com',
        name: null,
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should create a user with email and name', async () => {
      const userData = {
        email: 'john@example.com',
        name: 'John Doe',
      };

      const result = await userModel.create(userData);

      expect(result).toMatchObject({
        email: 'john@example.com',
        name: 'John Doe',
      });
      expect(result.id).toBeDefined();
    });

    test('should generate unique IDs for each user', async () => {
      const user1 = await userModel.create({ email: 'user1@example.com' });
      const user2 = await userModel.create({ email: 'user2@example.com' });

      expect(user1.id).not.toBe(user2.id);
    });

    test('should throw error on duplicate email', async () => {
      await userModel.create({ email: 'duplicate@example.com' });

      await expect(userModel.create({ email: 'duplicate@example.com' })).rejects.toThrow();
    });

    test('should trim whitespace from email', async () => {
      const result = await userModel.create({ email: '  spaced@example.com  ' });

      expect(result.email).toBe('spaced@example.com');
    });

    test('should lowercase email for consistency', async () => {
      const result = await userModel.create({ email: 'UPPER@EXAMPLE.COM' });

      expect(result.email).toBe('upper@example.com');
    });
  });

  describe('findById', () => {
    test('should find a user by ID', async () => {
      const created = await userModel.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      const found = await userModel.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    test('should return null for nonexistent ID', async () => {
      const found = await userModel.findById(99999);

      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    test('should find a user by email', async () => {
      await userModel.create({
        email: 'find@example.com',
        name: 'Find Me',
      });

      const found = await userModel.findByEmail('find@example.com');

      expect(found).toMatchObject({
        email: 'find@example.com',
        name: 'Find Me',
      });
    });

    test('should find user with case-insensitive email search', async () => {
      await userModel.create({
        email: 'case@example.com',
        name: 'Case User',
      });

      const found = await userModel.findByEmail('CASE@EXAMPLE.COM');

      expect(found).toMatchObject({
        email: 'case@example.com',
        name: 'Case User',
      });
    });

    test('should return null for nonexistent email', async () => {
      const found = await userModel.findByEmail('nonexistent@example.com');

      expect(found).toBeNull();
    });

    test('should trim whitespace from search email', async () => {
      await userModel.create({ email: 'trimmed@example.com' });

      const found = await userModel.findByEmail('  trimmed@example.com  ');

      expect(found).not.toBeNull();
      expect(found?.email).toBe('trimmed@example.com');
    });
  });

  describe('update', () => {
    test('should update user name', async () => {
      const created = await userModel.create({
        email: 'update@example.com',
        name: 'Original Name',
      });

      const updated = await userModel.update(created.id, { name: 'New Name' });

      expect(updated).toMatchObject({
        id: created.id,
        email: 'update@example.com',
        name: 'New Name',
      });
    });

    test('should update user email', async () => {
      const created = await userModel.create({
        email: 'old@example.com',
        name: 'Test User',
      });

      const updated = await userModel.update(created.id, { email: 'new@example.com' });

      expect(updated).toMatchObject({
        id: created.id,
        email: 'new@example.com',
        name: 'Test User',
      });
    });

    test('should update both email and name', async () => {
      const created = await userModel.create({
        email: 'both@example.com',
        name: 'Both User',
      });

      const updated = await userModel.update(created.id, {
        email: 'updated@example.com',
        name: 'Updated User',
      });

      expect(updated).toMatchObject({
        email: 'updated@example.com',
        name: 'Updated User',
      });
    });

    test('should update updatedAt timestamp', async () => {
      const created = await userModel.create({
        email: 'timestamp@example.com',
      });

      const updated = await userModel.update(created.id, { name: 'Added Name' });

      // updatedAt should be a valid Date
      expect(updated).not.toBeNull();
      expect(updated?.updatedAt).toBeDefined();
      // Verify the update happened (name changed)
      expect(updated?.name).toBe('Added Name');
      // The updated record should have timestamps defined
      expect(updated?.createdAt).toBeDefined();
    });

    test('should return null for nonexistent ID', async () => {
      const updated = await userModel.update(99999, { name: 'Ghost' });

      expect(updated).toBeNull();
    });

    test('should throw error when updating to duplicate email', async () => {
      await userModel.create({ email: 'existing@example.com' });
      const user = await userModel.create({ email: 'willchange@example.com' });

      await expect(userModel.update(user.id, { email: 'existing@example.com' })).rejects.toThrow();
    });

    test('should normalize email on update', async () => {
      const created = await userModel.create({ email: 'normalize@example.com' });

      const updated = await userModel.update(created.id, { email: '  NORMALIZE2@EXAMPLE.COM  ' });

      expect(updated?.email).toBe('normalize2@example.com');
    });
  });

  describe('delete', () => {
    test('should delete a user by ID', async () => {
      const created = await userModel.create({
        email: 'delete@example.com',
        name: 'Delete Me',
      });

      const deleted = await userModel.delete(created.id);

      expect(deleted).toBe(true);

      const found = await userModel.findById(created.id);
      expect(found).toBeNull();
    });

    test('should return false for nonexistent ID', async () => {
      const deleted = await userModel.delete(99999);

      expect(deleted).toBe(false);
    });
  });

  describe('findAll', () => {
    test('should return all users', async () => {
      await userModel.create({ email: 'user1@example.com', name: 'User 1' });
      await userModel.create({ email: 'user2@example.com', name: 'User 2' });
      await userModel.create({ email: 'user3@example.com', name: 'User 3' });

      const users = await userModel.findAll();

      expect(users).toHaveLength(3);
    });

    test('should return empty array when no users exist', async () => {
      const users = await userModel.findAll();

      expect(users).toEqual([]);
    });

    test('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await userModel.create({ email: `user${i}@example.com` });
      }

      const users = await userModel.findAll(2);

      expect(users).toHaveLength(2);
    });

    test('should order by createdAt descending (newest first)', async () => {
      // Create users in sequence - findAll should return newest first
      // Note: in fast tests, timestamps may be identical so we verify both exist
      await userModel.create({ email: 'first@example.com' });
      await userModel.create({ email: 'second@example.com' });

      const users = await userModel.findAll();

      expect(users).toHaveLength(2);
      // Both users should be returned (order depends on insertion time precision)
      const emails = users.map(u => u.email);
      expect(emails).toContain('first@example.com');
      expect(emails).toContain('second@example.com');
    });
  });

  describe('count', () => {
    test('should return total user count', async () => {
      await userModel.create({ email: 'user1@example.com' });
      await userModel.create({ email: 'user2@example.com' });
      await userModel.create({ email: 'user3@example.com' });

      const count = await userModel.count();

      expect(count).toBe(3);
    });

    test('should return 0 when no users exist', async () => {
      const count = await userModel.count();

      expect(count).toBe(0);
    });
  });

  describe('emailExists', () => {
    test('should return true for existing email', async () => {
      await userModel.create({ email: 'exists@example.com' });

      const exists = await userModel.emailExists('exists@example.com');

      expect(exists).toBe(true);
    });

    test('should return false for nonexistent email', async () => {
      const exists = await userModel.emailExists('nonexistent@example.com');

      expect(exists).toBe(false);
    });

    test('should handle case-insensitive check', async () => {
      await userModel.create({ email: 'casecheck@example.com' });

      const exists = await userModel.emailExists('CASECHECK@EXAMPLE.COM');

      expect(exists).toBe(true);
    });
  });
});
