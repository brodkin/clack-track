import { createKnexInstance, getKnexInstance, closeKnexInstance } from '@/storage/knex.js';
import type { Knex } from 'knex';

// Mock knex module
jest.mock('knex', () => {
  const mockDestroy = jest.fn().mockResolvedValue(undefined);
  const mockKnex = jest.fn(() => ({
    destroy: mockDestroy,
    client: { config: { client: 'sqlite3' } },
  }));
  mockKnex.mockDestroy = mockDestroy;
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
      process.env.NODE_ENV = 'development';

      const instance = getKnexInstance();

      expect(instance).toBeDefined();
      const callConfig = knexMock.mock.calls[0][0] as Knex.Config;
      expect(callConfig.client).toBe('sqlite3');

      process.env.NODE_ENV = originalEnv;
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
      const originalDbType = process.env.DB_TYPE;
      const originalDbHost = process.env.DB_HOST;
      const originalDbUser = process.env.DB_USER;
      const originalDbPassword = process.env.DB_PASSWORD;
      const originalDbName = process.env.DB_NAME;
      const originalDbPort = process.env.DB_PORT;

      process.env.NODE_ENV = 'production';
      process.env.DB_TYPE = 'mysql';
      process.env.DB_HOST = 'mysql-server';
      process.env.DB_USER = 'clacktrack';
      process.env.DB_PASSWORD = 'secure-password';
      process.env.DB_NAME = 'clack_track';
      process.env.DB_PORT = '3306';

      const instance = getKnexInstance();

      expect(instance).toBeDefined();
      const callConfig = knexMock.mock.calls[0][0] as Knex.Config;
      expect(callConfig.client).toBe('mysql2');

      process.env.NODE_ENV = originalEnv;
      process.env.DB_TYPE = originalDbType;
      process.env.DB_HOST = originalDbHost;
      process.env.DB_USER = originalDbUser;
      process.env.DB_PASSWORD = originalDbPassword;
      process.env.DB_NAME = originalDbName;
      process.env.DB_PORT = originalDbPort;
    });
  });
});
