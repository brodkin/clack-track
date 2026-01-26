import { UserRepository } from '../../../../src/storage/repositories/user-repo.js';
import { UserModel } from '../../../../src/storage/models/user.js';
import {
  getKnexInstance,
  closeKnexInstance,
  resetKnexInstance,
  type Knex,
} from '../../../../src/storage/knex.js';

describe('UserRepository', () => {
  let knex: Knex;
  let userModel: UserModel;
  let userRepo: UserRepository;

  beforeAll(async () => {
    // Reset singleton to ensure clean state (once per test file)
    resetKnexInstance();
    knex = getKnexInstance();

    // Create table manually instead of using migrations (avoids ES module import issues)
    // This pattern matches model tests
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
    userRepo = new UserRepository(userModel);
  });

  afterAll(async () => {
    await closeKnexInstance();
  });

  describe('save (fire-and-forget)', () => {
    test('should save user without throwing on success', async () => {
      await expect(
        userRepo.save({ email: 'test@example.com', name: 'Test User' })
      ).resolves.not.toThrow();

      // Verify user was saved
      const found = await userModel.findByEmail('test@example.com');
      expect(found).not.toBeNull();
    });

    test('should not throw on duplicate email (fire-and-forget)', async () => {
      await userRepo.save({ email: 'dup@example.com' });

      // Second save with same email should not throw
      await expect(userRepo.save({ email: 'dup@example.com' })).resolves.not.toThrow();
    });

    test('should log warning on database error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        create: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      await failingRepo.save({ email: 'fail@example.com' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save user'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('findById', () => {
    test('should find user by ID', async () => {
      const created = await userModel.create({
        email: 'find@example.com',
        name: 'Find User',
      });

      const found = await userRepo.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        email: 'find@example.com',
        name: 'Find User',
      });
    });

    test('should return null for nonexistent ID', async () => {
      const found = await userRepo.findById(99999);

      expect(found).toBeNull();
    });

    test('should return null on database error (graceful degradation)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findById: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.findById(1);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find user by ID'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('findByEmail', () => {
    test('should find user by email', async () => {
      await userModel.create({
        email: 'email@example.com',
        name: 'Email User',
      });

      const found = await userRepo.findByEmail('email@example.com');

      expect(found).toMatchObject({
        email: 'email@example.com',
        name: 'Email User',
      });
    });

    test('should return null for nonexistent email', async () => {
      const found = await userRepo.findByEmail('nonexistent@example.com');

      expect(found).toBeNull();
    });

    test('should return null on database error (graceful degradation)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByEmail: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.findByEmail('test@example.com');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find user by email'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('update', () => {
    test('should update user and return updated record', async () => {
      const created = await userModel.create({
        email: 'update@example.com',
        name: 'Original Name',
      });

      const updated = await userRepo.update(created.id, { name: 'Updated Name' });

      expect(updated).toMatchObject({
        id: created.id,
        email: 'update@example.com',
        name: 'Updated Name',
      });
    });

    test('should return null for nonexistent ID', async () => {
      const updated = await userRepo.update(99999, { name: 'Ghost' });

      expect(updated).toBeNull();
    });

    test('should return null on database error (graceful degradation)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        update: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.update(1, { name: 'Test' });

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update user'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('delete', () => {
    test('should delete user and return true', async () => {
      const created = await userModel.create({
        email: 'delete@example.com',
      });

      const deleted = await userRepo.delete(created.id);

      expect(deleted).toBe(true);

      const found = await userModel.findById(created.id);
      expect(found).toBeNull();
    });

    test('should return false for nonexistent ID', async () => {
      const deleted = await userRepo.delete(99999);

      expect(deleted).toBe(false);
    });

    test('should return false on database error (graceful degradation)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        delete: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.delete(1);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete user'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('findAll', () => {
    test('should return all users', async () => {
      await userModel.create({ email: 'user1@example.com' });
      await userModel.create({ email: 'user2@example.com' });
      await userModel.create({ email: 'user3@example.com' });

      const users = await userRepo.findAll();

      expect(users).toHaveLength(3);
    });

    test('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await userModel.create({ email: `user${i}@example.com` });
      }

      const users = await userRepo.findAll(2);

      expect(users).toHaveLength(2);
    });

    test('should return empty array when no users exist', async () => {
      const users = await userRepo.findAll();

      expect(users).toEqual([]);
    });

    test('should return empty array on database error (graceful degradation)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findAll: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.findAll();

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to find all users'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('count', () => {
    test('should return user count', async () => {
      await userModel.create({ email: 'user1@example.com' });
      await userModel.create({ email: 'user2@example.com' });

      const count = await userRepo.count();

      expect(count).toBe(2);
    });

    test('should return 0 when no users exist', async () => {
      const count = await userRepo.count();

      expect(count).toBe(0);
    });

    test('should return 0 on database error (graceful degradation)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        count: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.count();

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to count users'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('emailExists', () => {
    test('should return true for existing email', async () => {
      await userModel.create({ email: 'exists@example.com' });

      const exists = await userRepo.emailExists('exists@example.com');

      expect(exists).toBe(true);
    });

    test('should return false for nonexistent email', async () => {
      const exists = await userRepo.emailExists('nonexistent@example.com');

      expect(exists).toBe(false);
    });

    test('should return false on database error (graceful degradation)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        emailExists: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.emailExists('test@example.com');

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check email existence'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('createUser (legacy method)', () => {
    test('should create user and return record', async () => {
      const result = await userRepo.createUser({
        email: 'legacy@example.com',
        name: 'Legacy User',
      });

      expect(result).toMatchObject({
        email: 'legacy@example.com',
        name: 'Legacy User',
      });
      expect(result?.id).toBeDefined();
    });

    test('should return null on error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        create: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.createUser({ email: 'fail@example.com' });

      expect(result).toBeNull();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getOrCreateByEmail', () => {
    test('should return existing user if email exists', async () => {
      const existing = await userModel.create({
        email: 'existing@example.com',
        name: 'Existing User',
      });

      const result = await userRepo.getOrCreateByEmail('existing@example.com');

      expect(result).toMatchObject({
        id: existing.id,
        email: 'existing@example.com',
        name: 'Existing User',
      });
    });

    test('should create new user if email does not exist', async () => {
      const result = await userRepo.getOrCreateByEmail('new@example.com', 'New User');

      expect(result).toMatchObject({
        email: 'new@example.com',
        name: 'New User',
      });
      expect(result?.id).toBeDefined();
    });

    test('should create user without name if not provided', async () => {
      const result = await userRepo.getOrCreateByEmail('noname@example.com');

      expect(result).toMatchObject({
        email: 'noname@example.com',
        name: null,
      });
    });

    test('should return null on database error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockModel = {
        findByEmail: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      const failingRepo = new UserRepository(mockModel as unknown as UserModel);
      const result = await failingRepo.getOrCreateByEmail('test@example.com');

      expect(result).toBeNull();

      consoleWarnSpy.mockRestore();
    });
  });
});
