/**
 * Unit Tests for db:reset CLI Command
 *
 * Tests the db:reset command which provides safe database reset operations
 * with production blocking, confirmation prompts, and optional seeding.
 *
 * @module tests/unit/cli/commands/db-reset
 */

// Set minimal environment variables BEFORE any imports
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.VESTABOARD_API_KEY = 'test-vestaboard-key';
process.env.VESTABOARD_API_URL = 'http://localhost:7000';

import type { Knex } from 'knex';

// Mock modules BEFORE importing the command
jest.mock('../../../../src/storage/knex.js');
jest.mock('readline/promises');

// Now import modules
import { dbResetCommand } from '../../../../src/cli/commands/db-reset.js';
import * as knexModule from '../../../../src/storage/knex.js';
import * as readline from 'readline/promises';

// Mock console methods to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock process.exit to prevent test termination
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit(${code})`);
});

describe('db:reset command', () => {
  let mockKnex: jest.Mocked<Knex>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();

    // Store original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // Create comprehensive mock Knex instance
    mockKnex = {
      migrate: {
        latest: jest.fn().mockResolvedValue([1, ['migration1', 'migration2']]),
        rollback: jest.fn().mockResolvedValue([1, ['migration1']]),
      },
      seed: {
        run: jest.fn().mockResolvedValue([[{ file: 'seed1.ts' }]]),
      },
      raw: jest.fn().mockResolvedValue(undefined),
      schema: {
        hasTable: jest.fn().mockResolvedValue(true),
      },
      table: jest.fn().mockReturnThis(),
      truncate: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      client: {
        config: {
          client: 'sqlite3',
        },
        database: jest.fn().mockReturnValue('test_db'),
      },
    } as unknown as jest.Mocked<Knex>;

    // Mock getKnexInstance
    jest.spyOn(knexModule, 'getKnexInstance').mockReturnValue(mockKnex);
    jest.spyOn(knexModule, 'closeKnexInstance').mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  describe('Production Environment Safety', () => {
    it('should block execution in production environment', async () => {
      process.env.NODE_ENV = 'production';

      await expect(dbResetCommand({ truncate: false, seed: false, force: false })).rejects.toThrow(
        'db:reset is not allowed in production environment'
      );

      expect(mockKnex.migrate.rollback).not.toHaveBeenCalled();
      expect(mockKnex.migrate.latest).not.toHaveBeenCalled();
    });

    it('should block execution even with --force in production', async () => {
      process.env.NODE_ENV = 'production';

      await expect(dbResetCommand({ truncate: false, seed: false, force: true })).rejects.toThrow(
        'db:reset is not allowed in production environment'
      );

      expect(mockKnex.migrate.rollback).not.toHaveBeenCalled();
    });

    it('should allow execution in development environment', async () => {
      process.env.NODE_ENV = 'development';

      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(mockKnex.migrate.rollback).toHaveBeenCalled();
      expect(mockKnex.migrate.latest).toHaveBeenCalled();
    });

    it('should allow execution in test environment', async () => {
      process.env.NODE_ENV = 'test';

      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(mockKnex.migrate.rollback).toHaveBeenCalled();
      expect(mockKnex.migrate.latest).toHaveBeenCalled();
    });
  });

  describe('Confirmation Prompts', () => {
    let mockReadline: {
      question: jest.Mock;
      close: jest.Mock;
    };

    beforeEach(() => {
      mockReadline = {
        question: jest.fn(),
        close: jest.fn(),
      };

      // Mock readline.createInterface
      (readline.createInterface as jest.Mock).mockReturnValue(mockReadline);
    });

    it('should require confirmation when --force is not provided', async () => {
      mockReadline.question.mockResolvedValue('yes');

      await dbResetCommand({ truncate: false, seed: false, force: false });

      expect(readline.createInterface).toHaveBeenCalled();
      expect(mockReadline.question).toHaveBeenCalledWith(expect.stringContaining('Are you sure'));
      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('should proceed when user confirms with "yes"', async () => {
      mockReadline.question.mockResolvedValue('yes');

      await dbResetCommand({ truncate: false, seed: false, force: false });

      expect(mockKnex.migrate.rollback).toHaveBeenCalled();
      expect(mockKnex.migrate.latest).toHaveBeenCalled();
    });

    it('should proceed when user confirms with "y"', async () => {
      mockReadline.question.mockResolvedValue('y');

      await dbResetCommand({ truncate: false, seed: false, force: false });

      expect(mockKnex.migrate.rollback).toHaveBeenCalled();
      expect(mockKnex.migrate.latest).toHaveBeenCalled();
    });

    it('should abort when user declines with "no"', async () => {
      mockReadline.question.mockResolvedValue('no');

      await dbResetCommand({ truncate: false, seed: false, force: false });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Aborted'));
      expect(mockKnex.migrate.rollback).not.toHaveBeenCalled();
      expect(mockKnex.migrate.latest).not.toHaveBeenCalled();
    });

    it('should abort when user provides empty input', async () => {
      mockReadline.question.mockResolvedValue('');

      await dbResetCommand({ truncate: false, seed: false, force: false });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Aborted'));
      expect(mockKnex.migrate.rollback).not.toHaveBeenCalled();
    });

    it('should skip confirmation when --force is provided', async () => {
      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(readline.createInterface).not.toHaveBeenCalled();
      expect(mockReadline.question).not.toHaveBeenCalled();
      expect(mockKnex.migrate.rollback).toHaveBeenCalled();
    });
  });

  describe('Drop Mode (Default)', () => {
    it('should rollback and re-run migrations by default', async () => {
      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(mockKnex.migrate.rollback).toHaveBeenCalledTimes(1);
      expect(mockKnex.migrate.latest).toHaveBeenCalledTimes(1);
      expect(mockKnex.truncate).not.toHaveBeenCalled();
    });

    it('should log migration rollback progress', async () => {
      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Rolling back all migrations')
      );
    });

    it('should log migration re-run progress', async () => {
      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Running migrations'));
    });

    it('should log success message after drop mode completion', async () => {
      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Database reset complete')
      );
    });
  });

  describe('Truncate Mode', () => {
    let mockQueryBuilder: { truncate: jest.Mock };

    beforeEach(() => {
      // Mock table list query
      const rawMock = jest
        .fn()
        .mockResolvedValue([
          { name: 'content' },
          { name: 'votes' },
          { name: 'logs' },
          { name: 'knex_migrations' },
          { name: 'knex_migrations_lock' },
        ]);

      // Mock table truncation - knex(tableName) returns a query builder
      mockQueryBuilder = {
        truncate: jest.fn().mockResolvedValue(undefined),
      };

      // Create a new mock that acts as both function and object
      const knexFn = jest.fn().mockReturnValue(mockQueryBuilder) as jest.MockedFunction<
        (tableName: string) => { truncate: jest.Mock }
      > &
        Partial<Knex>;
      knexFn.migrate = mockKnex.migrate;
      knexFn.seed = mockKnex.seed;
      knexFn.raw = rawMock as unknown as Knex['raw'];
      knexFn.schema = mockKnex.schema;
      knexFn.client = mockKnex.client;
      knexFn.destroy = mockKnex.destroy;

      // Update the mock returned by getKnexInstance
      jest.spyOn(knexModule, 'getKnexInstance').mockReturnValue(knexFn);
    });

    it('should truncate all tables except migration tables when --truncate is provided', async () => {
      const knexFn = knexModule.getKnexInstance();

      await dbResetCommand({ truncate: true, seed: false, force: true });

      // Should query for tables
      expect(knexFn.raw).toHaveBeenCalled();

      // Should truncate user tables (content, votes, logs)
      expect(knexFn).toHaveBeenCalledWith('content');
      expect(knexFn).toHaveBeenCalledWith('votes');
      expect(knexFn).toHaveBeenCalledWith('logs');

      // Should NOT truncate migration tables
      expect(knexFn).not.toHaveBeenCalledWith('knex_migrations');
      expect(knexFn).not.toHaveBeenCalledWith('knex_migrations_lock');

      // Should NOT run migrations
      expect(mockKnex.migrate.rollback).not.toHaveBeenCalled();
      expect(mockKnex.migrate.latest).not.toHaveBeenCalled();
    });

    it('should log truncate progress', async () => {
      await dbResetCommand({ truncate: true, seed: false, force: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Truncating all tables'));
    });

    it('should log success message after truncate mode completion', async () => {
      await dbResetCommand({ truncate: true, seed: false, force: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Database reset complete')
      );
    });
  });

  describe('Seed Functionality', () => {
    it('should run seeds when --seed flag is provided in drop mode', async () => {
      await dbResetCommand({ truncate: false, seed: true, force: true });

      expect(mockKnex.migrate.rollback).toHaveBeenCalled();
      expect(mockKnex.migrate.latest).toHaveBeenCalled();
      expect(mockKnex.seed.run).toHaveBeenCalledTimes(1);
    });

    describe('with truncate mode', () => {
      beforeEach(() => {
        // Setup function mock for truncate mode
        const rawMock = jest.fn().mockResolvedValue([{ name: 'content' }, { name: 'votes' }]);

        const mockQueryBuilder = {
          truncate: jest.fn().mockResolvedValue(undefined),
        };

        const knexFn = jest.fn().mockReturnValue(mockQueryBuilder) as jest.MockedFunction<
          (tableName: string) => { truncate: jest.Mock }
        > &
          Partial<Knex>;
        knexFn.migrate = mockKnex.migrate;
        knexFn.seed = mockKnex.seed;
        knexFn.raw = rawMock as unknown as Knex['raw'];
        knexFn.schema = mockKnex.schema;
        knexFn.client = mockKnex.client;
        knexFn.destroy = mockKnex.destroy;

        jest.spyOn(knexModule, 'getKnexInstance').mockReturnValue(knexFn);
      });

      it('should run seeds when --seed flag is provided in truncate mode', async () => {
        await dbResetCommand({ truncate: true, seed: true, force: true });

        expect(mockKnex.seed.run).toHaveBeenCalledTimes(1);
      });
    });

    it('should NOT run seeds when --seed flag is not provided', async () => {
      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(mockKnex.seed.run).not.toHaveBeenCalled();
    });

    it('should log seed execution progress', async () => {
      await dbResetCommand({ truncate: false, seed: true, force: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Running seeds'));
    });
  });

  describe('Error Handling', () => {
    it('should handle migration rollback errors', async () => {
      const errorMsg = 'Migration rollback failed';
      mockKnex.migrate.rollback = jest.fn().mockRejectedValue(new Error(errorMsg));

      await expect(dbResetCommand({ truncate: false, seed: false, force: true })).rejects.toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reset database'),
        expect.any(Error)
      );
    });

    it('should handle migration latest errors', async () => {
      const errorMsg = 'Migration latest failed';
      mockKnex.migrate.latest = jest.fn().mockRejectedValue(new Error(errorMsg));

      await expect(dbResetCommand({ truncate: false, seed: false, force: true })).rejects.toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reset database'),
        expect.any(Error)
      );
    });

    it('should handle truncate errors', async () => {
      const errorMsg = 'Truncate failed';
      mockKnex.raw = jest.fn().mockRejectedValue(new Error(errorMsg));

      await expect(dbResetCommand({ truncate: true, seed: false, force: true })).rejects.toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reset database'),
        expect.any(Error)
      );
    });

    it('should handle seed errors', async () => {
      const errorMsg = 'Seed failed';
      mockKnex.seed.run = jest.fn().mockRejectedValue(new Error(errorMsg));

      await expect(dbResetCommand({ truncate: false, seed: true, force: true })).rejects.toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reset database'),
        expect.any(Error)
      );
    });

    it('should exit with code 1 on error', async () => {
      mockKnex.migrate.rollback = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await dbResetCommand({ truncate: false, seed: false, force: true });
      } catch (error) {
        expect((error as Error).message).toBe('process.exit(1)');
      }

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Resource Cleanup', () => {
    it('should close Knex connection after successful reset', async () => {
      await dbResetCommand({ truncate: false, seed: false, force: true });

      expect(knexModule.closeKnexInstance).toHaveBeenCalledTimes(1);
    });

    it('should close Knex connection even after errors', async () => {
      mockKnex.migrate.rollback = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await dbResetCommand({ truncate: false, seed: false, force: true });
      } catch {
        // Expected to throw
      }

      expect(knexModule.closeKnexInstance).toHaveBeenCalledTimes(1);
    });

    it('should close readline interface after confirmation', async () => {
      const mockReadline = {
        question: jest.fn().mockResolvedValue('yes'),
        close: jest.fn(),
      };

      (readline.createInterface as jest.Mock).mockReturnValue(mockReadline);

      await dbResetCommand({ truncate: false, seed: false, force: false });

      expect(mockReadline.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('Warning Messages', () => {
    it('should display clear warning about data loss', async () => {
      const mockReadline = {
        question: jest.fn().mockResolvedValue('yes'),
        close: jest.fn(),
      };

      (readline.createInterface as jest.Mock).mockReturnValue(mockReadline);

      await dbResetCommand({ truncate: false, seed: false, force: false });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('ALL DATA WILL BE LOST'));
    });
  });

  describe('SQL Injection Protection (Security)', () => {
    it('should use parameterized queries to prevent SQL injection in MySQL', async () => {
      // Setup mock for MySQL client
      const rawMock = jest
        .fn()
        .mockResolvedValue([[{ Tables_in_test_db: 'content' }, { Tables_in_test_db: 'votes' }]]);

      const mockQueryBuilder = {
        truncate: jest.fn().mockResolvedValue(undefined),
      };

      const knexFn = jest.fn().mockReturnValue(mockQueryBuilder) as jest.MockedFunction<
        (tableName: string) => { truncate: jest.Mock }
      > &
        Partial<Knex>;
      knexFn.migrate = mockKnex.migrate;
      knexFn.seed = mockKnex.seed;
      knexFn.raw = rawMock as unknown as Knex['raw'];
      knexFn.schema = mockKnex.schema;
      knexFn.client = {
        config: { client: 'mysql2' },
        database: jest.fn().mockReturnValue('test_db'),
      };
      knexFn.destroy = mockKnex.destroy;

      jest.spyOn(knexModule, 'getKnexInstance').mockReturnValue(knexFn);

      await dbResetCommand({ truncate: true, seed: false, force: true });

      // Verify that knex.raw was called with parameterized query
      // Should be called with: knex.raw('SHOW TABLES FROM ??', [dbName])
      expect(rawMock).toHaveBeenCalledWith(
        expect.stringContaining('??'), // Knex placeholder for identifier
        expect.arrayContaining(['test_db']) // Database name as parameter
      );

      // Verify the raw call did NOT use string interpolation
      const rawCall = rawMock.mock.calls[0];
      expect(rawCall[0]).not.toContain('${'); // Should NOT have template literal syntax
      expect(rawCall[0]).not.toContain('test_db'); // Database name should NOT be in query string
    });

    it('should not embed database name directly in SQL string', async () => {
      // Setup mock for MySQL client
      const rawMock = jest.fn().mockResolvedValue([[{ Tables_in_malicious_db: 'table1' }]]);

      const mockQueryBuilder = {
        truncate: jest.fn().mockResolvedValue(undefined),
      };

      const knexFn = jest.fn().mockReturnValue(mockQueryBuilder) as jest.MockedFunction<
        (tableName: string) => { truncate: jest.Mock }
      > &
        Partial<Knex>;
      knexFn.migrate = mockKnex.migrate;
      knexFn.seed = mockKnex.seed;
      knexFn.raw = rawMock as unknown as Knex['raw'];
      knexFn.schema = mockKnex.schema;
      knexFn.client = {
        config: { client: 'mysql2' },
        database: jest.fn().mockReturnValue('malicious_db'),
      };
      knexFn.destroy = mockKnex.destroy;

      jest.spyOn(knexModule, 'getKnexInstance').mockReturnValue(knexFn);

      await dbResetCommand({ truncate: true, seed: false, force: true });

      // Verify the query uses parameter binding, not string interpolation
      const rawCall = rawMock.mock.calls[0];
      const queryString = rawCall[0] as string;
      const queryParams = rawCall[1] as string[];

      // Query should have ?? placeholder, not actual database name
      expect(queryString).toMatch(/SHOW\s+TABLES\s+FROM\s+\?\?/i);
      // Database name should be in parameters array, not in query string
      expect(queryParams).toContain('malicious_db');
    });
  });
});
