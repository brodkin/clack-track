import {
  createKnexInstance,
  getKnexInstance,
  closeKnexInstance,
  initializeKnex,
  isKnexConnected,
} from '@/storage/knex.js';
import type { Knex } from 'knex';

// Mock knex module
jest.mock('knex', () => {
  const mockMigrateLatest = jest.fn().mockResolvedValue([1, ['migration_1']]);
  const mockRaw = jest.fn().mockResolvedValue({ rows: [{ '1': 1 }] });
  const mockDestroy = jest.fn().mockResolvedValue(undefined);
  const mockKnex = jest.fn(() => ({
    destroy: mockDestroy,
    migrate: {
      latest: mockMigrateLatest,
    },
    raw: mockRaw,
    client: { config: { client: 'sqlite3' } },
  }));
  mockKnex.mockDestroy = mockDestroy;
  mockKnex.mockMigrateLatest = mockMigrateLatest;
  mockKnex.mockRaw = mockRaw;
  return mockKnex;
});

describe('Knex Factory and Singleton', () => {
  let knexMock: jest.Mock;

  beforeEach(async () => {
    // Clear singleton state between tests
    const knexModule = await import('knex');
    knexMock = knexModule.default as unknown as jest.Mock;
  });

  afterEach(async () => {
    // Clean up singleton instance after each test
    await closeKnexInstance();
    jest.clearAllMocks();
  });

  describe('createKnexInstance()', () => {
    it('should create a new Knex instance with provided config', () => {
      const config: Knex.Config = {
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      };

      const instance = createKnexInstance(config);

      expect(instance).toBeDefined();
      expect(knexMock).toHaveBeenCalledWith(config);
    });

    it('should create a Knex instance with default SQLite config when no config provided', () => {
      const instance = createKnexInstance();

      expect(instance).toBeDefined();
      expect(knexMock).toHaveBeenCalled();
      const callConfig = knexMock.mock.calls[0][0] as Knex.Config;
      expect(callConfig.client).toBe('sqlite3');
    });

    it('should support MySQL configuration', () => {
      const mysqlConfig: Knex.Config = {
        client: 'mysql2',
        connection: {
          host: 'localhost',
          user: 'root',
          password: 'password',
          database: 'clack_track',
        },
      };

      const instance = createKnexInstance(mysqlConfig);

      expect(instance).toBeDefined();
      expect(knexMock).toHaveBeenCalledWith(mysqlConfig);
    });
  });

  describe('getKnexInstance()', () => {
    it('should return the same instance on multiple calls (singleton)', () => {
      const instance1 = getKnexInstance();
      const instance2 = getKnexInstance();

      expect(instance1).toBe(instance2);
      expect(knexMock).toHaveBeenCalledTimes(1);
    });

    it('should create instance with environment-specific config', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const instance = getKnexInstance();

      expect(instance).toBeDefined();
      expect(knexMock).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should use development config when NODE_ENV is development', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalDbType = process.env.DATABASE_TYPE;
      const originalDbUrl = process.env.DATABASE_URL;
      process.env.NODE_ENV = 'development';
      // Clear MySQL-triggering env vars to test default SQLite behavior
      delete process.env.DATABASE_TYPE;
      delete process.env.DATABASE_URL;

      const instance = getKnexInstance();

      expect(instance).toBeDefined();
      const callConfig = knexMock.mock.calls[0][0] as Knex.Config;
      expect(callConfig.client).toBe('sqlite3');

      process.env.NODE_ENV = originalEnv;
      if (originalDbType !== undefined) process.env.DATABASE_TYPE = originalDbType;
      if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    });
  });

  describe('closeKnexInstance()', () => {
    it('should destroy the Knex connection', async () => {
      getKnexInstance();
      const destroyMock = (knexMock as jest.Mock & { mockDestroy: jest.Mock }).mockDestroy;

      await closeKnexInstance();

      expect(destroyMock).toHaveBeenCalled();
    });

    it('should handle close when no instance exists', async () => {
      await expect(closeKnexInstance()).resolves.not.toThrow();
    });

    it('should allow creating a new instance after close', async () => {
      getKnexInstance();
      await closeKnexInstance();

      jest.clearAllMocks();

      getKnexInstance();

      expect(knexMock).toHaveBeenCalled();
    });

    it('should handle errors during destroy gracefully', async () => {
      getKnexInstance();
      const destroyMock = (knexMock as jest.Mock & { mockDestroy: jest.Mock }).mockDestroy;
      destroyMock.mockRejectedValueOnce(new Error('Destroy failed'));

      await expect(closeKnexInstance()).resolves.not.toThrow();

      // Verify isKnexConnected returns false after failed cleanup
      const connected = await isKnexConnected();
      expect(connected).toBe(false);
    });
  });

  describe('Environment-specific configuration loading', () => {
    it('should load test environment config', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const instance = getKnexInstance();

      expect(instance).toBeDefined();
      const callConfig = knexMock.mock.calls[0][0] as Knex.Config;
      expect(callConfig.client).toBe('sqlite3');

      process.env.NODE_ENV = originalEnv;
    });

    it('should support production MySQL config from environment variables', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalDatabaseType = process.env.DATABASE_TYPE;
      const originalDatabaseHost = process.env.DATABASE_HOST;
      const originalDatabaseUser = process.env.DATABASE_USER;
      const originalDatabasePassword = process.env.DATABASE_PASSWORD;
      const originalDatabaseName = process.env.DATABASE_NAME;
      const originalDatabasePort = process.env.DATABASE_PORT;

      process.env.NODE_ENV = 'production';
      process.env.DATABASE_TYPE = 'mysql';
      process.env.DATABASE_HOST = 'mysql-server';
      process.env.DATABASE_USER = 'clacktrack';
      process.env.DATABASE_PASSWORD = 'secure-password';
      process.env.DATABASE_NAME = 'clack_track';
      process.env.DATABASE_PORT = '3306';

      const instance = getKnexInstance();

      expect(instance).toBeDefined();
      const callConfig = knexMock.mock.calls[0][0] as Knex.Config;
      expect(callConfig.client).toBe('mysql2');

      process.env.NODE_ENV = originalEnv;
      process.env.DATABASE_TYPE = originalDatabaseType;
      process.env.DATABASE_HOST = originalDatabaseHost;
      process.env.DATABASE_USER = originalDatabaseUser;
      process.env.DATABASE_PASSWORD = originalDatabasePassword;
      process.env.DATABASE_NAME = originalDatabaseName;
      process.env.DATABASE_PORT = originalDatabasePort;
    });
  });

  describe('initializeKnex()', () => {
    it('should create a Knex instance and run migrations', async () => {
      const instance = await initializeKnex();

      expect(instance).toBeDefined();
      expect(knexMock).toHaveBeenCalled();

      const mockInstance = knexMock.mock.results[0].value;
      expect(mockInstance.migrate.latest).toHaveBeenCalled();
    });

    it('should return the same singleton instance on subsequent calls', async () => {
      const instance1 = await initializeKnex();
      const instance2 = await initializeKnex();

      expect(instance1).toBe(instance2);
    });

    it('should handle migration errors gracefully', async () => {
      // Mock migration failure
      const migrateMock = (knexMock as jest.Mock & { mockMigrateLatest: jest.Mock })
        .mockMigrateLatest;
      migrateMock.mockRejectedValueOnce(new Error('Migration failed'));

      await expect(initializeKnex()).rejects.toThrow('Migration failed');
    });

    it('should log migration results', async () => {
      const migrateMock = (knexMock as jest.Mock & { mockMigrateLatest: jest.Mock })
        .mockMigrateLatest;
      migrateMock.mockResolvedValueOnce([1, ['20231201_initial_schema.ts']]);

      const instance = await initializeKnex();

      expect(instance).toBeDefined();
      expect(migrateMock).toHaveBeenCalled();
    });
  });

  describe('isKnexConnected()', () => {
    it('should return true when database connection is active', async () => {
      getKnexInstance();

      const result = await isKnexConnected();

      expect(result).toBe(true);
    });

    it('should return false when database query fails', async () => {
      getKnexInstance();

      const rawMock = (knexMock as jest.Mock & { mockRaw: jest.Mock }).mockRaw;
      rawMock.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await isKnexConnected();

      expect(result).toBe(false);
    });

    it('should execute a simple query to test connection', async () => {
      getKnexInstance();

      await isKnexConnected();

      const rawMock = (knexMock as jest.Mock & { mockRaw: jest.Mock }).mockRaw;
      expect(rawMock).toHaveBeenCalledWith('SELECT 1');
    });

    it('should handle missing instance gracefully', async () => {
      // No instance created yet
      const result = await isKnexConnected();

      expect(result).toBe(false);
    });
  });
});
